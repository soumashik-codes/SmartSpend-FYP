from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer
from collections import defaultdict

from ..database import get_db
from .. import models, schemas
from ..security import decode_token
from ..ml.forecast_engine import prepare_monthly_series, run_sarimax_forecast

import pandas as pd

router = APIRouter(prefix="/forecast", tags=["Forecast"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

WHAT_IF_CATEGORY_LABELS = {
    "Groceries": "Food",
    "Transport": "Transport",
    "Shopping": "Shopping",
    "Entertainment": "Entertainment",
    "Travel": "Travel",
    "Utilities": "Utilities",
    "Healthcare": "Health",
    "Personal Care": "Personal Care",
}


def get_current_user(db: Session, token: str):
    email = decode_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


def get_account_owned(db: Session, user_id: int, account_id: int) -> models.Account:
    account = (
        db.query(models.Account)
        .filter(models.Account.id == account_id, models.Account.user_id == user_id)
        .first()
    )
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


def fallback_forecast(monthly_series: pd.DataFrame, periods: int) -> pd.DataFrame:
    monthly_series = monthly_series.copy().sort_values("date").reset_index(drop=True)
    last_date = pd.to_datetime(monthly_series.iloc[-1]["date"])
    last_balance = float(monthly_series.iloc[-1]["balance"])

    if len(monthly_series) > 1:
        deltas = monthly_series["balance"].diff().dropna()
        avg_change = float(deltas.mean()) if not deltas.empty else 0.0
    else:
        avg_change = 0.0

    dates = pd.date_range(
        start=last_date + pd.offsets.MonthEnd(1),
        periods=periods,
        freq="ME",
    )

    rows = []
    for index, forecast_date in enumerate(dates, start=1):
        forecast_value = last_balance + (avg_change * index)
        rows.append(
            {
                "date": forecast_date,
                "forecast": float(forecast_value),
                "lower": float(forecast_value * 0.95),
                "upper": float(forecast_value * 1.05),
            }
        )

    return pd.DataFrame(rows)


def get_account_balance_rows(db: Session, account_id: int):
    return (
        db.query(models.Transaction.date, models.Transaction.balance_after.label("balance"))
        .filter(models.Transaction.account_id == account_id)
        .order_by(models.Transaction.date.asc(), models.Transaction.id.asc())
        .all()
    )


def get_account_transactions(db: Session, account_id: int):
    return (
        db.query(models.Transaction)
        .filter(models.Transaction.account_id == account_id)
        .order_by(models.Transaction.date.asc(), models.Transaction.id.asc())
        .all()
    )


def build_monthly_series(balance_rows) -> pd.DataFrame:
    data = [{"date": row.date, "balance": float(row.balance)} for row in balance_rows]
    monthly_series = prepare_monthly_series(data)

    if "date" not in monthly_series.columns:
        monthly_series = monthly_series.reset_index()
        if "index" in monthly_series.columns and "date" not in monthly_series.columns:
            monthly_series = monthly_series.rename(columns={"index": "date"})

    monthly_series["date"] = pd.to_datetime(monthly_series["date"])
    monthly_series["balance"] = monthly_series["balance"].astype(float)
    return monthly_series.sort_values("date").reset_index(drop=True)


def build_forecast_dataframe(monthly_series: pd.DataFrame, horizon_months: int) -> pd.DataFrame:
    if len(monthly_series) < 3:
        return fallback_forecast(monthly_series, periods=horizon_months)

    forecast_df = run_sarimax_forecast(monthly_series, periods=horizon_months)

    if "date" not in forecast_df.columns:
        forecast_df = forecast_df.reset_index()
        if "index" in forecast_df.columns and "date" not in forecast_df.columns:
            forecast_df = forecast_df.rename(columns={"index": "date"})

    forecast_df["date"] = pd.to_datetime(forecast_df["date"])
    for col in ["forecast", "lower", "upper"]:
        if col not in forecast_df.columns:
            raise HTTPException(status_code=500, detail=f"Forecast engine missing column: {col}")

    forecast_df["forecast"] = forecast_df["forecast"].astype(float)
    forecast_df["lower"] = forecast_df["lower"].astype(float)
    forecast_df["upper"] = forecast_df["upper"].astype(float)
    return forecast_df.sort_values("date").reset_index(drop=True)


def build_category_monthly_amounts(transactions: list[models.Transaction]) -> dict[str, float]:
    debit_transactions = [transaction for transaction in transactions if float(transaction.amount) < 0]
    if not debit_transactions:
        return {category: 0.0 for category in WHAT_IF_CATEGORY_LABELS}

    monthly_totals: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    active_months = set()

    for transaction in debit_transactions:
        month_key = transaction.date.strftime("%Y-%m")
        active_months.add(month_key)
        category = transaction.category or "Other"
        monthly_totals[month_key][category] += abs(float(transaction.amount))

    sorted_months = sorted(active_months)
    recent_months = sorted_months[-min(12, len(sorted_months)):]
    month_count = len(recent_months) or 1

    category_amounts: dict[str, float] = {}
    for category in WHAT_IF_CATEGORY_LABELS:
        total = sum(monthly_totals[month].get(category, 0.0) for month in recent_months)
        category_amounts[category] = round(total / month_count, 2)

    return category_amounts


@router.get("/balance")
def get_balance_forecast(
    account_id: int,
    horizon_months: int = 6,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    """
    Returns shape expected by frontend:

    {
      "horizon_months": 6,
      "predicted_balance": 1234.56,
      "expected_growth": 78.90,
      "points": [
          {"date":"2025-12","actual":1000},
          {"date":"2026-01","actual":1050},
          {"date":"2026-02","forecast":1100,"lower":1000,"upper":1200},
          ...
      ]
    }
    """
    if horizon_months not in [3, 6, 12]:
        raise HTTPException(status_code=400, detail="horizon_months must be 3, 6, or 12")

    user = get_current_user(db, token)
    # enforce user owns the account
    _ = get_account_owned(db, user.id, account_id)

    balance_rows = get_account_balance_rows(db, account_id)
    if not balance_rows:
        raise HTTPException(status_code=400, detail="No transactions found for this account")

    monthly_series = build_monthly_series(balance_rows)
    forecast_df = build_forecast_dataframe(monthly_series, horizon_months)

    # Build points: actual history first, then forecast
    points = []

    for row in monthly_series.itertuples(index=False):
        points.append(
            {
                "date": pd.to_datetime(row.date).strftime("%Y-%m"),
                "actual": float(row.balance),
            }
        )

    for row in forecast_df.itertuples(index=False):
        points.append(
            {
                "date": pd.to_datetime(row.date).strftime("%Y-%m"),
                "forecast": float(row.forecast),
                "lower": float(row.lower),
                "upper": float(row.upper),
            }
        )

    last_actual = float(monthly_series.iloc[-1]["balance"])
    predicted_balance = float(forecast_df.iloc[-1]["forecast"])
    expected_growth = predicted_balance - last_actual

    return {
        "horizon_months": int(horizon_months),
        "predicted_balance": round(predicted_balance, 2),
        "expected_growth": round(expected_growth, 2),
        "points": points,
    }


@router.post("/what-if", response_model=schemas.WhatIfResponse)
def run_what_if_simulation(
    payload: schemas.WhatIfRequest,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    if payload.horizon_months not in [3, 6, 12]:
        raise HTTPException(status_code=400, detail="horizon_months must be 3, 6, or 12")

    user = get_current_user(db, token)
    account = get_account_owned(db, user.id, payload.account_id)

    transactions = get_account_transactions(db, payload.account_id)
    balance_rows = get_account_balance_rows(db, payload.account_id)
    if not transactions or not balance_rows:
        raise HTTPException(status_code=400, detail="No transactions found for this account")

    monthly_series = build_monthly_series(balance_rows)
    forecast_df = build_forecast_dataframe(monthly_series, payload.horizon_months)
    category_monthly_amounts = build_category_monthly_amounts(transactions)

    adjustments_by_category = {
        item.category: float(item.change_pct)
        for item in payload.adjustments
    }

    monthly_expense_delta = 0.0
    categories = []
    for category, label in WHAT_IF_CATEGORY_LABELS.items():
        monthly_amount = float(category_monthly_amounts.get(category, 0.0))
        change_pct = float(adjustments_by_category.get(category, 0.0))
        monthly_expense_delta += monthly_amount * (change_pct / 100)
        categories.append(
            {
                "category": category,
                "label": label,
                "monthly_amount": round(monthly_amount, 2),
                "adjustment_pct": round(change_pct, 2),
            }
        )

    current_balance = float(account.current_balance)
    points = [
        {
            "date": monthly_series.iloc[-1]["date"].strftime("%Y-%m"),
            "baseline": round(current_balance, 2),
            "adjusted": round(current_balance, 2),
        }
    ]

    for index, row in enumerate(forecast_df.itertuples(index=False), start=1):
        baseline = float(row.forecast)

        # apply spending change gradually over forecast horizon
        adjusted = baseline + (-monthly_expense_delta * index)
        points.append(
            {
                "date": pd.to_datetime(row.date).strftime("%Y-%m"),
                "baseline": round(baseline, 2),
                "adjusted": round(adjusted, 2),
            }
        )

    baseline_end_balance = float(points[-1]["baseline"])
    adjusted_end_balance = float(points[-1]["adjusted"])
    monthly_balance_change = float(-monthly_expense_delta)
    horizon_impact = float(adjusted_end_balance - baseline_end_balance)

    return {
        "horizon_months": int(payload.horizon_months),
        "current_balance": round(current_balance, 2),
        "categories": categories,
        "points": points,
        "summary": {
            "monthly_change": round(monthly_balance_change, 2),
            "horizon_impact": round(horizon_impact, 2),
            "baseline_end_balance": round(baseline_end_balance, 2),
            "adjusted_end_balance": round(adjusted_end_balance, 2),
        },
    }


# keep legacy endpoint so older frontend calls won't break
@router.get("/")
def get_forecast_legacy(
    account_id: int,
    period: int = 6,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    return get_balance_forecast(
        account_id=account_id,
        horizon_months=period,
        token=token,
        db=db,
    )

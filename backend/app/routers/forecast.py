from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer
from collections import defaultdict

from ..database import get_db
from .. import models, schemas
from ..security import decode_token
from ..ml.forecast_engine import prepare_monthly_series, run_sarimax_forecast

import pandas as pd
import math

router = APIRouter(prefix="/forecast", tags=["Forecast"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

MIN_SARIMAX_HISTORY_MONTHS = 12
SEASONAL_SARIMAX_HISTORY_MONTHS = 24

WHAT_IF_CATEGORY_LABELS = {
    "Groceries": "Groceries",
    "Dining": "Dining",
    "Transport": "Transport",
    "Shopping": "Shopping",
    "Entertainment": "Entertainment",
    "Travel": "Travel",
    "Utilities": "Utilities",
    "Housing": "Housing",
    "Healthcare": "Healthcare",
    "Personal Care": "Personal Care",
    "Fitness": "Fitness",
    "Bank Fees": "Bank Fees",
}

WHAT_IF_AVERAGE_LOOKBACK_MONTHS = 12


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


def build_monthly_cashflow_series(
    transactions: list[models.Transaction],
) -> pd.DataFrame:
    monthly: dict[str, dict[str, float]] = defaultdict(lambda: {"income": 0.0, "expenses": 0.0})

    for transaction in transactions:
        month = transaction.date.strftime("%Y-%m")
        amount = float(transaction.amount)
        if amount > 0:
            monthly[month]["income"] += amount
        elif amount < 0:
            monthly[month]["expenses"] += abs(amount)

    rows = []
    for month in sorted(monthly):
        income = float(monthly[month]["income"])
        expenses = float(monthly[month]["expenses"])
        rows.append(
            {
                "date": pd.to_datetime(f"{month}-01") + pd.offsets.MonthEnd(0),
                "income": income,
                "expenses": expenses,
                "net": income - expenses,
            }
        )

    return pd.DataFrame(rows)


def fallback_forecast(
    monthly_series: pd.DataFrame,
    periods: int,
    monthly_cashflow: pd.DataFrame | None = None,
) -> pd.DataFrame:
    monthly_series = monthly_series.copy().sort_values("date").reset_index(drop=True)
    last_date = pd.to_datetime(monthly_series.iloc[-1]["date"])
    last_balance = float(monthly_series.iloc[-1]["balance"])

    if monthly_cashflow is not None and not monthly_cashflow.empty:
        recent_cashflow = monthly_cashflow.tail(min(6, len(monthly_cashflow))).copy()
        net_values = recent_cashflow["net"].astype(float).tolist()
        average_net = float(pd.Series(net_values).mean()) if net_values else 0.0
        net_volatility = float(pd.Series(net_values).std(ddof=0)) if len(net_values) > 1 else abs(average_net) * 0.1

        if len(net_values) > 1:
            slope = float((net_values[-1] - net_values[0]) / max(1, len(net_values) - 1))
        else:
            slope = 0.0

        cap = max(abs(average_net) * 0.35, 120.0)
        trend_adjustment = max(-cap, min(cap, slope * 0.5))
    else:
        deltas = monthly_series["balance"].diff().dropna()
        average_net = float(deltas.tail(min(6, len(deltas))).mean()) if not deltas.empty else 0.0
        net_volatility = float(deltas.tail(min(6, len(deltas))).std(ddof=0)) if len(deltas) > 1 else abs(average_net) * 0.1
        trend_adjustment = 0.0

    dates = pd.date_range(
        start=last_date + pd.offsets.MonthEnd(1),
        periods=periods,
        freq="ME",
    )

    rows = []
    running_balance = last_balance
    for index, forecast_date in enumerate(dates, start=1):
        projected_net = average_net + trend_adjustment * (index - 1)
        if average_net >= 0:
            projected_net = max(projected_net, average_net * 0.55)
        else:
            projected_net = min(projected_net, average_net * 0.55)

        running_balance += projected_net
        band = max(250.0, abs(net_volatility) * (1 + index * 0.35))
        rows.append(
            {
                "date": forecast_date,
                "forecast": float(running_balance),
                "lower": float(running_balance - band),
                "upper": float(running_balance + band),
            }
        )

    result = pd.DataFrame(rows)
    result.attrs["method"] = "baseline"
    return result


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


def build_forecast_dataframe(
    monthly_series: pd.DataFrame,
    monthly_cashflow: pd.DataFrame,
    horizon_months: int,
) -> pd.DataFrame:
    if len(monthly_series) < MIN_SARIMAX_HISTORY_MONTHS:
        return fallback_forecast(monthly_series, periods=horizon_months, monthly_cashflow=monthly_cashflow)

    try:
        forecast_df = run_sarimax_forecast(monthly_series, periods=horizon_months)
    except Exception:
        return fallback_forecast(monthly_series, periods=horizon_months, monthly_cashflow=monthly_cashflow)

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
    forecast_df = forecast_df.sort_values("date").reset_index(drop=True)

    if forecast_looks_unstable(monthly_series, monthly_cashflow, forecast_df):
        return fallback_forecast(monthly_series, periods=horizon_months, monthly_cashflow=monthly_cashflow)

    forecast_df.attrs["method"] = "sarimax"
    return forecast_df


def forecast_looks_unstable(
    monthly_series: pd.DataFrame,
    monthly_cashflow: pd.DataFrame,
    forecast_df: pd.DataFrame,
) -> bool:
    if forecast_df.empty:
        return True

    forecast_values = forecast_df["forecast"].astype(float).tolist()
    if any(not math.isfinite(value) for value in forecast_values):
        return True

    last_balance = abs(float(monthly_series.iloc[-1]["balance"]))
    recent_abs_max = float(monthly_series["balance"].abs().max())
    max_reasonable_value = max(last_balance * 3, recent_abs_max * 3, 5000.0)
    if any(abs(value) > max_reasonable_value for value in forecast_values):
        return True

    deltas = pd.Series(forecast_values).diff().dropna()
    if deltas.empty:
        return False

    recent_changes = monthly_series["balance"].diff().dropna().abs()
    typical_change = float(recent_changes.tail(6).median()) if not recent_changes.empty else 0.0
    max_reasonable_delta = max(typical_change * 4, last_balance * 0.75 + 500, 750.0)
    if any(abs(float(delta)) > max_reasonable_delta for delta in deltas):
        return True

    sign_changes = int(((deltas.shift(1) * deltas) < 0).sum())
    if len(monthly_series) < 12 and sign_changes >= 2:
        return True

    if not monthly_cashflow.empty:
        recent_net = monthly_cashflow["net"].astype(float).tail(min(6, len(monthly_cashflow)))
    else:
        recent_net = monthly_series["balance"].diff().dropna().tail(6).astype(float)

    if not recent_net.empty:
        average_recent_net = float(recent_net.mean())
        recent_net_std = float(recent_net.std(ddof=0)) if len(recent_net) > 1 else abs(average_recent_net) * 0.1
        predicted_end_delta = forecast_values[-1] - float(monthly_series.iloc[-1]["balance"])
        baseline_end_delta = average_recent_net * len(forecast_values)
        allowed_gap = max(abs(baseline_end_delta) * 1.5, recent_net_std * len(forecast_values) * 2, 1000.0)
        if abs(predicted_end_delta - baseline_end_delta) > allowed_gap:
            return True

        if average_recent_net >= 0 and predicted_end_delta < -max(500.0, abs(baseline_end_delta) * 0.75):
            return True
        if average_recent_net <= 0 and predicted_end_delta > max(500.0, abs(baseline_end_delta) * 0.75):
            return True

    return False


def describe_forecast_method(method: str, history_months: int) -> str:
    if method == "sarimax":
        return "SARIMAX time-series model"
    if history_months < MIN_SARIMAX_HISTORY_MONTHS:
        return "Baseline cash-flow trend"
    return "Baseline stability fallback"


def forecast_confidence_label(method: str, history_months: int) -> str:
    if method != "sarimax":
        return "Low"
    if history_months >= SEASONAL_SARIMAX_HISTORY_MONTHS:
        return "High"
    return "Medium"


def forecast_reliability_note(method: str, history_months: int) -> str:
    if method == "sarimax":
        if history_months >= SEASONAL_SARIMAX_HISTORY_MONTHS:
            return "Forecast uses a longer statement history, so the trend estimate is more reliable."
        return "Forecast uses SARIMAX, but the account history is still fairly short, so treat the projection as directional."

    if history_months < MIN_SARIMAX_HISTORY_MONTHS:
        return (
            f"Forecast is using a baseline cash-flow trend because only {history_months} month"
            f"{'' if history_months == 1 else 's'} of history are available."
        )

    return "Forecast fell back to a simpler baseline because the SARIMAX output looked unstable for this account history."


def build_category_monthly_amounts(
    transactions: list[models.Transaction],
) -> dict[str, object]:
    # Recent months should come from the selected account's actual expense history,
    # not just from What-If-eligible categories. Otherwise months with other expense
    # categories can be skipped and replaced with older months, which makes the
    # displayed monthly averages look inconsistent.
    expense_transactions = [
        transaction
        for transaction in transactions
        if float(transaction.amount) < 0
    ]
    if not expense_transactions:
        return {
            "recent_months_used": [],
            "month_count_used": 0,
            "category_monthly_breakdown": {},
            "category_totals": {},
            "category_averages": {},
        }

    monthly_totals: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    available_months = set()

    for transaction in expense_transactions:
        month_key = transaction.date.strftime("%Y-%m")
        category = transaction.category or "Other"
        available_months.add(month_key)
        if category in WHAT_IF_CATEGORY_LABELS:
            monthly_totals[month_key][category] += abs(float(transaction.amount))

    # Keep slider averages stable across 3 / 6 / 12 month simulations by using a fixed
    # recent-history lookback for the account, independent of the forecast horizon.
    # If fewer than 12 real expense months exist, use however many are available.
    sorted_months = sorted(available_months)
    recent_months = sorted_months[-min(WHAT_IF_AVERAGE_LOOKBACK_MONTHS, len(sorted_months)):]
    month_count = len(recent_months) or 1

    category_amounts: dict[str, float] = {}
    category_totals: dict[str, float] = {}
    category_monthly_breakdown: dict[str, dict[str, float]] = {}
    for category in WHAT_IF_CATEGORY_LABELS:
        monthly_breakdown = {
            month: round(float(monthly_totals[month].get(category, 0.0)), 2)
            for month in recent_months
        }
        total = sum(monthly_breakdown.values())
        average_monthly_spend = round(total / month_count, 2)
        if average_monthly_spend > 0:
            category_amounts[category] = average_monthly_spend
            category_totals[category] = round(total, 2)
            category_monthly_breakdown[category] = monthly_breakdown

    return {
        "recent_months_used": recent_months,
        "month_count_used": month_count,
        "category_monthly_breakdown": category_monthly_breakdown,
        "category_totals": category_totals,
        "category_averages": category_amounts,
    }


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

    transactions = get_account_transactions(db, account_id)
    monthly_series = build_monthly_series(balance_rows)
    monthly_cashflow = build_monthly_cashflow_series(transactions)
    forecast_df = build_forecast_dataframe(monthly_series, monthly_cashflow, horizon_months)

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
    forecast_method = forecast_df.attrs.get("method", "sarimax")
    history_months = int(len(monthly_series))

    return {
        "horizon_months": int(horizon_months),
        "predicted_balance": round(predicted_balance, 2),
        "expected_growth": round(expected_growth, 2),
        "history_months": history_months,
        "forecast_method": forecast_method,
        "forecast_method_label": describe_forecast_method(forecast_method, history_months),
        "forecast_confidence": forecast_confidence_label(forecast_method, history_months),
        "forecast_reliability_note": forecast_reliability_note(forecast_method, history_months),
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
    monthly_cashflow = build_monthly_cashflow_series(transactions)
    forecast_df = build_forecast_dataframe(monthly_series, monthly_cashflow, payload.horizon_months)
    category_debug = build_category_monthly_amounts(transactions)
    category_monthly_amounts = category_debug["category_averages"]

    adjustments_by_category = {
        item.category: float(item.change_pct)
        for item in payload.adjustments
    }

    # The baseline forecast stays unchanged; What-If applies an estimated monthly spending delta
    # on top of that baseline using recent average spend by category.
    monthly_expense_delta = 0.0
    categories = []
    for category, label in WHAT_IF_CATEGORY_LABELS.items():
        monthly_amount = float(category_monthly_amounts.get(category, 0.0))
        if monthly_amount <= 0:
            continue
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

    categories.sort(key=lambda item: item["monthly_amount"], reverse=True)

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

        # Each month compounds the estimated balance impact of the category adjustments.
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
    # Horizon impact is the difference between the simulated end balance and the baseline end balance.
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
        "debug_account_id_used": int(account.id),
        "debug_recent_months_used": category_debug["recent_months_used"],
        "debug_month_count_used": int(category_debug["month_count_used"]),
        "debug_category_monthly_breakdown": category_debug["category_monthly_breakdown"],
        "debug_category_totals": category_debug["category_totals"],
        "debug_category_averages": category_debug["category_averages"],
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

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer

from ..database import get_db
from .. import models
from ..security import decode_token
from ..ml.forecast_engine import prepare_monthly_series, run_sarimax_forecast

import pandas as pd

router = APIRouter(prefix="/forecast", tags=["Forecast"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


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

    # Pull tx balances for this account
    transactions = (
        db.query(models.Transaction.date, models.Transaction.balance_after.label("balance"))
        .filter(models.Transaction.account_id == account_id)
        .order_by(models.Transaction.date.asc(), models.Transaction.id.asc())
        .all()
    )

    if not transactions:
        raise HTTPException(status_code=400, detail="No transactions found for this account")

    data = [{"date": t.date, "balance": float(t.balance)} for t in transactions]

    monthly_series = prepare_monthly_series(data)

    # Normalize structure
    if "date" not in monthly_series.columns:
        monthly_series = monthly_series.reset_index()
        if "index" in monthly_series.columns and "date" not in monthly_series.columns:
            monthly_series = monthly_series.rename(columns={"index": "date"})

    monthly_series["date"] = pd.to_datetime(monthly_series["date"])
    monthly_series["balance"] = monthly_series["balance"].astype(float)
    monthly_series = monthly_series.sort_values("date").reset_index(drop=True)

    # If < 3 months, fallback forecast (still gives chart)
    if len(monthly_series) < 3:
        forecast_df = fallback_forecast(monthly_series, periods=horizon_months)
    else:
        # SARIMAX forecast (auto seasonal/non-seasonal inside engine)
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
        forecast_df = forecast_df.sort_values("date").reset_index(drop=True)

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
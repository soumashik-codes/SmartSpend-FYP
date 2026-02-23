import pandas as pd
import numpy as np
from statsmodels.tsa.statespace.sarimax import SARIMAX


def prepare_monthly_series(transactions):
    """
    Convert daily balances into a MONTHLY closing balance series.
    Uses Month-End frequency ("ME") to be compatible with newer pandas versions.
    """
    df = pd.DataFrame(transactions)

    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date")

    # Keep the LAST balance of each month (closing balance)
    monthly = (
        df.groupby(pd.Grouper(key="date", freq="ME"))
        .last()
        .reset_index()
    )

    monthly = monthly.dropna()
    return monthly[["date", "balance"]]


def run_sarimax_forecast(series_df, periods=6):
    """
    Run SARIMAX on monthly closing balances and return a forecast DF:
    columns: date, forecast, lower, upper
    """
    series_df = series_df.copy()
    series_df["date"] = pd.to_datetime(series_df["date"])
    series_df = series_df.sort_values("date")

    series = series_df.set_index("date")["balance"].astype(float)

    # If less than 3 points, SARIMAX will be unstable
    if len(series) < 3:
        raise ValueError("Need at least 3 months of data for SARIMAX")

    model = SARIMAX(
        series,
        order=(1, 1, 1),
        seasonal_order=(1, 1, 1, 12),
        enforce_stationarity=False,
        enforce_invertibility=False,
    )

    results = model.fit(disp=False)

    forecast_res = results.get_forecast(steps=periods)
    forecast_mean = forecast_res.predicted_mean
    conf_int = forecast_res.conf_int()

    # Month-end future dates
    forecast_dates = pd.date_range(
        start=series.index[-1] + pd.offsets.MonthEnd(1),
        periods=periods,
        freq="ME",
    )

    forecast_df = pd.DataFrame({
        "date": forecast_dates,
        "forecast": forecast_mean.values.astype(float),
        "lower": conf_int.iloc[:, 0].values.astype(float),
        "upper": conf_int.iloc[:, 1].values.astype(float),
    })

    return forecast_df
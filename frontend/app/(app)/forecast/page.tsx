"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
  Line,
  Legend,
} from "recharts";
import { CalendarDays, TrendingUp } from "lucide-react";
import {
  buildApiUrl,
  getErrorMessageFromResponse,
  getAccessToken,
  getDefaultAccountId,
  setStoredAccountId,
} from "@/lib/api";

type ForecastPoint = {
  date: string;      // e.g. "2026-02" or "2026-02-01"
  actual?: number;   // actual balance (historical)
  forecast?: number; // predicted balance (future)
  lower?: number;    // lower confidence bound
  upper?: number;    // upper confidence bound
};

type ForecastResponse = {
  horizon_months: number;
  predicted_balance: number;  // forecasted end balance
  expected_growth: number;    // predicted_balance - last_actual_balance
  history_months?: number;
  forecast_method?: string;
  forecast_method_label?: string;
  forecast_confidence?: "Low" | "Medium" | "High" | string;
  forecast_reliability_note?: string;
  points: ForecastPoint[];
};

const PERIODS = [
  { label: "3 Months", months: 3 },
  { label: "6 Months", months: 6 },
  { label: "1 Year", months: 12 },
];

function parseForecastMonthLabel(value: string) {
  const normalized = `${value}-01`;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatForecastAxisLabel(value: string) {
  const date = parseForecastMonthLabel(value);
  if (!date) {
    return value;
  }

  return date.toLocaleString("en-GB", {
    month: "short",
    year: "2-digit",
  });
}

function formatForecastTooltipLabel(value: string) {
  const date = parseForecastMonthLabel(value);
  if (!date) {
    return value;
  }

  return date.toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

export default function ForecastPage() {
  const [months, setMonths] = useState<number>(6);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [data, setData] = useState<ForecastResponse | null>(null);

  // ---- Load forecast from backend ----
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");

      const token = getAccessToken();
      if (!token) {
        window.location.href = "/login";
        return;
      }

      try {
        const accountId = await getDefaultAccountId();
        if (!accountId) {
          setData(null);
          setLoading(false);
          return;
        }

        setStoredAccountId(accountId);

        const forecastRes = await fetch(
          buildApiUrl(`/forecast/balance?account_id=${accountId}&horizon_months=${months}`),
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!forecastRes.ok) {
          throw new Error(
            await getErrorMessageFromResponse(
              forecastRes,
              "Unable to load forecast for this account.",
            ),
          );
        }

        const json: ForecastResponse = await forecastRes.json();
        setData(json);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load forecast");
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [months]);

  const chartData = useMemo(() => {
    return data?.points ?? [];
  }, [data]);

  const hasNoTransactionHistory =
    error.includes("No transactions found for this account") ||
    error.includes('"detail":"No transactions found for this account"');

  const periodTitle = useMemo(() => {
    if (months === 3) return "Next 3 Months";
    if (months === 6) return "Next 6 Months";
    return "Next 12 Months";
  }, [months]);

  if (loading) {
    return <div className="p-8 text-white">Loading forecast...</div>;
  }

  if (error && !hasNoTransactionHistory) {
    return (
      <div className="p-8 text-white">
        <h1 className="text-2xl font-semibold">Financial Forecast</h1>
        <p className="mt-3 text-red-400">{error}</p>
        <p className="mt-2 text-gray-400 text-sm">
          If you just uploaded transactions, refresh once. If it still fails, your backend forecast endpoint
          is missing or returning an error.
        </p>
      </div>
    );
  }

  // no account / no data
  if (hasNoTransactionHistory || !data || !chartData.length) {
    return (
      <div className="text-white">
        <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-4xl font-bold">Financial Forecast</h1>
              <p className="text-gray-400 mt-2">
                Projected future balance from your uploaded statement history
              </p>
            </div>
        </div>

        <div className="mt-10 rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-8">
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/70">
            Forecast unavailable until transaction history is uploaded
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-white">
            Add transactions to generate monthly balance forecasts
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
            Upload transactions first so SmartSpend can learn your monthly patterns and
            generate a forecast for this account.
          </p>
          <div className="mt-6">
            <Link
              href="/transactions"
              className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              Upload Transactions
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const predictedBalance = data.predicted_balance ?? 0;
  const expectedGrowth = data.expected_growth ?? 0;
  const hasLimitedHistory = (data.history_months ?? 0) > 0 && (data.history_months ?? 0) < 6;
  const isFallbackForecast = data.forecast_method !== "sarimax";

  return (
    <div className="text-white space-y-8">
      {/* Header + period toggle */}
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-4xl font-bold">Financial Forecast</h1>
          <p className="text-gray-400 mt-2">
            Projected future balance from your uploaded statement history
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="bg-[#0f1b33] border border-[#1f2c4d] rounded-xl p-1 flex gap-1">
            {PERIODS.map((p) => (
              <button
                key={p.months}
                onClick={() => setMonths(p.months)}
                className={`px-4 py-2 rounded-lg text-sm transition ${
                  months === p.months
                    ? "bg-green-500 text-black font-semibold"
                    : "text-gray-300 hover:bg-white/5"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI cards row */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-[#0f1b33] p-6 rounded-2xl border border-[#1f2c4d]">
          <div className="flex items-center gap-2 text-gray-300">
            <CalendarDays size={18} />
            <p className="text-sm">Forecast Period</p>
          </div>
          <p className="text-2xl font-semibold mt-3">{periodTitle}</p>
        </div>

        <div className="bg-[#0f1b33] p-6 rounded-2xl border border-[#1f2c4d]">
          <p className="text-gray-300 text-sm">Predicted Balance</p>
          <p className="text-3xl font-semibold mt-3">
            £{predictedBalance.toLocaleString()}
          </p>
        </div>

        <div className="bg-[#0f1b33] p-6 rounded-2xl border border-[#1f2c4d]">
          <div className="flex items-center justify-between">
            <p className="text-gray-300 text-sm">Expected Growth</p>
            <TrendingUp size={18} className="text-green-400" />
          </div>
          <p className={`text-3xl font-semibold mt-3 ${expectedGrowth >= 0 ? "text-green-400" : "text-red-400"}`}>
            {expectedGrowth >= 0 ? "+" : "-"}£{Math.abs(expectedGrowth).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Chart card */}
      <div className="bg-[#0f1b33] p-6 rounded-2xl border border-[#1f2c4d]">
        <h2 className="mb-4 font-semibold">Projected Balance Over Time</h2>
        <p className="mb-4 text-sm text-slate-400">
          Forecasts are estimated from monthly closing balances for your account.
        </p>
        {hasLimitedHistory || isFallbackForecast ? (
          <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            {data.forecast_reliability_note || "This forecast is using a simplified fallback model because the account history is limited or unstable."}
          </div>
        ) : data.forecast_reliability_note ? (
          <div className="mb-4 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">
            {data.forecast_reliability_note}
          </div>
        ) : null}

        <div className="h-[420px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                {/* Confidence band fill */}
                <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.05} />
                </linearGradient>

                {/* Actual fill */}
                <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.30} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0.00} />
                </linearGradient>
              </defs>

              <CartesianGrid stroke="#1f2c4d" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  interval={1}
                  tickFormatter={formatForecastAxisLabel}
                />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  background: "#0a1428",
                  border: "1px solid #1f2c4d",
                  borderRadius: 12,
                  color: "white",
                }}
                labelFormatter={(label) => formatForecastTooltipLabel(String(label ?? ""))}
                formatter={(value: number | string | undefined) => [`£${Number(value ?? 0).toLocaleString()}`, ""]}
              />
              <Legend />

              {/* Confidence band: draw upper + lower area */}
              <Area
                type="monotone"
                dataKey="upper"
                stroke="transparent"
                fill="url(#bandFill)"
                name="Confidence Band"
              />
              <Area
                type="monotone"
                dataKey="lower"
                stroke="transparent"
                fill="#0f1b33" // cut out lower portion so it looks like a band
                name=" "
              />

              {/* Actual history */}
              <Area
                type="monotone"
                dataKey="actual"
                stroke="#22c55e"
                fill="url(#actualFill)"
                name="Actual"
                connectNulls
              />

              {/* Forecast line */}
              <Line
                type="monotone"
                dataKey="forecast"
                stroke="#38bdf8"
                strokeWidth={2}
                strokeDasharray="6 6"
                dot={false}
                name="Forecast"
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <p className="text-xs text-gray-400 mt-3">
          SmartSpend chooses between SARIMAX and a simpler cash-flow trend depending on how much stable history is available.
        </p>
      </div>
    </div>
  );
}


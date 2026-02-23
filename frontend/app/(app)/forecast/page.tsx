"use client";

import { useEffect, useMemo, useState } from "react";
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
  points: ForecastPoint[];
};

const PERIODS = [
  { label: "3 Months", months: 3 },
  { label: "6 Months", months: 6 },
  { label: "1 Year", months: 12 },
];

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

      const token = localStorage.getItem("token");
      if (!token) {
        window.location.href = "/login";
        return;
      }

      try {
        // 1) get accounts -> pick first one (your "Main Account")
        const accountsRes = await fetch("http://127.0.0.1:8000/accounts/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!accountsRes.ok) throw new Error("Failed to load accounts");
        const accounts = await accountsRes.json();

        if (!accounts?.length) {
          setData(null);
          setLoading(false);
          return;
        }

        const accountId = accounts[0].id;

        // 2) get forecast
        // IMPORTANT: this expects a backend endpoint:
        // GET /forecast/balance?account_id=1&horizon_months=6
        const forecastRes = await fetch(
          `http://127.0.0.1:8000/forecast/balance?account_id=${accountId}&horizon_months=${months}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!forecastRes.ok) {
          const msg = await forecastRes.text();
          throw new Error(msg || "Forecast API failed");
        }

        const json: ForecastResponse = await forecastRes.json();
        setData(json);
      } catch (e: any) {
        setError(e?.message || "Failed to load forecast");
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

  const periodTitle = useMemo(() => {
    if (months === 3) return "Next 3 Months";
    if (months === 6) return "Next 6 Months";
    return "Next 12 Months";
  }, [months]);

  if (loading) {
    return <div className="p-8 text-white">Loading forecast...</div>;
  }

  if (error) {
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
  if (!data || !chartData.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#050816] via-[#0a1124] to-[#050816] text-white p-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-4xl font-bold">Financial Forecast</h1>
            <p className="text-gray-400 mt-2">
              Predicted balance using time-series analysis (SARIMAX)
            </p>
          </div>
        </div>

        <div className="mt-10 bg-[#0f1b33] border border-[#1f2c4d] rounded-2xl p-6">
          <p className="text-gray-300">
            No transaction history found. Upload a CSV first to generate a forecast.
          </p>
        </div>
      </div>
    );
  }

  const predictedBalance = data.predicted_balance ?? 0;
  const expectedGrowth = data.expected_growth ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050816] via-[#0a1124] to-[#050816] text-white p-8 space-y-8">
      {/* Header + period toggle */}
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-4xl font-bold">Financial Forecast</h1>
          <p className="text-gray-400 mt-2">
            Predicted balance using time-series analysis (SARIMAX)
          </p>
        </div>

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
        <h2 className="mb-4 font-semibold">Predicted Balance Over Time</h2>

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
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  background: "#0a1428",
                  border: "1px solid #1f2c4d",
                  borderRadius: 12,
                  color: "white",
                }}
                formatter={(v: any) => [`£${Number(v).toLocaleString()}`, ""]}
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
          Tip: If the user uploads only 1–2 months of transactions, the backend should still return a forecast,
          but with wider confidence bounds.
        </p>
      </div>
    </div>
  );
}
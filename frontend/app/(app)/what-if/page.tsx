"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
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
  ReferenceLine,
} from "recharts";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  buildApiUrl,
  getAccessToken,
  getDefaultAccountId,
  setStoredAccountId,
} from "@/lib/api";

type WhatIfCategory = {
  category: string;
  label: string;
  monthly_amount: number;
  adjustment_pct: number;
};

type WhatIfPoint = {
  date: string;
  baseline: number;
  adjusted: number;
};

type WhatIfSummary = {
  monthly_change: number;
  horizon_impact: number;
  baseline_end_balance: number;
  adjusted_end_balance: number;
};

type WhatIfResponse = {
  horizon_months: number;
  current_balance: number;
  categories: WhatIfCategory[];
  points: WhatIfPoint[];
  summary: WhatIfSummary;
  debug_month_count_used?: number;
};

const HORIZON_OPTIONS = [
  { label: "3 Months", value: 3 },
  { label: "6 Months", value: 6 },
  { label: "12 Months", value: 12 },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatMonthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) {
    return value;
  }

  return new Date(year, month - 1, 1).toLocaleDateString("en-GB", {
    month: "short",
  });
}

function renderForecastTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: WhatIfPoint }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload;
  if (!point) {
    return null;
  }

  return (
    <div
      style={{
        backgroundColor: "#0f172a",
        border: "1px solid #1f2c4d",
        borderRadius: 18,
        color: "#e2e8f0",
        padding: "16px 18px",
        boxShadow: "0 10px 30px rgba(2, 6, 23, 0.35)",
      }}
    >
      <p className="text-2xl font-medium text-white">
        {formatMonthLabel(String(label ?? point.date))}
      </p>
      <div className="mt-3 space-y-2 text-lg">
        <p className="text-slate-300">Baseline : {formatCurrency(point.baseline)}</p>
        <p className="text-emerald-400">Adjusted : {formatCurrency(point.adjusted)}</p>
      </div>
    </div>
  );
}

export default function WhatIfPage() {
  const [months, setMonths] = useState(6);
  const [simulation, setSimulation] = useState<WhatIfResponse | null>(null);
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSimulation = useEffectEvent(async () => {
    setLoading(true);
    setError("");

    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }

    const accountId = await getDefaultAccountId();
    if (!accountId) {
      setSimulation(null);
      setError("No account available. Sign in again or upload transactions first.");
      setLoading(false);
      return;
    }

    setStoredAccountId(accountId);

    try {
      const response = await fetch(buildApiUrl("/forecast/what-if"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          account_id: accountId,
          horizon_months: months,
          adjustments: Object.entries(adjustments).map(([category, change_pct]) => ({
            category,
            change_pct,
          })),
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Unable to run simulation.");
      }

      const data = (await response.json()) as WhatIfResponse;
      setSimulation(data);
      setAdjustments((current) => {
        let changed = false;
        const next = { ...current };
        for (const category of data.categories) {
          if (!(category.category in next)) {
            next[category.category] = 0;
            changed = true;
          }
        }
        return changed ? next : current;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to run simulation.";
      setSimulation(null);
      setError(message);
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSimulation();
    }, 120);

    return () => window.clearTimeout(timeoutId);
  }, [adjustments, months]);

  function handleAdjustmentChange(category: string, value: number) {
    setAdjustments((current) => ({
      ...current,
      [category]: value,
    }));
  }

  function resetAdjustments() {
    setAdjustments((current) =>
      Object.fromEntries(Object.keys(current).map((category) => [category, 0])),
    );
  }

  const chartData = useMemo(() => simulation?.points ?? [], [simulation]);
  const categories = simulation?.categories ?? [];
  const summary = simulation?.summary;
  const hasActiveAdjustments = Object.values(adjustments).some((value) => value !== 0);
  const activeComparisonDate = chartData.length > 1 ? chartData[1].date : chartData[0]?.date;
  const hasAdjustableCategories = categories.length > 0;

  if (loading && !simulation) {
    return <div className="p-8 text-white">Loading What-If simulator...</div>;
  }

  if (error && !simulation) {
    return (
      <div className="p-8 text-white">
        <h1 className="text-3xl font-semibold">What-If Simulator</h1>
        <p className="mt-3 max-w-2xl text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-white">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold">What-If Simulator</h1>
          <p className="mt-2 text-gray-400">
            Estimate how changing recent spending patterns could affect your forecasted balance.
          </p>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">
            This simulation uses your recent category spending and the current forecast baseline.
            It is a planning estimate, not a guaranteed prediction.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="rounded-xl border border-[#1f2c4d] bg-[#0f1b33] p-1">
            {HORIZON_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setMonths(option.value)}
                className={`rounded-lg px-4 py-2 text-sm transition ${
                  months === option.value
                    ? "bg-emerald-500 text-slate-950 font-semibold"
                    : "text-slate-300 hover:bg-white/5"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button
            onClick={resetAdjustments}
            disabled={!hasActiveAdjustments}
            className="inline-flex items-center gap-2 rounded-xl border border-[#1f2c4d] bg-[#0f1b33] px-4 py-3 text-sm text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw size={16} />
            Reset
          </button>
        </div>
      </div>

      {simulation ? (
        <div className="grid gap-8 xl:grid-cols-[1.05fr_1.55fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] p-6">
              <div className="flex items-center gap-3">
                <SlidersHorizontal size={18} className="text-emerald-400" />
                <h2 className="text-xl font-semibold">Adjust Spending</h2>
              </div>
              <p className="mt-2 text-sm text-slate-400">
                Monthly amounts are estimated from recent saved expense history for your account.
              </p>
              {simulation.debug_month_count_used ? (
                <p className="mt-2 text-xs text-slate-500">
                  Based on {simulation.debug_month_count_used} recent expense month
                  {simulation.debug_month_count_used === 1 ? "" : "s"}.
                </p>
              ) : null}

              {hasAdjustableCategories ? (
                <div className="mt-6 space-y-6">
                  {categories.map((category) => {
                    const sliderValue = adjustments[category.category] ?? 0;

                    return (
                      <div key={category.category}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-lg font-medium text-white">{category.label}</p>
                            <p className="mt-1 text-sm text-slate-400">
                              {formatCurrency(category.monthly_amount)} / month
                            </p>
                          </div>
                          <p className="text-sm font-medium text-cyan-200">
                            {sliderValue > 0 ? `+${sliderValue}%` : `${sliderValue}%`}
                          </p>
                        </div>

                        <input
                          type="range"
                          min={-50}
                          max={50}
                          step={1}
                          value={sliderValue}
                          onChange={(event) =>
                            handleAdjustmentChange(category.category, Number(event.target.value))
                          }
                          className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-[#1b2434] accent-emerald-400"
                        />

                        <div className="mt-2 flex items-center justify-between text-sm text-slate-500">
                          <span>-50%</span>
                          <span>+50%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-6 rounded-xl border border-[#1f2c4d] bg-[#091326] px-4 py-4 text-sm text-slate-400">
                  No recent adjustable spending categories were found for this account yet.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] p-6">
              <h2 className="text-xl font-semibold">Impact Summary</h2>

              <div className="mt-5 space-y-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-400">Estimated monthly balance change</span>
                  <span
                    className={`font-semibold ${
                      (summary?.monthly_change ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {formatCurrency(summary?.monthly_change ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-400">{months}-month estimated impact</span>
                  <span
                    className={`font-semibold ${
                      (summary?.horizon_impact ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {formatCurrency(summary?.horizon_impact ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-400">Baseline end balance</span>
                  <span className="font-semibold text-white">
                    {formatCurrency(summary?.baseline_end_balance ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-400">Adjusted end balance</span>
                  <span className="font-semibold text-cyan-200">
                    {formatCurrency(summary?.adjusted_end_balance ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] p-6">
            <h2 className="text-xl font-semibold">Simulated Forecast Comparison</h2>
            <p className="mt-2 text-sm text-slate-400">
              Baseline forecast versus a simulated scenario using your slider adjustments.
            </p>

            <div className="mt-6 h-[520px] rounded-2xl border border-[#16284a] bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_42%),linear-gradient(180deg,_rgba(5,14,35,0.78),_rgba(3,10,24,0.96))] p-5">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="adjustedFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid stroke="#1f2c4d" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#94a3b8"
                    tickFormatter={formatMonthLabel}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tickFormatter={(value: number) => `£${(value / 1000).toFixed(1)}k`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={renderForecastTooltip} />
                  <Legend
                    formatter={(value) => (
                      <span className={value === "baseline" ? "text-slate-400" : "text-emerald-400"}>
                        {value === "baseline" ? "Baseline" : "Adjusted"}
                      </span>
                    )}
                  />
                  {activeComparisonDate ? (
                    <ReferenceLine x={activeComparisonDate} stroke="#e2e8f0" strokeOpacity={0.8} />
                  ) : null}

                  <Line
                    type="monotone"
                    dataKey="baseline"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    strokeDasharray="6 6"
                    dot={{ r: 3, fill: "#94a3b8", strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "#94a3b8", stroke: "#e2e8f0", strokeWidth: 2 }}
                    name="baseline"
                  />
                  <Area
                    type="monotone"
                    dataKey="adjusted"
                    stroke="transparent"
                    fill="url(#adjustedFill)"
                    fillOpacity={1}
                    legendType="none"
                    name="adjusted-fill"
                  />
                  <Line
                    type="monotone"
                    dataKey="adjusted"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: "#10b981", stroke: "#ecfeff", strokeWidth: 3 }}
                    name="adjusted"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : null}

      {loading && simulation ? (
        <div className="rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] px-4 py-3 text-sm text-slate-400">
          Recalculating simulation...
        </div>
      ) : null}

      {error && simulation ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      ) : null}
    </div>
  );
}

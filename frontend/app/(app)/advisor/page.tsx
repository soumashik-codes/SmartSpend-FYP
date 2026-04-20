"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  Info,
  Lightbulb,
  MessageSquareText,
  Radar,
  Repeat,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  buildApiUrl,
  getErrorMessageFromResponse,
  getAccessToken,
  getDefaultAccountId,
  setStoredAccountId,
} from "@/lib/api";

type AdvisorScore = {
  value: number;
  label: string;
  message: string;
  reasons: string[];
};

type AdvisorNarrative = {
  summary: string;
  source: string;
};

type AdvisorHighlight = {
  kind: "warning" | "positive" | "info";
  title: string;
  detail: string;
  metric_label?: string | null;
  metric_value?: string | null;
};

type AdvisorStats = {
  current_month: string | null;
  current_month_expenses: number;
  average_monthly_expenses: number;
  savings_rate_pct: number;
  savings_rate_month: string | null;
  unusual_transaction_count: number;
  recurring_monthly_total: number;
  recurring_charge_count: number;
  analysis_months: number;
  recent_period_months: number;
};

type AdvisorCategory = {
  category: string;
  total: number;
  change_pct: number;
  recent_average: number;
};

type AdvisorMerchant = {
  merchant: string;
  total: number;
  transaction_count: number;
};

type AdvisorCategoryDrilldown = {
  category: string;
  recent_average: number;
  previous_average: number;
  change_pct: number;
  recent_total: number;
  share_pct: number;
  top_merchants: AdvisorMerchant[];
};

type AdvisorRecurringCharge = {
  merchant: string;
  average_amount: number;
  transaction_count: number;
  latest_date: string;
  category: string;
  cadence_label: string;
};

type AdvisorAnomaly = {
  id: number;
  date: string;
  description: string;
  amount: number;
  category: string;
  reasons: string[];
};

type AdvisorSummary = {
  account_id: number;
  account_name: string;
  score: AdvisorScore;
  narrative: AdvisorNarrative;
  highlights: AdvisorHighlight[];
  recommendations: string[];
  stats: AdvisorStats;
  top_categories: AdvisorCategory[];
  recurring_charges: AdvisorRecurringCharge[];
  category_drilldowns: AdvisorCategoryDrilldown[];
  recent_anomalies: AdvisorAnomaly[];
};

const highlightStyles: Record<
  AdvisorHighlight["kind"],
  {
    border: string;
    bg: string;
    iconWrap: string;
    icon: typeof AlertTriangle;
    iconColor: string;
  }
> = {
  warning: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/6",
    iconWrap: "bg-amber-500/10",
    icon: AlertTriangle,
    iconColor: "text-amber-300",
  },
  positive: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/6",
    iconWrap: "bg-emerald-500/10",
    icon: CheckCircle2,
    iconColor: "text-emerald-300",
  },
  info: {
    border: "border-sky-500/30",
    bg: "bg-sky-500/6",
    iconWrap: "bg-sky-500/10",
    icon: Info,
    iconColor: "text-sky-300",
  },
};

function formatCurrency(value: number) {
  return `GBP ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatMonth(value: string | null) {
  if (!value) {
    return "Latest available month";
  }

  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, 1);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

function humanizeEmbeddedMonths(text: string) {
  return text.replace(/\b(\d{4}-\d{2})\b/g, (match) => formatMonth(match));
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function scoreTone(score: number) {
  if (score >= 85) {
    return {
      ring: "from-emerald-400 to-teal-300",
      glow: "shadow-[0_0_40px_rgba(16,185,129,0.22)]",
      text: "text-emerald-300",
    };
  }

  if (score >= 70) {
    return {
      ring: "from-emerald-400 to-cyan-300",
      glow: "shadow-[0_0_40px_rgba(45,212,191,0.18)]",
      text: "text-emerald-300",
    };
  }

  if (score >= 55) {
    return {
      ring: "from-amber-400 to-orange-300",
      glow: "shadow-[0_0_40px_rgba(245,158,11,0.18)]",
      text: "text-amber-300",
    };
  }

  return {
    ring: "from-rose-400 to-red-300",
    glow: "shadow-[0_0_40px_rgba(251,113,133,0.18)]",
    text: "text-rose-300",
  };
}

function changeTone(value: number) {
  if (value > 0) {
    return {
      icon: ArrowUpRight,
      text: "text-rose-300",
      bg: "bg-rose-500/10",
      border: "border-rose-500/20",
      label: `+${value.toFixed(0)}%`,
    };
  }

  if (value < 0) {
    return {
      icon: ArrowDownRight,
      text: "text-emerald-300",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      label: `${value.toFixed(0)}%`,
    };
  }

  return {
    icon: TrendingUp,
    text: "text-slate-300",
    bg: "bg-slate-500/10",
    border: "border-slate-500/20",
    label: "0%",
  };
}

export default function AdvisorPage() {
  const [data, setData] = useState<AdvisorSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadAdvisor() {
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

        const res = await fetch(buildApiUrl(`/advisor/summary?account_id=${accountId}`), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error(
            await getErrorMessageFromResponse(res, "Failed to load advisor insights."),
          );
        }

        const json: AdvisorSummary = await res.json();
        setData(json);
      } catch (loadError) {
        console.error("Advisor load error:", loadError);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load advisor insights."
        );
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    loadAdvisor();
  }, []);

  const scoreVisual = useMemo(() => scoreTone(data?.score.value ?? 0), [data?.score.value]);

  if (loading) {
    return <div className="p-8 text-white">Loading advisor...</div>;
  }

  if (error) {
    return (
      <section className="space-y-6 text-white">
        <div>
          <h1 className="text-4xl font-bold">Financial Advisor</h1>
          <p className="mt-2 text-slate-400">
            Personalized financial suggestions powered by your uploaded transaction history.
          </p>
        </div>

        <div className="rounded-3xl border border-rose-500/25 bg-rose-500/8 p-6">
          <p className="text-lg font-semibold text-rose-200">Advisor data could not be loaded</p>
          <p className="mt-2 text-sm text-rose-100/80">{error}</p>
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="space-y-6 text-white">
        <div>
          <h1 className="text-4xl font-bold">Financial Advisor</h1>
          <p className="mt-2 text-slate-400">
            Personalized financial suggestions powered by your uploaded transaction history.
          </p>
        </div>

        <div className="rounded-3xl border border-[#1f2c4d] bg-[#0f1b33] p-6">
          <p className="text-lg font-semibold text-white">No account data found</p>
          <p className="mt-2 text-sm text-slate-400">
            Upload transactions first so the advisor can compare months, detect recurring payments, and explain unusual spending.
          </p>
        </div>
      </section>
    );
  }

  if (data.stats.analysis_months === 0) {
    return (
      <section className="space-y-6 text-white">
        <div>
          <h1 className="text-4xl font-bold">Financial Advisor</h1>
          <p className="mt-2 text-slate-400">
            Personalized financial suggestions powered by your uploaded transaction history.
          </p>
        </div>

        <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-8">
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/70">
            Advisor insights need real transaction history
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-white">
            Upload transactions to activate Financial Advisor
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
            Once you upload transactions, Financial Advisor can generate financial
            health insights, recurring-payment detection, unusual spending explanations,
            and personalized recommendations.
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
      </section>
    );
  }

  return (
    <section className="space-y-8 text-white">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold">Financial Advisor</h1>
          <p className="mt-2 text-slate-400">
            Real analysis for {data.account_name} based on {data.stats.analysis_months} months of uploaded transactions.
          </p>
          <p className="mt-2 text-xs leading-6 text-slate-500">
            Transaction-pattern guidance for budgeting and review only, not regulated financial advice or a guarantee of future outcomes.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
          <Sparkles size={16} />
          Live insights from your transaction history
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="min-w-0 rounded-[28px] border border-[#1f2c4d] bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_34%),linear-gradient(180deg,_rgba(15,27,51,0.98),_rgba(8,20,39,0.98))] p-6 md:p-8">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] xl:items-start">
            <div className="min-w-0">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className={`relative flex h-28 w-28 items-center justify-center rounded-full bg-[#081427] ${scoreVisual.glow}`}>
                <div className={`absolute inset-0 rounded-full bg-gradient-to-br ${scoreVisual.ring} opacity-90`} />
                <div className="absolute inset-[4px] rounded-full bg-[#081427]" />
                <div className="relative text-center">
                  <div className="text-4xl font-semibold">{data.score.value}</div>
                  <div className={`mt-1 text-xs uppercase tracking-[0.25em] ${scoreVisual.text}`}>
                    Score
                  </div>
                </div>
              </div>

                <div className="min-w-0 flex-1">
                <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Financial Health</p>
                <h2 className="mt-2 text-3xl font-semibold">{data.score.label}</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">{data.score.message}</p>
                </div>
              </div>
              </div>

            <div className="min-w-0">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {data.score.reasons.map((reason) => (
                <div
                  key={reason}
                  className="min-w-0 rounded-2xl border border-[#21304f] bg-[#0a1428]/90 px-4 py-3 text-sm leading-6 text-slate-300"
                >
                  {humanizeEmbeddedMonths(reason)}
                </div>
              ))}
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0 rounded-3xl border border-[#1f2c4d] bg-[#0f1b33] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Financial Summary</h2>
              <p className="mt-1 text-sm text-slate-400">
                A concise summary of the strongest recent account patterns.
              </p>
            </div>
            <div className="rounded-2xl bg-cyan-500/10 p-3">
              <MessageSquareText size={18} className="text-cyan-300" />
            </div>
          </div>

          <p className="mt-5 text-sm leading-7 text-slate-200">
            {humanizeEmbeddedMonths(data.narrative.summary)}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {data.narrative.source === "llm" ? (
              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
                AI-assisted explanation
              </span>
            ) : null}
            <span className="rounded-full border border-[#21304f] bg-[#081427] px-3 py-1 text-xs text-slate-300">
              Recent window: {data.stats.recent_period_months} months
            </span>
            <span className="rounded-full border border-[#21304f] bg-[#081427] px-3 py-1 text-xs text-slate-300">
              Latest month: {formatMonth(data.stats.current_month)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] p-5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-sm">Latest Month Spend</span>
            <Wallet size={18} />
          </div>
          <p className="mt-4 text-2xl font-semibold">{formatCurrency(data.stats.current_month_expenses)}</p>
          <p className="mt-2 text-sm text-slate-400">{formatMonth(data.stats.current_month)}</p>
        </div>

        <div className="rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] p-5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-sm">Average Monthly Spend</span>
            <TrendingUp size={18} />
          </div>
          <p className="mt-4 text-2xl font-semibold">{formatCurrency(data.stats.average_monthly_expenses)}</p>
          <p className="mt-2 text-sm text-slate-400">Trailing 6-month average</p>
        </div>

        <div className="rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] p-5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-sm">Savings Rate</span>
            <CircleDollarSign size={18} />
          </div>
          <p className="mt-4 text-2xl font-semibold">{Number(data.stats.savings_rate_pct).toFixed(1)}%</p>
          <p className="mt-2 text-sm text-slate-400">
            {data.stats.savings_rate_month
              ? `Based on ${formatMonth(data.stats.savings_rate_month)}`
              : "No income month available yet"}
          </p>
        </div>

        <div className="rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] p-5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-sm">Recurring Payments</span>
            <Repeat size={18} />
          </div>
          <p className="mt-4 text-2xl font-semibold">{formatCurrency(data.stats.recurring_monthly_total)}</p>
          <p className="mt-2 text-sm text-slate-400">
            {data.stats.recurring_charge_count} recurring payments detected
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {data.highlights.map((highlight) => {
          const style = highlightStyles[highlight.kind];
          const Icon = style.icon;

          return (
            <article
              key={`${highlight.kind}-${highlight.title}`}
              className={`rounded-3xl border ${style.border} ${style.bg} p-5 md:p-6`}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex gap-4">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${style.iconWrap}`}>
                    <Icon size={20} className={style.iconColor} />
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-white">{highlight.title}</h3>
                    <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
                      {humanizeEmbeddedMonths(highlight.detail)}
                    </p>
                  </div>
                </div>

                {highlight.metric_label && highlight.metric_value ? (
                  <div className="rounded-2xl border border-white/8 bg-[#081427]/80 px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{highlight.metric_label}</p>
                    <p className="mt-2 text-base font-semibold text-white">{highlight.metric_value}</p>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-[#1f2c4d] bg-[#0f1b33] p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-500/10 p-3">
                <Lightbulb size={18} className="text-emerald-300" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Recommendations</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Suggested next actions based on your recent uploaded transaction patterns.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {data.recommendations.map((recommendation) => (
                <div
                  key={recommendation}
                  className="flex items-start gap-3 rounded-2xl border border-[#21304f] bg-[#081427] px-4 py-4"
                >
                  <div className="mt-0.5 rounded-full bg-emerald-500/10 p-1.5">
                    <Lightbulb size={14} className="text-emerald-300" />
                  </div>
                  <p className="text-sm leading-6 text-slate-200">
                    {humanizeEmbeddedMonths(recommendation)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-[#1f2c4d] bg-[#0f1b33] p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-sky-500/10 p-3">
                <Radar size={18} className="text-sky-300" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Category Drilldowns</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Recent category averages compared with the previous period, plus the main merchants behind each one.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {data.category_drilldowns.length > 0 ? (
                data.category_drilldowns.map((row) => {
                  const tone = changeTone(row.change_pct);
                  const ChangeIcon = tone.icon;

                  return (
                    <div key={row.category} className="min-w-0 rounded-2xl border border-[#21304f] bg-[#081427] p-4">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="text-base font-semibold text-white">{row.category}</h3>
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${tone.border} ${tone.bg} ${tone.text}`}>
                              <ChangeIcon size={12} />
                              {tone.label}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-slate-400">
                            Recent monthly average {formatCurrency(row.recent_average)} against {formatCurrency(row.previous_average)} in the previous period.
                          </p>
                        </div>

                        <div className="rounded-2xl border border-[#21304f] bg-[#0d1730] px-4 py-3 text-right">
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Recent Share</p>
                          <p className="mt-2 text-base font-semibold text-white">{row.share_pct.toFixed(0)}%</p>
                        </div>
                      </div>

                      {row.top_merchants.length > 0 ? (
                        <div className="mt-4 grid gap-2">
                          {row.top_merchants.map((merchant) => (
                            <div
                              key={`${row.category}-${merchant.merchant}`}
                              className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[#1d2b48] bg-[#0d1730] px-3 py-2"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm text-slate-200">{merchant.merchant}</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {merchant.transaction_count} transactions
                                </p>
                              </div>
                              <p className="shrink-0 text-sm font-medium text-white">{formatCurrency(merchant.total)}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <p className="rounded-2xl border border-[#21304f] bg-[#081427] p-4 text-sm text-slate-400">
                  More expense history is needed before category drilldowns become meaningful.
                </p>
              )}
            </div>
          </div>
        </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-[#1f2c4d] bg-[#0f1b33] p-6">
              <h2 className="text-xl font-semibold">Top Spend Categories</h2>
              <p className="mt-1 text-sm text-slate-400">
                Largest categories across the recent analysis window.
              </p>

            <div className="mt-5 space-y-3">
              {data.top_categories.length > 0 ? (
                data.top_categories.map((category, index) => {
                  const tone = changeTone(category.change_pct);
                  const ChangeIcon = tone.icon;

                  return (
                    <div key={category.category} className="min-w-0 rounded-2xl border border-[#21304f] bg-[#081427] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/10 text-sm font-semibold text-sky-300">
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <span className="block truncate text-sm text-slate-200">{category.category}</span>
                            <div className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${tone.border} ${tone.bg} ${tone.text}`}>
                              <ChangeIcon size={10} />
                              {tone.label}
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-white">{formatCurrency(category.total)}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            Avg {formatCurrency(category.recent_average)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="rounded-2xl border border-[#21304f] bg-[#081427] p-4 text-sm text-slate-400">
                  No category data available yet.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-[#1f2c4d] bg-[#0f1b33] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Recurring Payments</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Charges with consistent merchant, amount, and timing patterns in your uploaded history.
                </p>
              </div>
              <Repeat size={18} className="text-slate-500" />
            </div>

            <div className="mt-5 space-y-3">
              {data.recurring_charges.length > 0 ? (
                data.recurring_charges.map((charge) => (
                  <div
                    key={`${charge.merchant}-${charge.latest_date}`}
                    className="min-w-0 rounded-2xl border border-[#21304f] bg-[#081427] p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-white">{charge.merchant}</p>
                        <p className="mt-1 text-sm text-slate-400">
                          {charge.transaction_count} payments, latest {formatDate(charge.latest_date)}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                          {charge.category} | {charge.cadence_label}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-white">{formatCurrency(charge.average_amount)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-[#21304f] bg-[#081427] p-4 text-sm text-slate-400">
                  No strong recurring-payment patterns were detected yet.
                </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

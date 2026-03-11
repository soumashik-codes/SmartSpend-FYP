"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { getDefaultAccountId } from "@/lib/api";

const COLORS = ["#f59e0b", "#8b5cf6", "#3b82f6", "#ef4444", "#22c55e"];

type Summary = {
  account_id: number;
  account_name: string;
  opening_balance: number;
  current_balance: number;
  total_income: number;
  total_expenses: number;
  transaction_count: number;
};

type BalancePoint = {
  date: string;
  balance: number;
};

type CategoryData = {
  category: string;
  total: number;
};

type CategoryBreakdown = CategoryData & {
  percentage: number;
};

function formatMonth(monthStr: string) {
  const [year, month] = monthStr.split("-")

  const date = new Date(Number(year), Number(month) - 1)

  return date.toLocaleString("en-GB", {
    month: "short",
    year: "numeric",
  })
}

function formatShortDate(dateStr: string) {
  const date = new Date(dateStr)

  if (Number.isNaN(date.getTime())) {
    return dateStr
  }

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
  })
}

type MonthlySummary = {
  month: string;
  income: number;
  expenses: number;
  net: number;
};

type TimeRange = "this_month" | "last_3_months" | "last_6_months" | "last_12_months" | "all_time";

type SummaryView = {
  current_balance: number;
  total_income: number;
  total_expenses: number;
  transaction_count: number;
};

const TIME_RANGE_OPTIONS: Array<{ value: TimeRange; label: string }> = [
  { value: "this_month", label: "This Month" },
  { value: "last_3_months", label: "Last 3 Months" },
  { value: "last_6_months", label: "Last 6 Months" },
  { value: "last_12_months", label: "Last 12 Months" },
  { value: "all_time", label: "All Time" },
];

function formatDateParam(date: Date) {
  return date.toISOString().slice(0, 10);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getRangeParams(range: TimeRange, anchorDate: Date) {
  if (range === "all_time") {
    return { startDate: null, endDate: null };
  }

  const endDate = formatDateParam(endOfMonth(anchorDate));
  let startDate = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);

  if (range === "last_3_months") {
    startDate = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - 2, 1);
  } else if (range === "last_6_months") {
    startDate = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - 5, 1);
  } else if (range === "last_12_months") {
    startDate = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - 11, 1);
  }

  return {
    startDate: formatDateParam(startDate),
    endDate,
  };
}

function getLatestAvailableDate(data: MonthlySummary[]) {
  if (!data.length) {
    return new Date();
  }

  const latestMonth = [...data]
    .map((row) => row.month)
    .sort()
    .at(-1);

  if (!latestMonth) {
    return new Date();
  }

  const [year, month] = latestMonth.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function filterMonthlySummaryByRange(
  data: MonthlySummary[],
  range: TimeRange,
  anchorDate: Date
) {
  if (range === "all_time") {
    return data;
  }

  const { startDate } = getRangeParams(range, anchorDate);
  if (!startDate) {
    return data;
  }

  const startMonth = startDate.slice(0, 7);
  return data.filter((row) => row.month >= startMonth);
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [balanceData, setBalanceData] = useState<BalancePoint[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>("this_month");
  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      const token = localStorage.getItem("access_token");
      if (!token) {
        window.location.href = "/login";
        return;
      }

      try {
        // Get current user
        const meRes = await fetch(
          "http://127.0.0.1:8000/auth/me",
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const me = await meRes.json();
        setUserName(me.full_name?.split(" ")[0] || "User");

        // Get default account safely
        const accountId = await getDefaultAccountId();

        if (!accountId) {
          setSummary(null);
          setLoading(false);
          return;
        }

        const monthlyRes = await fetch(
          `http://127.0.0.1:8000/transactions/monthly-summary?account_id=${accountId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const monthlyData: MonthlySummary[] = await monthlyRes.json();
        const anchorDate = getLatestAvailableDate(monthlyData);
        const { startDate, endDate } = getRangeParams(timeRange, anchorDate);
        const querySuffix = new URLSearchParams({
          account_id: String(accountId),
          ...(startDate ? { start_date: startDate } : {}),
          ...(endDate ? { end_date: endDate } : {}),
        }).toString();

        // Fetch dashboard data
        const summaryRes = await fetch(
          `http://127.0.0.1:8000/transactions/summary?${querySuffix}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const balanceRes = await fetch(
          `http://127.0.0.1:8000/transactions/balance-history?${querySuffix}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const categoryRes = await fetch(
          `http://127.0.0.1:8000/transactions/by-category?${querySuffix}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!summaryRes.ok) {
          setSummary(null);
          setLoading(false);
          return;
        }

        setSummary(await summaryRes.json());
        setBalanceData(await balanceRes.json());
        setCategoryData(await categoryRes.json());
        setMonthlySummary(
          filterMonthlySummaryByRange(monthlyData, timeRange, anchorDate)
        );

      } catch (err) {
        console.error("Dashboard load error:", err);
        setSummary(null);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [timeRange]);

  if (loading) return <div className="p-8 text-white">Loading...</div>;
  if (!summary) return <div className="p-8 text-white">No account found.</div>;

  const totalCategorySpend = categoryData.reduce(
    (sum, item) => sum + Number(item.total || 0),
    0
  );

  const categoryBreakdown: CategoryBreakdown[] = [...categoryData]
    .map((item) => ({
      ...item,
      percentage: totalCategorySpend > 0
        ? Number(((item.total / totalCategorySpend) * 100).toFixed(1))
        : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="text-white space-y-10">
      {/* Dynamic Welcome */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
        <h1 className="text-4xl font-bold">
          Welcome back, {userName}
        </h1>
        <p className="text-gray-400 mt-2">
          Here’s your financial overview
        </p>
        </div>

        <div className="w-full max-w-xs">
          <label
            htmlFor="dashboard-range"
            className="mb-2 block text-sm font-medium text-slate-300"
          >
            View
          </label>
          <div className="relative">
            <select
              id="dashboard-range"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="w-full appearance-none rounded-xl border border-[#1f2c4d] bg-[#0f1b33] px-4 py-3 pr-10 text-sm text-white outline-none transition focus:border-cyan-400/60"
            >
              {TIME_RANGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400">
              ▼
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid md:grid-cols-4 gap-6">

        <div className="bg-[#0f1b33] p-6 rounded-2xl border border-[#1f2c4d]">
          <div className="flex justify-between">
            <p className="text-gray-400">Current Balance</p>
            <Wallet size={20} />
          </div>
          <p className="text-2xl mt-4">
            £{summary.current_balance.toLocaleString()}
          </p>
        </div>

        <div className="bg-[#0f1b33] p-6 rounded-2xl border border-[#1f2c4d]">
          <div className="flex justify-between">
            <p className="text-gray-400">Total Income</p>
            <TrendingUp className="text-green-400" size={20} />
          </div>
          <p className="text-2xl mt-4 text-green-400">
            £{summary.total_income.toLocaleString()}
          </p>
        </div>

        <div className="bg-[#0f1b33] p-6 rounded-2xl border border-[#1f2c4d]">
          <div className="flex justify-between">
            <p className="text-gray-400">Total Expenses</p>
            <TrendingDown className="text-red-400" size={20} />
          </div>
          <p className="text-2xl mt-4 text-red-400">
            £{summary.total_expenses.toLocaleString()}
          </p>
        </div>

        <div className="bg-[#0f1b33] p-6 rounded-2xl border border-[#1f2c4d]">
          <p className="text-gray-400">Transactions</p>
          <p className="text-2xl mt-4">
            {summary.transaction_count}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-8">

        <div className="bg-[#0f1b33] p-6 rounded-2xl border border-[#1f2c4d]">
          <h2 className="mb-4 font-semibold">Balance Trend</h2>

          <div className="rounded-2xl border border-[#16284a] bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.14),_transparent_40%),linear-gradient(180deg,_rgba(5,14,35,0.75),_rgba(3,10,24,0.95))] p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-200/65">
                  Current balance
                </p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  £{summary.current_balance.toLocaleString()}
                </p>
              </div>
              <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
                {balanceData.length} transactions
              </div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={balanceData}>
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1f2c4d" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  tickFormatter={formatShortDate}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(value: number) => [`£${Number(value).toLocaleString()}`, "Balance"]}
                  labelFormatter={(label: string) => formatShortDate(label)}
                  contentStyle={{
                    backgroundColor: "#081427",
                    border: "1px solid #1f2c4d",
                    borderRadius: "16px",
                    color: "#e2e8f0",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="#00f5d4"
                  strokeWidth={2.5}
                  fill="url(#colorBalance)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#0f1b33] p-6 rounded-2xl border border-[#1f2c4d]">
          <h2 className="mb-4 font-semibold">Spending by Category</h2>

          <div className="rounded-2xl border border-[#16284a] bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_45%),linear-gradient(180deg,_rgba(5,14,35,0.75),_rgba(3,10,24,0.95))] p-5">
            <div className="mx-auto max-w-[340px]">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={categoryBreakdown}
                    dataKey="total"
                    nameKey="category"
                    innerRadius={74}
                    outerRadius={118}
                    paddingAngle={2}
                    stroke="#dbeafe"
                    strokeWidth={1.2}
                  >
                    {categoryBreakdown.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, _name, entry: { payload?: CategoryBreakdown }) => {
                      const percentage = entry?.payload?.percentage ?? 0;
                      const category = entry?.payload?.category ?? "Category";
                      return [`£${Number(value).toLocaleString()} (${percentage}%)`, category];
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {categoryBreakdown.length > 0 ? (
                categoryBreakdown.map((item, i) => (
                  <div
                    key={`${item.category}-${i}`}
                    className="flex items-start justify-between gap-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="mt-1 h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: COLORS[i % COLORS.length] }}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm text-slate-300">
                          {item.category}
                        </p>
                        <p className="mt-1 text-xl font-semibold text-white">
                          {item.percentage}%
                        </p>
                      </div>
                    </div>
                    <p className="pt-1 text-sm text-slate-400">
                      £{Number(item.total).toLocaleString()}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-400">
                  No category spending data available.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      <div className="bg-[#0f1b33] p-6 rounded-2xl border border-[#1f2c4d]">
        <h2 className="mb-4 font-semibold">Monthly Financial Summary</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-gray-400 border-b border-[#1f2c4d]">
              <tr>
                <th className="text-left py-3">Month</th>
                <th className="text-right py-3">Income</th>
                <th className="text-right py-3">Expenses</th>
                <th className="text-right py-3">Net</th>
              </tr>
            </thead>
            <tbody>
              {monthlySummary.length > 0 ? (
                monthlySummary.map((row, i) => (
                  <tr key={`${row.month}-${i}`} className="border-b border-[#1f2c4d]/40">
                    <td className="py-3">{formatMonth(row.month)}</td>
                    <td className="py-3 text-right text-green-400">£{Number(row.income).toLocaleString()}</td>
                    <td className="py-3 text-right text-red-400">£{Number(row.expenses).toLocaleString()}</td>
                    <td className={`py-3 text-right font-medium ${Number(row.net) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      £{Number(row.net).toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-4 text-gray-400" colSpan={4}>
                    No monthly summary data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

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

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [balanceData, setBalanceData] = useState<BalancePoint[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      const token = localStorage.getItem("token");
      if (!token) {
        window.location.href = "/login";
        return;
      }

      try {
        // 1️⃣ Get current user
        const meRes = await fetch(
          "http://127.0.0.1:8000/auth/me",
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const me = await meRes.json();
        setUserName(me.display_name?.split(" ")[0] || "User");

        // 2️⃣ Get user's accounts
        const accountsRes = await fetch(
          "http://127.0.0.1:8000/accounts/",
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const accounts = await accountsRes.json();

        if (!accounts.length) {
          setLoading(false);
          return;
        }

        const accountId = accounts[0].id;

        // 3️⃣ Fetch dashboard data
        const summaryRes = await fetch(
          `http://127.0.0.1:8000/transactions/summary?account_id=${accountId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const balanceRes = await fetch(
          `http://127.0.0.1:8000/transactions/balance-history?account_id=${accountId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const categoryRes = await fetch(
          `http://127.0.0.1:8000/transactions/by-category?account_id=${accountId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setSummary(await summaryRes.json());
        setBalanceData(await balanceRes.json());
        setCategoryData(await categoryRes.json());

      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  if (loading) return <div className="p-8 text-white">Loading...</div>;
  if (!summary) return <div className="p-8 text-white">No account found.</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050816] via-[#0a1124] to-[#050816] text-white p-8 space-y-10">

      {/* Dynamic Welcome */}
      <div>
        <h1 className="text-4xl font-bold">
          Welcome back, {userName}
        </h1>
        <p className="text-gray-400 mt-2">
          Here’s your financial overview
        </p>
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

        {/* Balance Trend */}
        <div className="bg-[#0f1b33] p-6 rounded-2xl border border-[#1f2c4d]">
          <h2 className="mb-4 font-semibold">Balance Trend</h2>

          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={balanceData}>
              <defs>
                <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00ffcc" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#00ffcc" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1f2c4d" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#00ffcc"
                fill="url(#colorBalance)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Spending by Category */}
        <div className="bg-[#0f1b33] p-6 rounded-2xl border border-[#1f2c4d]">
          <h2 className="mb-4 font-semibold">Spending by Category</h2>

          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                dataKey="total"
                nameKey="category"
                innerRadius={70}
                outerRadius={110}
              >
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"];

type Summary = {
  total_income: number;
  total_expenses: number;
  current_balance: number;
  transaction_count: number;
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary>({
    total_income: 0,
    total_expenses: 0,
    current_balance: 0,
    transaction_count: 0,
  });

  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [balanceData, setBalanceData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const summaryRes = await fetch(
          "http://127.0.0.1:8000/transactions/summary"
        );
        const summaryData = await summaryRes.json();
        setSummary(summaryData);

        const categoryRes = await fetch(
          "http://127.0.0.1:8000/transactions/by-category"
        );
        const categoryJson = await categoryRes.json();
        setCategoryData(categoryJson);

        const recentRes = await fetch(
          "http://127.0.0.1:8000/transactions/recent"
        );
        const recentJson = await recentRes.json();
        setRecentTransactions(recentJson);

        const balanceRes = await fetch(
          "http://127.0.0.1:8000/transactions/balance-over-time"
        );
        const balanceJson = await balanceRes.json();
        setBalanceData(balanceJson);
      } catch (error) {
        console.error("Failed to load dashboard", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (loading) {
    return <div className="p-8">Loading dashboard...</div>;
  }

  return (
    <section className="p-8 space-y-8">
      <h1 className="text-3xl font-semibold">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">Current Balance</p>
          <p className="text-xl font-semibold">
            £{summary.current_balance?.toFixed(2)}
          </p>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">Total Income</p>
          <p className="text-xl font-semibold text-green-600">
            £{summary.total_income?.toFixed(2)}
          </p>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">Total Expenses</p>
          <p className="text-xl font-semibold text-red-600">
            £{summary.total_expenses?.toFixed(2)}
          </p>
        </div>

        <div className="bg-white border rounded-lg p-4">
          <p className="text-sm text-gray-500">Transactions</p>
          <p className="text-xl font-semibold">
            {summary.transaction_count}
          </p>
        </div>
      </div>

      {/* Balance Over Time */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">
          Balance Over Time
        </h2>

        {balanceData.length === 0 ? (
          <p className="text-gray-500">No balance data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={balanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="balance"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Spending by Category */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">
          Spending by Category
        </h2>

        {categoryData.length === 0 ? (
          <p className="text-gray-500">No spending data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                dataKey="total"
                nameKey="category"
                outerRadius={100}
                label
              >
                {categoryData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">
          Recent Transactions
        </h2>

        {recentTransactions.length === 0 ? (
          <p className="text-gray-500">No transactions yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Date</th>
                <th className="text-left py-2">Description</th>
                <th className="text-left py-2">Category</th>
                <th className="text-right py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map((tx: any) => (
                <tr key={tx.id} className="border-b">
                  <td className="py-2">{tx.date}</td>
                  <td className="py-2">{tx.description}</td>
                  <td className="py-2">{tx.category}</td>
                  <td
                    className={`py-2 text-right ${
                      tx.amount < 0
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    £{Number(tx.amount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import MetricCard from "@/components/MetricCard";

type SummaryResponse = {
  total_income: number;
  total_expenses: number;
  current_balance: number;
  transaction_count: number;
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSummary() {
      try {
        const res = await fetch(
          "http://127.0.0.1:8000/transactions/summary"
        );

        if (!res.ok) {
          throw new Error("Failed to fetch dashboard summary");
        }

        const data: SummaryResponse = await res.json();
        setSummary(data);
      } catch (err) {
        setError("Unable to load dashboard data");
      } finally {
        setLoading(false);
      }
    }

    fetchSummary();
  }, []);

  if (loading) {
    return (
      <section className="p-8">
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="mt-4 text-gray-600">Loading financial overview…</p>
      </section>
    );
  }

  if (error || !summary) {
    return (
      <section className="p-8">
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="mt-4 text-red-600">{error}</p>
      </section>
    );
  }

  return (
    <section className="p-8">
      <h1 className="text-3xl font-semibold text-gray-900">Dashboard</h1>
      <p className="mt-2 text-gray-600">
        Overview of your financial activity and insights.
      </p>

      {/* KPI Cards */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Current Balance"
          value={`£${summary.current_balance.toFixed(2)}`}
          positive={summary.current_balance >= 0}
        />

        <MetricCard
          title="Total Income"
          value={`£${summary.total_income.toFixed(2)}`}
          positive={true}
        />

        <MetricCard
          title="Total Expenses"
          value={`£${summary.total_expenses.toFixed(2)}`}
          positive={false}
        />
      </div>

      {/* Placeholder for future analytics */}
      <div className="mt-10 bg-white border border-gray-200 rounded-lg p-6 text-gray-500">
        Spending trends, forecasts, and advisor insights will appear here.
      </div>
    </section>
  );
}

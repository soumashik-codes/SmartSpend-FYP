"use client";

import { formatCurrency } from "./shared";

type TransactionsStatsProps = {
  totalSpent: number;
  topCategory: string;
  subscriptionMonthly: number;
};

export function TransactionsStats({
  totalSpent,
  topCategory,
  subscriptionMonthly,
}: TransactionsStatsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] p-5">
        <p className="text-sm text-slate-400">Total Transactions</p>
        <p className="mt-3 text-2xl font-semibold">{formatCurrency(totalSpent)} spent</p>
      </div>
      <div className="rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] p-5">
        <p className="text-sm text-slate-400">Top Category</p>
        <p className="mt-3 text-2xl font-semibold">{topCategory}</p>
      </div>
      <div className="rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] p-5">
        <p className="text-sm text-slate-400">Subscriptions</p>
        <p className="mt-3 text-2xl font-semibold">
          {formatCurrency(subscriptionMonthly)} / month
        </p>
      </div>
    </div>
  );
}

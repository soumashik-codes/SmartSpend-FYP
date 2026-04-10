"use client";

import { formatCurrency } from "./shared";

type TransactionsStatsProps = {
  transactionCount: number;
  totalSpent: number;
  topCategory: string;
  largestExpenseAmount: number;
  largestExpenseCategory: string;
};

export function TransactionsStats({
  transactionCount,
  totalSpent,
  topCategory,
  largestExpenseAmount,
  largestExpenseCategory,
}: TransactionsStatsProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] p-5">
        <p className="text-sm text-slate-400">Spend in View</p>
        <p className="mt-3 text-2xl font-semibold">{formatCurrency(totalSpent)} spent</p>
        <p className="mt-2 text-sm text-slate-500">{transactionCount} transactions shown</p>
      </div>
      <div className="rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] p-5">
        <p className="text-sm text-slate-400">Top Category</p>
        <p className="mt-3 text-2xl font-semibold">{topCategory}</p>
      </div>
      <div className="rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] p-5">
        <p className="text-sm text-slate-400">Largest Expense</p>
        <p className="mt-3 text-2xl font-semibold">
          {formatCurrency(largestExpenseAmount)}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Largest expense: {largestExpenseCategory}
        </p>
      </div>
    </div>
  );
}

"use client";

import { AlertTriangle } from "lucide-react";
import {
  getAnomalyClasses,
  formatCurrency,
  formatDate,
  getConfidenceClasses,
  getConfidenceLevel,
  type DecoratedTransaction,
} from "./shared";

type TransactionsTableProps = {
  rows: DecoratedTransaction[];
  onSelectTransaction: (transaction: DecoratedTransaction) => void;
};

export function TransactionsTable({
  rows,
  onSelectTransaction,
}: TransactionsTableProps) {
  return (
    <div className="mt-6 max-h-[560px] overflow-y-auto custom-scrollbar">
      <table className="w-full text-sm">
        <thead className="border-b border-[#1f2c4d] text-gray-400">
          <tr>
            <th className="py-3 text-left">Date</th>
            <th className="py-3 text-left">Merchant</th>
            <th className="py-3 text-left">Category</th>
            <th className="py-3 text-left">AI Confidence</th>
            <th className="py-3 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((transaction) => {
            const confidenceLevel = getConfidenceLevel(transaction.ai.confidence);

            return (
              <tr
                key={transaction.id}
                onClick={() => onSelectTransaction(transaction)}
                className="cursor-pointer border-b border-[#1f2c4d]/40 transition hover:bg-[#112142]"
              >
                <td className="py-4">{formatDate(transaction.date)}</td>
                <td className="py-4">
                  <div>
                    <p className="font-medium text-white">{transaction.description}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <p className="text-slate-500">Click to inspect AI details</p>
                      {transaction.is_anomaly ? (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium ${getAnomalyClasses(
                            transaction.is_anomaly,
                          )}`}
                        >
                          <AlertTriangle size={12} />
                          Unusual spending
                        </span>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="py-4">
                  <div>
                    <p className="font-medium">{transaction.ai.category}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {transaction.ai.needsReview ? "Review suggested" : "AI categorised"}
                    </p>
                  </div>
                </td>
                <td className="py-4">
                  <div className="group relative inline-flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${getConfidenceClasses(
                        confidenceLevel.tone,
                      )}`}
                    >
                      {confidenceLevel.tone === "low" ? <AlertTriangle size={12} /> : null}
                      {confidenceLevel.label}
                    </span>
                    <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-72 rounded-xl border border-[#1f2c4d] bg-[#07111f] p-4 text-left shadow-xl group-hover:block">
                      <p className="text-sm font-semibold text-white">AI Classification</p>
                      <p className="mt-2 text-xs text-slate-400">{confidenceLevel.label}</p>
                      <div className="mt-3 space-y-2 text-xs text-slate-300">
                        {transaction.ai.reasons.map((reason) => (
                          <p key={reason}>• {reason}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </td>
                <td
                  className={`py-4 text-right font-medium ${
                    Number(transaction.amount) >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {formatCurrency(Number(transaction.amount))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

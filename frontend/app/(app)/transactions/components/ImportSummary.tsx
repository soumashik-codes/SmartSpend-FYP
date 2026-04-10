"use client";

import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { formatCurrency, type ImportSummary as ImportSummaryData } from "./shared";

type ImportSummaryProps = {
  summary: ImportSummaryData;
  onReviewTransactions: () => void;
};

export function ImportSummary({ summary, onReviewTransactions }: ImportSummaryProps) {
  return (
    <div className="mt-6 rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-300/70">
            Import Complete
          </p>
          <h2 className="mt-2 text-2xl font-semibold">AI Import Summary</h2>
        </div>

        <button
          onClick={onReviewTransactions}
          className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-200 transition hover:bg-amber-400/20"
        >
          Review Transactions
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-3 text-emerald-300">
            <CheckCircle2 size={18} />
            <span>{summary.imported} new transactions added</span>
          </div>
        </div>
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-4">
          <div className="flex items-center gap-3 text-cyan-300">
            <Sparkles size={18} />
            <span>{summary.categorized} automatically categorized</span>
          </div>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
          <div className="flex items-center gap-3 text-amber-300">
            <AlertTriangle size={18} />
            <span>{summary.needsReview} need review</span>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-400">
        {summary.fileName ? (
          <span className="rounded-full border border-[#1f2c4d] bg-[#0a1428] px-3 py-1">
            File: {summary.fileName}
          </span>
        ) : null}
        {summary.rowsReceived != null ? (
          <span className="rounded-full border border-[#1f2c4d] bg-[#0a1428] px-3 py-1">
            {summary.rowsReceived} rows received
          </span>
        ) : null}
        {summary.duplicatesSkipped ? (
          <span className="rounded-full border border-[#1f2c4d] bg-[#0a1428] px-3 py-1">
            {summary.duplicatesSkipped} duplicates skipped
          </span>
        ) : null}
        {summary.importStatus ? (
          <span className="rounded-full border border-[#1f2c4d] bg-[#0a1428] px-3 py-1">
            Import status: {summary.importStatus}
          </span>
        ) : null}
        {summary.openingBalanceUsed != null ? (
          <span className="rounded-full border border-[#1f2c4d] bg-[#0a1428] px-3 py-1">
            Opening balance: {formatCurrency(summary.openingBalanceUsed)}
          </span>
        ) : null}
        {summary.closingBalance != null ? (
          <span className="rounded-full border border-[#1f2c4d] bg-[#0a1428] px-3 py-1">
            Closing balance: {formatCurrency(summary.closingBalance)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

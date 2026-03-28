"use client";

import { AlertTriangle, Save, X } from "lucide-react";
import {
  CATEGORY_OPTIONS,
  formatCurrency,
  formatDate,
  getAnomalyClasses,
  getConfidenceClasses,
  getConfidenceLevel,
  type DecoratedTransaction,
} from "./shared";

type TransactionReviewPanelProps = {
  transaction: DecoratedTransaction | null;
  categoryDraft: string;
  onCategoryDraftChange: (value: string) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
  isUpdatingCategory: boolean;
};

export function TransactionReviewPanel({
  transaction,
  categoryDraft,
  onCategoryDraftChange,
  onClose,
  onSave,
  isUpdatingCategory,
}: TransactionReviewPanelProps) {
  if (!transaction) {
    return null;
  }

  const confidenceLevel = getConfidenceLevel(transaction.ai.confidence);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/55">
      <div className="h-full w-full max-w-md border-l border-[#1f2c4d] bg-[#07111f] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-300/70">
              Transaction Details
            </p>
            <h2 className="mt-2 text-2xl font-semibold">{transaction.description}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-[#1f2c4d] p-2 text-slate-300 transition hover:bg-[#0f1b33]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 grid gap-4 rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Date</p>
            <p className="mt-2 text-base">{formatDate(transaction.date)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Amount</p>
            <p
              className={`mt-2 text-base font-medium ${
                transaction.amount >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {formatCurrency(transaction.amount)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Category</p>
            <select
              value={categoryDraft}
              onChange={(event) => onCategoryDraftChange(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#1f2c4d] bg-[#07111f] px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/60"
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-lg font-semibold">AI Analysis</p>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${getConfidenceClasses(
                confidenceLevel.tone,
              )}`}
            >
              {confidenceLevel.tone === "low" ? <AlertTriangle size={12} /> : null}
              {confidenceLevel.label}
            </span>
          </div>

          <div className="mt-4 space-y-3 text-sm text-slate-300">
            {transaction.ai.reasons.map((reason) => (
              <p key={reason}>• {reason}</p>
            ))}
          </div>
        </div>

        {transaction.is_anomaly ? (
          <div className="mt-6 rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-lg font-semibold">Unusual Spending</p>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${getAnomalyClasses(
                  transaction.is_anomaly,
                )}`}
              >
                <AlertTriangle size={12} />
                Flagged
              </span>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-300">
              {(transaction.anomaly_reasons || []).map((reason) => (
                <p key={reason}>- {reason}</p>
              ))}
              {transaction.anomaly_score != null ? (
                <p className="text-xs text-slate-500">
                  Anomaly score: {transaction.anomaly_score.toFixed(3)}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <button
          onClick={onSave}
          disabled={isUpdatingCategory}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-medium text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
        >
          <Save size={16} />
          {isUpdatingCategory ? "Saving..." : "Save Category"}
        </button>
      </div>
    </div>
  );
}

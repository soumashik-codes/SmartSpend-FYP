"use client";

import { AlertTriangle, CheckCircle2, Save, X } from "lucide-react";
import {
  CATEGORY_OPTIONS,
  displayCategory,
  formatCurrency,
  formatDate,
  getAnomalyClasses,
  getConfidenceClasses,
  getConfidenceLevel,
  type DecoratedTransaction,
} from "./shared";

const MERCHANT_FAMILY_LABELS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bTESCO\b/i, label: "Tesco" },
  { pattern: /\bSAINSBURY(?:S)?\b/i, label: "Sainsburys" },
  { pattern: /\bMCDONALD(?:S)?\b/i, label: "McDonalds" },
  { pattern: /\bALDI\b/i, label: "Aldi" },
  { pattern: /\bASDA\b/i, label: "Asda" },
  { pattern: /\bLIDL\b/i, label: "Lidl" },
  { pattern: /\bWAITROSE\b/i, label: "Waitrose" },
  { pattern: /\bSTARBUCKS\b/i, label: "Starbucks" },
  { pattern: /\bCOSTA\b/i, label: "Costa" },
  { pattern: /\bCAFE\s+NERO\b/i, label: "Cafe Nero" },
  { pattern: /\bGREGGS\b/i, label: "Greggs" },
];

function getMerchantFamilyLabel(description: string) {
  const match = MERCHANT_FAMILY_LABELS.find((item) => item.pattern.test(description));
  return match?.label ?? null;
}

type TransactionReviewPanelProps = {
  transaction: DecoratedTransaction | null;
  categoryDraft: string;
  onCategoryDraftChange: (value: string) => void;
  applyToFutureMerchant: boolean;
  onApplyToFutureMerchantChange: (value: boolean) => void;
  applyToAllMerchant: boolean;
  onApplyToAllMerchantChange: (value: boolean) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
  isUpdatingCategory: boolean;
  saveFeedback: string;
};

export function TransactionReviewPanel({
  transaction,
  categoryDraft,
  onCategoryDraftChange,
  applyToFutureMerchant,
  onApplyToFutureMerchantChange,
  applyToAllMerchant,
  onApplyToAllMerchantChange,
  onClose,
  onSave,
  isUpdatingCategory,
  saveFeedback,
}: TransactionReviewPanelProps) {
  if (!transaction) {
    return null;
  }

  const confidenceLevel = getConfidenceLevel(transaction.ai.confidence);
  const currentCategory = displayCategory(transaction.category);
  const hasChanges =
    categoryDraft !== currentCategory || applyToFutureMerchant || applyToAllMerchant;
  const saveLabel = isUpdatingCategory ? "Saving..." : hasChanges ? "Save Category" : "No Changes";
  const merchantFamilyLabel = getMerchantFamilyLabel(transaction.description);
  const applyAllLabel = merchantFamilyLabel
    ? `Apply to all ${merchantFamilyLabel} transactions.`
    : `Apply to all ${transaction.description} transactions.`;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/55">
      <div className="flex h-full w-full max-w-md flex-col border-l border-[#1f2c4d] bg-[#07111f] shadow-2xl">
        <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
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

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="grid gap-4 rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] p-5">
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

              <div className="mt-4 space-y-3">
                <label className="flex items-start gap-3 rounded-xl border border-[#1f2c4d] bg-[#07111f] px-4 py-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={applyToFutureMerchant}
                    onChange={(event) => onApplyToFutureMerchantChange(event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#36507b] bg-[#07111f] text-emerald-400 focus:ring-emerald-400"
                  />
                  <span>Apply this category to future transactions from this merchant.</span>
                </label>

                <label className="flex items-start gap-3 rounded-xl border border-[#1f2c4d] bg-[#07111f] px-4 py-3 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={applyToAllMerchant}
                    onChange={(event) => onApplyToAllMerchantChange(event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#36507b] bg-[#07111f] text-emerald-400 focus:ring-emerald-400"
                  />
                  <span>{applyAllLabel}</span>
                </label>
              </div>

              <p className="mt-3 text-sm text-slate-400">
                You can override the AI category if it looks incorrect. Manual changes help
                improve future categorisation.
              </p>
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
                <p key={reason}>- {reason}</p>
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

          {saveFeedback ? (
            <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              <CheckCircle2 size={16} />
              {saveFeedback}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={onSave}
              disabled={isUpdatingCategory || !hasChanges}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-medium text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={16} />
              {saveLabel}
            </button>
            <button
              onClick={onClose}
              disabled={isUpdatingCategory}
              className="inline-flex items-center gap-2 rounded-xl border border-[#1f2c4d] px-5 py-3 font-medium text-slate-300 transition hover:bg-[#0f1b33] disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

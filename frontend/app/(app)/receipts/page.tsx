"use client";

import { useState } from "react";
import {
  FileText,
  Lightbulb,
  Loader2,
  ShoppingCart,
  UploadCloud,
} from "lucide-react";
import {
  buildApiUrl,
  getAccessToken,
  getErrorMessageFromResponse,
} from "@/lib/api";

type Item = {
  name: string;
  qty: number;
  unit_price?: number;
  line_total?: number;
};

type ReceiptData = {
  id?: number;
  merchant?: string | null;
  receipt_date?: string | null;
  total?: number | null;
  calculated_total?: number | null;
  difference?: number | null;
  verified?: boolean | null;
  items?: Item[];
};

function formatCurrency(value?: number | null) {
  if (value == null || Number.isNaN(value)) {
    return "GBP 0.00";
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatReceiptDate(value?: string | null) {
  if (!value) {
    return "Unknown";
  }

  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) {
    return direct.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  const ukMatch = value.match(/^(\d{2})[/-](\d{2})[/-](\d{2,4})$/);
  if (ukMatch) {
    const [, day, month, year] = ukMatch;
    const normalizedYear = year.length === 2 ? `20${year}` : year;
    const parsed = new Date(`${normalizedYear}-${month}-${day}`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
  }

  return value;
}

export default function ReceiptsPage() {
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [error, setError] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const receiptItems = receipt?.items ?? [];
  const totalUnits = receiptItems.reduce((sum, item) => sum + (item.qty || 0), 0);
  const resolvedItems = receiptItems.map((item) => ({
    ...item,
    resolvedTotal:
      item.line_total ??
      (item.unit_price != null ? item.unit_price * (item.qty || 1) : null),
  }));
  const mostExpensiveItem =
    resolvedItems.length > 0
      ? resolvedItems.reduce((current, item) =>
          (current.resolvedTotal || 0) > (item.resolvedTotal || 0) ? current : item,
        )
      : null;
  const averageItemPrice =
    resolvedItems.length > 0
      ? resolvedItems.reduce((sum, item) => sum + (item.resolvedTotal || 0), 0) /
        resolvedItems.length
      : null;

  async function handleUpload(file: File) {
    if (!file) {
      return;
    }

    const token = getAccessToken();
    if (!token) {
      window.location.href = "/login";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setSelectedFileName(file.name);
    setLoading(true);
    setError("");

    try {
      const response = await fetch(buildApiUrl("/receipts/upload"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(
          await getErrorMessageFromResponse(response, "Failed to process receipt."),
        );
      }

      const data = await response.json();
      setReceipt(data);
    } catch (uploadError: unknown) {
      setReceipt(null);
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Failed to process receipt.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-10 text-white">
      <div>
        <h1 className="text-4xl font-bold">Receipt Analysis</h1>
        <p className="mt-2 text-gray-400">
          Upload receipts for AI-powered item-level spending insights
        </p>
      </div>

      <div
        className={`rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
          dragActive
            ? "border-emerald-500 bg-[#12213d]"
            : "border-[#1f2c4d] bg-[#0f1b33] hover:border-emerald-500"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragActive(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          const file = event.dataTransfer.files?.[0];
          if (file) {
            handleUpload(file);
          }
        }}
      >
        <label
          htmlFor="receiptUpload"
          className="flex cursor-pointer flex-col items-center space-y-4"
        >
          <UploadCloud
            size={52}
            className="text-emerald-400 transition-transform hover:scale-110"
          />
          <p className="text-xl font-semibold">
            Drag &amp; drop a receipt image, or{" "}
            <span className="text-emerald-400 underline underline-offset-4">
              browse
            </span>
          </p>
          <p className="text-sm text-gray-400">
            Supported: JPG, PNG · AI extracts items, prices, and totals
          </p>
        </label>

        <input
          id="receiptUpload"
          type="file"
          accept="image/png, image/jpeg"
          className="hidden"
          onChange={(event) => {
            if (event.target.files?.[0]) {
              handleUpload(event.target.files[0]);
            }
          }}
        />

        {selectedFileName ? (
          <p className="mt-6 text-sm text-slate-300">
            Selected file:{" "}
            <span className="font-medium text-white">{selectedFileName}</span>
          </p>
        ) : null}

        {loading ? (
          <div className="mt-6 flex items-center justify-center gap-2 text-emerald-400">
            <Loader2 size={18} className="animate-spin" />
            <p>AI is analysing your receipt...</p>
          </div>
        ) : null}

        {error ? <p className="mt-6 text-red-400">{error}</p> : null}
      </div>

      {receipt ? (
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] p-6">
            <div className="mb-6 flex items-center gap-2">
              <FileText size={20} className="text-emerald-400" />
              <h2 className="text-xl font-semibold">Receipt Details</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="text-sm text-slate-400">Merchant</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {receipt.merchant || "Unknown merchant"}
                </p>
              </div>
              <div className="md:text-right">
                <p className="text-sm text-slate-400">Date</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {formatReceiptDate(receipt.receipt_date)}
                </p>
              </div>
            </div>

            <div className="mt-8 overflow-hidden rounded-xl border border-[#1f2c4d] bg-[#111c36]">
              <div className="max-h-[420px] overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-[#111c36] text-sm text-slate-400">
                    <tr className="border-b border-[#1f2c4d]">
                      <th className="px-6 py-4 font-medium">Item</th>
                      <th className="px-3 py-4 font-medium">Qty</th>
                      <th className="px-3 py-4 text-right font-medium">Price</th>
                      <th className="px-6 py-4 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiptItems.map((item, index) => (
                      <tr
                        key={`${item.name}-${index}`}
                        className="border-b border-[#1f2c4d]/70 text-sm"
                      >
                        <td className="px-6 py-4 text-slate-100">{item.name}</td>
                        <td className="px-3 py-4 text-slate-400">{item.qty}</td>
                        <td className="px-3 py-4 text-right text-slate-400">
                          {item.unit_price != null ? formatCurrency(item.unit_price) : "-"}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-white">
                          {item.line_total != null ? formatCurrency(item.line_total) : "-"}
                        </td>
                      </tr>
                    ))}
                    {receiptItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-6 py-8 text-center text-sm text-slate-400"
                        >
                          No item lines were extracted from this receipt.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end gap-8 border-t border-[#1f2c4d] px-6 py-4">
                <span className="text-lg font-semibold text-slate-200">Total</span>
                <span className="text-2xl font-bold text-white">
                  {formatCurrency(receipt.total ?? receipt.calculated_total)}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] p-6">
            <div className="mb-6 flex items-center gap-2">
              <ShoppingCart size={20} className="text-emerald-400" />
              <h2 className="text-xl font-semibold">Item Insights</h2>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-[#1f2c4d] bg-[#111c36] p-4">
                <p className="text-sm font-semibold text-emerald-300">
                  Most Expensive Item
                </p>
                <p className="mt-2 text-xl text-white">
                  {mostExpensiveItem
                    ? `${mostExpensiveItem.name} — ${formatCurrency(mostExpensiveItem.resolvedTotal)}`
                    : "No priced item extracted yet"}
                </p>
              </div>

              <div className="rounded-xl border border-[#1f2c4d] bg-[#111c36] p-4">
                <p className="text-sm font-semibold text-emerald-300">Items Count</p>
                <p className="mt-2 text-xl text-white">
                  {receiptItems.length} unique items ·{" "}
                  {totalUnits.toFixed(totalUnits % 1 === 0 ? 0 : 1)} total units
                </p>
              </div>

              <div className="rounded-xl border border-[#1f2c4d] bg-[#111c36] p-4">
                <p className="text-sm font-semibold text-emerald-300">
                  Average Item Price
                </p>
                <p className="mt-2 text-xl text-white">
                  {averageItemPrice != null
                    ? `${formatCurrency(averageItemPrice)} per item`
                    : "Not available"}
                </p>
              </div>

              <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-4">
                <div className="flex items-center gap-2 text-emerald-300">
                  <Lightbulb size={16} />
                  <p className="text-sm font-semibold">Tip</p>
                </div>
                <p className="mt-2 text-base text-slate-100">
                  Upload more receipts to build a detailed picture of your item-level
                  spending habits over time.
                </p>
              </div>

              {receipt.total != null ? (
                <div
                  className={`rounded-xl border p-4 ${
                    receipt.verified
                      ? "border-emerald-500/35 bg-emerald-500/10"
                      : "border-amber-500/35 bg-amber-500/10"
                  }`}
                >
                  <p
                    className={`text-sm font-semibold ${
                      receipt.verified ? "text-emerald-300" : "text-amber-300"
                    }`}
                  >
                    Receipt check
                  </p>
                  <p className="mt-2 text-sm text-slate-100">
                    {receipt.verified
                      ? "OCR item totals match the receipt total."
                      : `OCR item totals differ from the receipt total by ${formatCurrency(receipt.difference)}.`}
                  </p>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";

/* ================= TYPES ================= */

type TransactionRow = {
  date: string;
  description: string;
  category: string;
  amount: number;
};

type ParseError = {
  row?: number;
  message: string;
};

/* ================= HELPERS ================= */

function normalizeHeader(h: string) {
  return h.toLowerCase().replace(/\s+/g, "").replace(/[^a-z]/g, "");
}

function toNumber(value: unknown) {
  const s = String(value ?? "")
    .replace(/[£,$]/g, "")
    .replace(/\s+/g, "")
    .trim();

  if (!s) return NaN;
  return Number(s);
}

/* ================= PAGE ================= */

export default function UploadPage() {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [errors, setErrors] = useState<ParseError[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  /* ----------- Preview totals ----------- */

  const totals = useMemo(() => {
    const income = rows
      .filter((r) => r.amount > 0)
      .reduce((s, r) => s + r.amount, 0);

    const expenses = rows
      .filter((r) => r.amount < 0)
      .reduce((s, r) => s + Math.abs(r.amount), 0);

    return { income, expenses };
  }, [rows]);

  /* ----------- CSV Parsing ----------- */

  function handleFile(file: File) {
    setFileName(file.name);
    setIsParsing(true);
    setErrors([]);
    setRows([]);
    setSuccess(false);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,

      complete: (results) => {
        const parsedRows: TransactionRow[] = [];
        const parseErrors: ParseError[] = [];

        (results.data as any[]).forEach((rawRow, index) => {
          const row: Record<string, any> = {};

          // Normalize headers
          Object.keys(rawRow).forEach((key) => {
            row[normalizeHeader(key)] = rawRow[key];
          });

          // Flexible date detection
          const date =
            row.date ||
            row.transactiondate ||
            row.bookingdate ||
            row.posteddate ||
            row.valuedate;

          // Flexible description detection
          const description =
            row.description ||
            row.narrative ||
            row.details ||
            row.merchant ||
            row.reference ||
            row.payee;

          let amount: number | null = null;

          // Direct amount / value column
          const rawValue =
            row.amount ||
            row.value ||
            row.transactionamount;

          if (rawValue !== undefined) {
            const parsed = toNumber(rawValue);
            if (!isNaN(parsed)) amount = parsed;
          }

          // Debit / Credit detection via type column
          if (amount !== null && row.type) {
            const type = String(row.type).toLowerCase();

            if (type.includes("debit") || type.includes("out")) {
              amount = -Math.abs(amount);
            }

            if (type.includes("credit") || type.includes("in")) {
              amount = Math.abs(amount);
            }
          }

          // Credit / Debit columns
          if (amount === null) {
            const credit = toNumber(row.credit);
            const debit = toNumber(row.debit);

            if (!isNaN(credit) && credit > 0) amount = credit;
            else if (!isNaN(debit) && debit > 0) amount = -debit;
          }

          // Money in / out
          if (amount === null) {
            const moneyIn =
              toNumber(row.moneyin) ||
              toNumber(row.paidin);

            const moneyOut =
              toNumber(row.moneyout) ||
              toNumber(row.paidout);

            if (!isNaN(moneyIn) && moneyIn > 0) amount = moneyIn;
            else if (!isNaN(moneyOut) && moneyOut > 0)
              amount = -moneyOut;
          }


          // Final validation — skip silently instead of erroring
          if (!date || !description || amount === null || isNaN(amount)) {
            return;
          }

          parsedRows.push({
            date: String(date).trim(),
            description: String(description).trim(),
            category: "Uncategorised",
            amount,
          });
        });

        // Only show error if nothing valid found
        if (parsedRows.length === 0) {
          parseErrors.push({
            message:
              "No valid transactions detected. Please check the CSV format.",
          });
        }

        setRows(parsedRows);
        setErrors(parseErrors);
        setIsParsing(false);
      },
    });
  }


  /* ----------- Save & Analyse ----------- */

  async function saveAndAnalyse() {
    setIsSaving(true);
    setSuccess(false);

    try {
      const res = await fetch(
        "http://127.0.0.1:8000/transactions/upload",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactions: rows }),
        }
      );

      if (!res.ok) throw new Error("Upload failed");

      setSuccess(true);
    } catch {
      setErrors([{ message: "Failed to save transactions" }]);
    } finally {
      setIsSaving(false);
    }
  }

  /* ================= UI ================= */

  return (
    <section className="p-8">
      <h1 className="text-3xl font-semibold">
        Upload Transactions
      </h1>
      <p className="mt-2 text-gray-600">
        Upload a CSV bank statement to analyse your transactions.
      </p>

      {/* Upload box */}
      <div className="mt-8 border-2 border-dashed rounded-lg p-8 bg-white text-center">
        <input
          type="file"
          accept=".csv"
          id="csvInput"
          className="hidden"
          onChange={(e) =>
            e.target.files && handleFile(e.target.files[0])
          }
        />

        <label
          htmlFor="csvInput"
          className="cursor-pointer px-6 py-3 bg-blue-600 text-white rounded-lg"
        >
          Select CSV File
        </label>

        {fileName && (
          <p className="mt-3 text-sm text-gray-600">
            Uploaded: <strong>{fileName}</strong>
          </p>
        )}
      </div>

      {isParsing && (
        <p className="mt-4 text-blue-600">Parsing CSV…</p>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="font-medium text-red-700 mb-2">
            Issues found:
          </p>
          <ul className="list-disc ml-5 text-sm text-red-600">
            {errors.map((e, i) => (
              <li key={i}>
                {e.row ? `Row ${e.row}: ` : ""}
                {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview */}
      {rows.length > 0 && (
        <div className="mt-6 bg-white border rounded-lg p-4">
          <p className="font-medium">
            {rows.length} transactions ready
          </p>
          <p className="text-sm text-gray-600">
            Income £{totals.income.toFixed(2)} · Expenses £
            {totals.expenses.toFixed(2)}
          </p>

          {/* Transaction Preview*/}
          {rows.length > 0 && (
            <div className="mt-8 bg-white border rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  Transaction Preview
                </h2>
                <span className="text-sm text-gray-500">
                  Showing {Math.min(rows.length, 20)} of {rows.length}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-6 py-3 text-left">Date</th>
                      <th className="px-6 py-3 text-left">Description</th>
                      <th className="px-6 py-3 text-left">Category</th>
                      <th className="px-6 py-3 text-right">Amount</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    {rows.slice(0, 20).map((tx, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-3">
                          {tx.date}
                        </td>

                        <td className="px-6 py-3 font-medium text-gray-900">
                          {tx.description}
                        </td>

                        <td className="px-6 py-3">
                          <span className="inline-block px-2 py-1 text-xs rounded bg-gray-100">
                            {tx.category}
                          </span>
                        </td>

                        <td
                          className={`px-6 py-3 text-right font-semibold ${tx.amount >= 0 ? "text-green-600" : "text-red-600"
                            }`}
                        >
                          £{tx.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}



          <button
            onClick={saveAndAnalyse}
            disabled={isSaving}
            className="mt-4 px-6 py-3 bg-green-600 text-white rounded-lg disabled:opacity-60"
          >
            {isSaving ? "Saving…" : "Save & Analyse"}
          </button>

          {success && (
            <p className="mt-3 text-green-600">
              Transactions saved successfully ✔
            </p>
          )}
        </div>
      )}
    </section>
  );
}

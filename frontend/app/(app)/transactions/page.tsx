"use client";

import { useMemo, useState } from "react";
import { useEffect } from "react";
import { UploadCloud } from "lucide-react";
import Papa from "papaparse";
import { getDefaultAccountId } from "@/lib/api";

/* ================= TYPES ================= */

type Transaction = {
  id?: number;
  date: string;
  description: string;
  amount: number;
  category?: string;
};

/* ================= SCHEMA DETECTION ================= */

function normalize(h: string) {
  return h.toLowerCase().replace(/\s+/g, "").replace(/[^a-z]/g, "");
}

function detectSchema(headers: string[]) {
  const find = (possibilities: string[]) =>
    headers.find((h) =>
      possibilities.includes(normalize(h))
    ) || null;

  return {
    dateKey: find([
      "date",
      "transactiondate",
      "bookingdate",
      "posteddate",
      "valuedate",
    ]),
    descriptionKey: find([
      "description",
      "details",
      "narrative",
      "merchant",
      "reference",
      "payee",
    ]),
    amountKey: find(["amount", "value", "transactionamount"]),
    debitKey: find(["debit"]),
    creditKey: find(["credit"]),
    moneyInKey: find(["moneyin", "paidin"]),
    moneyOutKey: find(["moneyout", "paidout"]),
  };
}

function cleanNumber(value: any) {
  return Number(
    String(value ?? "")
      .replace(/[£,$]/g, "")
      .replace(/\s+/g, "")
  );
}

function resolveAmount(row: any, schema: any) {
  if (schema.amountKey) {
    const val = cleanNumber(row[schema.amountKey]);
    if (!isNaN(val)) return val;
  }

  if (schema.creditKey || schema.debitKey) {
    const credit = schema.creditKey
      ? cleanNumber(row[schema.creditKey])
      : NaN;
    const debit = schema.debitKey
      ? cleanNumber(row[schema.debitKey])
      : NaN;

    if (!isNaN(credit) && credit > 0) return credit;
    if (!isNaN(debit) && debit > 0) return -debit;
  }

  if (schema.moneyInKey || schema.moneyOutKey) {
    const moneyIn = schema.moneyInKey
      ? cleanNumber(row[schema.moneyInKey])
      : NaN;
    const moneyOut = schema.moneyOutKey
      ? cleanNumber(row[schema.moneyOutKey])
      : NaN;

    if (!isNaN(moneyIn) && moneyIn > 0) return moneyIn;
    if (!isNaN(moneyOut) && moneyOut > 0) return -moneyOut;
  }

  return null;
}

/* ================= PAGE ================= */

export default function TransactionsPage() {
  const [fileName, setFileName] = useState("");
  const [previewRows, setPreviewRows] = useState<Transaction[]>([]);
  const [savedRows, setSavedRows] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchTransactions();
  }, []);


  /* ================= FETCH FROM DB ================= */

  async function fetchTransactions() {
    const token = localStorage.getItem("token");
    const accountId = await getDefaultAccountId();

    if (!accountId) {
      alert("No account selected.");
      return;
    }

    const res = await fetch(
      `http://127.0.0.1:8000/transactions/?account_id=${accountId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await res.json();
    setSavedRows(data);
  }



  /* ================= PARSE CSV ================= */

  function handleFile(file: File) {
    setFileName(file.name);
    setIsParsing(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[];
        if (!data.length) return;

        const headers = Object.keys(data[0]);
        const schema = detectSchema(headers);

        if (!schema.dateKey || !schema.descriptionKey) {
          alert("Could not detect required columns.");
          setIsParsing(false);
          return;
        }

        const parsed: Transaction[] = [];

        data.forEach((row) => {
          const amount = resolveAmount(row, schema);

          if (
            !row[schema.dateKey!] ||
            !row[schema.descriptionKey!] ||
            amount === null ||
            isNaN(amount)
          )
            return;

          parsed.push({
            date: String(row[schema.dateKey!]).trim(),
            description: String(row[schema.descriptionKey!]).trim(),
            amount,
          });
        });

        setPreviewRows(parsed);
        setIsParsing(false);
      },
    });
  }

  /* ================= SAVE TO BACKEND ================= */
  async function saveAndAnalyse() {
    setIsSaving(true);

    const token = localStorage.getItem("token");
    const accountId = await getDefaultAccountId();

    if (!accountId) {
      alert("No account selected.");
      setIsSaving(false);
      return;
    }

    await fetch("http://127.0.0.1:8000/transactions/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        account_id: accountId,
        transactions: previewRows,
      }),
    });

    await fetchTransactions();

    setPreviewRows([]);
    setFileName("");
    setIsSaving(false);
  }



  /* ================= FILTER ================= */

  const filteredRows = useMemo(() => {
    return savedRows.filter((row) =>
      row.description
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [search, savedRows]);

  /* ================= UI ================= */

  return (
    <div className="p-8 text-white">
      <h1 className="text-3xl font-semibold">
        Transactions
      </h1>

      {/* Upload */}
      <div className="mt-8 bg-[#0f1b33] border-2 border-dashed border-green-500/30 hover:border-emerald-500 transition-colors rounded-2xl p-12 text-center">

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
          className="cursor-pointer flex flex-col items-center space-y-4"
        >
          <UploadCloud
            size={52}
            className="text-emerald-400 hover:scale-110 transition-transform"
          />

          <h2 className="text-xl font-semibold">
            Upload Transactions CSV
          </h2>

          <p className="text-sm text-gray-400">
            Supported: CSV · AI Automatically categorises and analyses spending
          </p>

          <span className="text-emerald-400 underline text-sm">
            Click to browse file
          </span>
        </label>

        {fileName && (
          <p className="mt-6 text-emerald-400">
            Uploaded: {fileName}
          </p>
        )}

      </div>

      {/* Preview */}
      {previewRows.length > 0 && (
        <div className="mt-8 bg-[#0f1b33] border border-[#1f2c4d] rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">
            Preview ({previewRows.length} transactions)
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-gray-400 border-b border-[#1f2c4d]">
                <tr>
                  <th className="text-left py-3">Date</th>
                  <th className="text-left py-3">Description</th>
                  <th className="text-right py-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 10).map((tx, i) => (
                  <tr key={i} className="border-b border-[#1f2c4d]/40">
                    <td className="py-3">{tx.date}</td>
                    <td className="py-3">{tx.description}</td>
                    <td
                      className={`py-3 text-right font-medium ${tx.amount >= 0
                        ? "text-green-400"
                        : "text-red-400"
                        }`}
                    >
                      £{tx.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={saveAndAnalyse}
            disabled={isSaving}
            className="mt-6 bg-green-500 hover:bg-green-600 transition px-6 py-3 rounded-lg font-medium"
          >
            {isSaving ? "Saving..." : "Save & Analyse"}
          </button>
        </div>
      )}



      {/* Saved Transactions */}
      {savedRows.length > 0 && (
        <div className="mt-10 bg-[#0f1b33] border border-[#1f2c4d] rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">
            All Transactions
          </h2>

          <input
            type="text"
            placeholder="Search transactions..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            className="mb-4 bg-[#0a1428] border border-[#1f2c4d] px-4 py-2 rounded-lg text-sm"
          />

          <div className="overflow-y-auto max-h-[400px] custom-scrollbar">
            <table className="w-full text-sm">
              <thead className="text-gray-400 border-b border-[#1f2c4d]">
                <tr>
                  <th className="text-left py-3">Date</th>
                  <th className="text-left py-3">Description</th>
                  <th className="text-left py-3">Category</th>
                  <th className="text-right py-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((tx) => (
                  <tr key={tx.id}>
                    <td>{tx.date}</td>
                    <td>{tx.description}</td>
                    <td>{tx.category}</td>
                    <td
                      className={`py-3 text-right font-medium ${Number(tx.amount) >= 0
                        ? "text-green-400"
                        : "text-red-400"
                        }`}
                    >
                      £{Number(tx.amount).toFixed(2)}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

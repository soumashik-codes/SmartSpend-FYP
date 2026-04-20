"use client";

import { useId, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import Papa from "papaparse";
import {
  formatCurrency,
  formatDate,
  parseTransactionsCsv,
  type CsvParseResult,
  type Transaction,
} from "./shared";

type UploadCardProps = {
  previewRows: Transaction[];
  onPreviewReady: (result: CsvParseResult) => void;
  onFileMetaReady?: (meta: { fileName: string; rawCsv: string }) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
  errorMessage?: string;
  infoMessage?: string;
  onError?: (message: string) => void;
};

export function UploadCard({
  previewRows,
  onPreviewReady,
  onFileMetaReady,
  onSave,
  isSaving,
  errorMessage,
  infoMessage,
  onError,
}: UploadCardProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [isParsing, setIsParsing] = useState(false);

  async function handleFile(file: File) {
    setFileName(file.name);
    setIsParsing(true);
    const rawCsv = await file.text();
    onFileMetaReady?.({ fileName: file.name, rawCsv });

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const data = results.data as Record<string, unknown>[];
          const parsed = parseTransactionsCsv(data);
          onPreviewReady(parsed);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unable to parse this CSV file.";
          onError?.(message);
          setFileName("");
          onPreviewReady({ rows: [], totalRows: 0, skippedRows: 0 });
          onFileMetaReady?.({ fileName: "", rawCsv: "" });
        } finally {
          setIsParsing(false);
        }
      },
      error: () => {
        onError?.("Unable to parse this CSV file.");
        setFileName("");
        onPreviewReady({ rows: [], totalRows: 0, skippedRows: 0 });
        onFileMetaReady?.({ fileName: "", rawCsv: "" });
        setIsParsing(false);
      },
    });
  }

  return (
    <>
      <div className="mt-8 rounded-2xl border-2 border-dashed border-green-500/30 bg-[#0f1b33] p-12 text-center transition-colors hover:border-emerald-500">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          id={inputId}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleFile(file);
            }
          }}
        />

        <label htmlFor={inputId} className="flex cursor-pointer flex-col items-center space-y-4">
          <UploadCloud
            size={52}
            className="text-emerald-400 transition-transform hover:scale-110"
          />

          <h2 className="text-xl font-semibold">Upload Transactions CSV</h2>

          <p className="text-sm text-gray-400">
            Supported: CSV bank export · AI automatically categorises and analyses spending
          </p>

          <span className="text-sm text-emerald-400 underline">Click to browse file</span>
        </label>

        {fileName ? <p className="mt-6 text-emerald-400">Uploaded: {fileName}</p> : null}
        {infoMessage ? <p className="mt-4 text-sm text-slate-400">{infoMessage}</p> : null}
        {errorMessage ? <p className="mt-4 text-sm text-red-400">{errorMessage}</p> : null}
      </div>

      {previewRows.length > 0 ? (
        <div className="mt-8 rounded-xl border border-[#1f2c4d] bg-[#0f1b33] p-6">
          <h2 className="mb-4 text-lg font-semibold">
            Preview ({previewRows.length} transactions)
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[#1f2c4d] text-gray-400">
                <tr>
                  <th className="py-3 text-left">Date</th>
                  <th className="py-3 text-left">Merchant</th>
                  <th className="py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 10).map((transaction, index) => (
                  <tr
                    key={`${transaction.date}-${transaction.description}-${index}`}
                    className="border-b border-[#1f2c4d]/40"
                  >
                    <td className="py-3">{formatDate(transaction.date)}</td>
                    <td className="py-3">{transaction.description}</td>
                    <td
                      className={`py-3 text-right font-medium ${
                        transaction.amount >= 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {formatCurrency(transaction.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={onSave}
            disabled={isSaving || isParsing}
            className="mt-6 rounded-lg bg-green-500 px-6 py-3 font-medium transition hover:bg-green-600 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : isParsing ? "Parsing..." : "Save & Analyse"}
          </button>
        </div>
      ) : null}
    </>
  );
}

"use client";

import { useState } from "react";
import { UploadCloud, FileText, ShoppingCart } from "lucide-react";

type Item = {
  name: string;
  qty: number;
  unit_price?: number;
  line_total?: number;
};

export default function ReceiptsPage() {
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [error, setError] = useState("");

  async function handleUpload(file: File) {
    if (!file) return;

    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    setError("");

    try {
      const res = await fetch("http://127.0.0.1:8000/receipts/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      const data = await res.json();
      setReceipt(data);
    } catch (err: any) {
      setError("Failed to process receipt");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050816] via-[#0a1124] to-[#050816] text-white p-8 space-y-10">

      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold">Receipt Analysis</h1>
        <p className="text-gray-400 mt-2">
          Upload receipts for AI-powered item-level spending insights
        </p>
      </div>

      {/* Upload Section */}
      <div className="bg-[#0f1b33] border-2 border-dashed border-[#1f2c4d] hover:border-emerald-500 transition-colors rounded-2xl p-12 text-center">

        <label
          htmlFor="receiptUpload"
          className="cursor-pointer flex flex-col items-center space-y-4"
        >
          <UploadCloud
            size={52}
            className="text-emerald-400 hover:scale-110 transition-transform"
          />

          <h2 className="text-xl font-semibold">Upload Receipt</h2>

          <p className="text-sm text-gray-400">
            Supported: JPG, PNG · AI extracts items, prices, and totals
          </p>
        </label>

        <input
          id="receiptUpload"
          type="file"
          accept="image/png, image/jpeg"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              handleUpload(e.target.files[0]);
            }
          }}
          className="hidden"
        />

        {loading && (
          <p className="mt-6 text-emerald-400 animate-pulse">
            AI is analysing your receipt...
          </p>
        )}

        {error && (
          <p className="mt-6 text-red-400">
            {error}
          </p>
        )}
      </div>

      {/* Receipt Details */}
      {receipt && (
        <div className="bg-[#0f1b33] border border-[#1f2c4d] rounded-2xl p-6 space-y-6">

          <div className="flex items-center gap-2">
            <FileText size={20} />
            <h2 className="text-xl font-semibold">Receipt Details</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <p className="text-gray-400 text-sm">Merchant</p>
              <p className="text-lg">{receipt.merchant || "Unknown"}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Date</p>
              <p className="text-lg">{receipt.receipt_date || "Unknown"}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total</p>
              <p className="text-lg font-semibold">
                £{receipt.total?.toFixed(2) || "0.00"}
              </p>
            </div>
          </div>

          {/* Scrollable Items Table */}
          <div className="max-h-[350px] overflow-y-auto mt-6 pr-2">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-[#1f2c4d]">
                  <th className="py-2">Item</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items?.map((item: Item, index: number) => (
                  <tr
                    key={index}
                    className="border-b border-[#1f2c4d] hover:bg-[#111c36]"
                  >
                    <td className="py-2">{item.name}</td>
                    <td>{item.qty}</td>
                    <td>
                      {item.unit_price
                        ? `£${item.unit_price.toFixed(2)}`
                        : "-"}
                    </td>
                    <td>
                      {item.line_total
                        ? `£${item.line_total.toFixed(2)}`
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Item Insights */}
      {receipt && receipt.items?.length > 0 && (
        <div className="bg-[#0f1b33] border border-[#1f2c4d] rounded-2xl p-6">

          <div className="flex items-center gap-2 mb-6">
            <ShoppingCart size={20} className="text-emerald-400" />
            <h2 className="text-xl font-semibold">Item Insights</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">

            <div className="bg-[#111c36] p-4 rounded-xl">
              <p className="text-gray-400 text-sm">Total Items</p>
              <p className="text-2xl font-semibold">
                {receipt.items.length}
              </p>
            </div>

            <div className="bg-[#111c36] p-4 rounded-xl">
              <p className="text-gray-400 text-sm">Most Expensive Item</p>
              <p className="text-lg font-semibold">
                {
                  receipt.items.reduce((a: any, b: any) =>
                    (a.line_total || 0) > (b.line_total || 0) ? a : b
                  ).name
                }
              </p>
            </div>

            <div className="bg-[#111c36] p-4 rounded-xl">
              <p className="text-gray-400 text-sm">Average Item Cost</p>
              <p className="text-lg font-semibold">
                £
                {(
                  receipt.items.reduce(
                    (sum: number, i: any) => sum + (i.line_total || 0),
                    0
                  ) / receipt.items.length
                ).toFixed(2)}
              </p>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
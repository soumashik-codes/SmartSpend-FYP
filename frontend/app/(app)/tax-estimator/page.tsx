"use client";

import { useState } from "react";
import { Calculator, PoundSterling } from "lucide-react";

type TaxResult = {
  gross_annual: number;
  personal_allowance: number;
  taxable_income: number;
  income_tax: number;
  national_insurance: number;
  net_annual: number;
  net_monthly: number;
};

export default function TaxEstimatorPage() {
  const [step, setStep] = useState(1);
  const [gross, setGross] = useState("");
  const [payFrequency, setPayFrequency] = useState("yearly");
  const [result, setResult] = useState<TaxResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function calculateTax() {
    setLoading(true);

    try {
      const annual =
        payFrequency === "monthly"
          ? parseFloat(gross) * 12
          : parseFloat(gross);

      const res = await fetch("http://127.0.0.1:8000/tax/calculate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ gross_annual: annual }),
      });

      const data = await res.json();
      setResult(data);
      setStep(3);
    } catch {
      alert("Calculation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050816] via-[#0a1124] to-[#050816] text-white p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold">Tax Estimator</h1>
        <p className="text-gray-400 mt-2">
          Estimate your UK take-home pay using SmartSpend.
        </p>
      </div>

      {/* STEP 1 */}
      {step === 1 && (
        <div className="bg-[#0f1b33] border border-[#1f2c4d] rounded-2xl p-8 space-y-6">
          <div className="flex items-center gap-2">
            <Calculator size={22} className="text-green-400" />
            <h2 className="text-xl font-semibold">
              How much are you paid?
            </h2>
          </div>

          <div>
            <label className="text-sm text-gray-400">
              Gross amount (£)
            </label>
            <div className="relative mt-2">
              <PoundSterling
                size={18}
                className="absolute left-3 top-3 text-gray-400"
              />
              <input
                type="number"
                value={gross}
                onChange={(e) => setGross(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#111c36] border border-[#1f2c4d] rounded-xl focus:outline-none focus:border-green-400"
                placeholder="Enter amount"
              />
            </div>
          </div>

          <button
            disabled={!gross}
            onClick={() => setStep(2)}
            className="bg-green-500 hover:bg-green-600 transition px-6 py-3 rounded-xl font-semibold"
          >
            Continue
          </button>
        </div>
      )}

      {/* STEP 2 */}
      {step === 2 && (
        <div className="bg-[#0f1b33] border border-[#1f2c4d] rounded-2xl p-8 space-y-6">
          <h2 className="text-xl font-semibold">
            How often are you paid?
          </h2>

          <div className="space-y-3">
            {["yearly", "monthly"].map((freq) => (
              <label
                key={freq}
                className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer border ${
                  payFrequency === freq
                    ? "border-green-400 bg-[#111c36]"
                    : "border-[#1f2c4d]"
                }`}
              >
                <input
                  type="radio"
                  value={freq}
                  checked={payFrequency === freq}
                  onChange={() => setPayFrequency(freq)}
                  className="accent-green-500"
                />
                <span className="capitalize">{freq}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-3 rounded-xl border border-[#1f2c4d]"
            >
              Back
            </button>

            <button
              onClick={calculateTax}
              className="bg-green-500 hover:bg-green-600 transition px-6 py-3 rounded-xl font-semibold"
            >
              {loading ? "Calculating..." : "Calculate Take-Home Pay"}
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — RESULTS */}
      {step === 3 && result && (
        <>
          <div className="bg-green-600 rounded-2xl p-8 text-center shadow-lg">
            <p className="text-lg opacity-80">Estimated Take-Home</p>
            <h2 className="text-4xl font-bold mt-2">
              £{result.net_annual.toLocaleString()} per year
            </h2>
            <p className="mt-2 text-lg">
              £{result.net_monthly.toLocaleString()} per month
            </p>
          </div>

          <div className="bg-[#0f1b33] border border-[#1f2c4d] rounded-2xl p-6">
            <h3 className="text-xl font-semibold mb-4">
              How This Was Calculated
            </h3>

            <div className="space-y-3 text-gray-300">
              <div className="flex justify-between">
                <span>Gross Income</span>
                <span>£{result.gross_annual.toLocaleString()}</span>
              </div>

              <div className="flex justify-between">
                <span>Personal Allowance</span>
                <span>£{result.personal_allowance.toLocaleString()}</span>
              </div>

              <div className="flex justify-between font-semibold text-white">
                <span>Taxable Income</span>
                <span>£{result.taxable_income.toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-red-400">
                <span>Income Tax</span>
                <span>-£{result.income_tax.toLocaleString()}</span>
              </div>

              <div className="flex justify-between text-red-400">
                <span>National Insurance</span>
                <span>-£{result.national_insurance.toLocaleString()}</span>
              </div>

              <div className="border-t border-[#1f2c4d] pt-4 flex justify-between font-bold text-green-400">
                <span>Net Income</span>
                <span>£{result.net_annual.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setStep(1);
              setResult(null);
              setGross("");
            }}
            className="mt-6 bg-[#111c36] border border-[#1f2c4d] px-6 py-3 rounded-xl"
          >
            Start Again
          </button>
        </>
      )}
    </div>
  );
}
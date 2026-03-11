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
  const [isOverPensionAge, setIsOverPensionAge] = useState(false);
  const [result, setResult] = useState<TaxResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPensionInfo, setShowPensionInfo] = useState(false);

  async function calculateTax() {
    setLoading(true);

    try {
      const value = parseFloat(gross);

      let annual = value;

      if (payFrequency === "monthly") annual = value * 12;
      if (payFrequency === "weekly") annual = value * 52;
      if (payFrequency === "every_4_weeks") annual = value * 13;
      if (payFrequency === "daily") annual = value * 260;
      if (payFrequency === "hourly") annual = value * 40 * 52;

      const res = await fetch("http://127.0.0.1:8000/tax/calculate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gross_annual: annual,
          over_pension_age: isOverPensionAge,
        }),
      });

      const data = await res.json();
      setResult(data);
      setStep(4);
    } catch {
      alert("Calculation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-white space-y-10">

      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold">Tax Estimator</h1>
        <p className="text-gray-400 mt-2">
          Estimate your UK take-home pay using SmartSpend.
        </p>
      </div>

      {/* STEP 1 — Income */}
      {step === 1 && (
        <div className="bg-[#0f1b33] border border-[#1f2c4d] rounded-2xl p-8 space-y-8">

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

          <div>
            <h3 className="text-sm text-gray-400 mb-4">
              How often are you paid this amount?
            </h3>

            <div className="space-y-3">
              {[
                "yearly",
                "monthly",
                "every_4_weeks",
                "weekly",
                "daily",
                "hourly",
              ].map((freq) => (
                <label
                  key={freq}
                  className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer border transition ${payFrequency === freq
                    ? "border-green-400 bg-[#111c36]"
                    : "border-[#1f2c4d]"
                    }`}
                >
                  <input
                    type="radio"
                    checked={payFrequency === freq}
                    onChange={() => setPayFrequency(freq)}
                    className="accent-green-500"
                  />
                  <span>{freq.replace("_", " ")}</span>
                </label>
              ))}
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

      {/* STEP 2 — Pension */}
      {step === 2 && (
        <div className="bg-[#0f1b33] border border-[#1f2c4d] rounded-2xl p-8 space-y-8">

          <h2 className="text-2xl font-bold">
            Are you over the State Pension age?
          </h2>

          <div className="space-y-4">
            {["yes", "no"].map((option) => (
              <label
                key={option}
                className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer border ${(option === "yes" && isOverPensionAge) ||
                  (option === "no" && !isOverPensionAge)
                  ? "border-green-400 bg-[#111c36]"
                  : "border-[#1f2c4d]"
                  }`}
              >
                <input
                  type="radio"
                  checked={
                    (option === "yes" && isOverPensionAge) ||
                    (option === "no" && !isOverPensionAge)
                  }
                  onChange={() =>
                    setIsOverPensionAge(option === "yes")
                  }
                  className="accent-green-500"
                />
                <span className="capitalize">{option}</span>
              </label>
            ))}
          </div>

          {/* Why we ask this - Collapsible */}
          <div>

            <button
              onClick={() => setShowPensionInfo(!showPensionInfo)}
              className="flex items-center gap-2 text-green-400 hover:text-green-300 font-medium"
            >
              <span className="text-lg">
                {showPensionInfo ? "▾" : "▸"}
              </span>
              Why we ask this?
            </button>

            {showPensionInfo && (
              <div className="mt-4 bg-[#111c36] border border-[#1f2c4d] rounded-xl p-5 text-sm text-gray-400 leading-relaxed">
                If you are over the State Pension age, you do not pay National Insurance
                unless you are self-employed and pay Class 4 contributions.
                <br /><br />
                This affects how your take-home pay is calculated.
              </div>
            )}

          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-3 rounded-xl border border-[#1f2c4d]"
            >
              Back
            </button>

            <button
              onClick={() => setStep(3)}
              className="bg-green-500 hover:bg-green-600 transition px-6 py-3 rounded-xl font-semibold"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* STEP 3 — Review */}
      {step === 3 && (
        <div className="space-y-10">

          {/* YOUR INCOME CARD */}
          <div className="bg-[#0f1b33] border border-[#1f2c4d] rounded-2xl p-8">

            <h2 className="text-3xl font-bold mb-8">
              Your Income
            </h2>

            <div className="space-y-6">

              {/* Gross Income */}
              <div className="flex justify-between items-start border-b border-[#1f2c4d] pb-5">
                <div>
                  <p className="font-semibold text-lg">Gross income</p>
                  <p className="text-gray-400 mt-1">
                    £{Number(gross).toLocaleString()} a {payFrequency.replace("_", " ")}
                  </p>
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="text-green-400 hover:text-green-300 font-medium"
                >
                  Change
                </button>
              </div>

              {/* State Pension */}
              <div className="flex justify-between items-start border-b border-[#1f2c4d] pb-5">
                <div>
                  <p className="font-semibold text-lg">
                    Over State Pension age
                  </p>
                  <p className="text-gray-400 mt-1">
                    {isOverPensionAge ? "Yes" : "No"}
                  </p>
                </div>
                <button
                  onClick={() => setStep(2)}
                  className="text-green-400 hover:text-green-300 font-medium"
                >
                  Change
                </button>
              </div>

            </div>
          </div>

          {/* OPTIONAL QUESTIONS CARD */}
          <div className="bg-[#0f1b33] border border-[#1f2c4d] rounded-2xl p-8">

            <h3 className="text-2xl font-bold">
              Additional questions
              <span className="text-gray-400 text-lg font-normal ml-2">
                (Optional)
              </span>
            </h3>

            <p className="text-gray-400 mt-2">
              Your results may be more accurate if you answer additional questions.
            </p>

            <div className="mt-8 space-y-6">

              {[
                "Tax Code",
                "Scottish Income Tax",
                "Pension contributions",
                "Student loan",
                "Postgraduate loan",
              ].map((item) => (
                <div
                  key={item}
                  className="flex justify-between items-start border-b border-[#1f2c4d] pb-5"
                >
                  <div>
                    <p className="font-semibold text-lg">{item}</p>
                    <p className="text-gray-400 mt-1">
                      Not provided
                    </p>
                  </div>

                  <button className="text-green-400 hover:text-green-300 font-medium">
                    Add
                  </button>
                </div>
              ))}

            </div>

          </div>

          {/* CALCULATE BUTTON */}
          <div className="pt-2">
            <button
              onClick={calculateTax}
              className="bg-green-500 hover:bg-green-600 transition px-8 py-4 rounded-xl font-semibold text-lg"
            >
              {loading ? "Calculating..." : "Calculate take-home pay"}
            </button>
          </div>

        </div>
      )}

      {/* STEP 4 — Results */}
      {step === 4 && result && (
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
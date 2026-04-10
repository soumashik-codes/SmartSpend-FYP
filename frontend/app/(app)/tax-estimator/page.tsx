"use client";

import { useMemo, useState } from "react";
import { Calculator, ChevronDown, ChevronUp, PoundSterling } from "lucide-react";

import { buildApiUrl } from "@/lib/api";

type PayFrequency = "yearly" | "monthly" | "every_4_weeks" | "weekly" | "daily" | "hourly";
type PensionContributionType = "none" | "salary_sacrifice" | "net_pay" | "relief_at_source";
type PensionValueType = "percent" | "amount";
type StudentLoanPlan = "none" | "plan_1" | "plan_2" | "plan_4";

type TaxBandBreakdown = {
  label: string;
  rate: number;
  taxable_amount: number;
  tax_due: number;
};

type TaxResult = {
  gross_annual: number;
  adjusted_gross_annual: number;
  personal_allowance: number;
  taxable_income: number;
  income_tax: number;
  national_insurance: number;
  student_loan: number;
  postgraduate_loan: number;
  pension_contribution: number;
  pension_contribution_type: string | null;
  pension_tax_relief_estimate: number;
  net_annual: number;
  net_monthly: number;
  tax_code_used: string;
  uses_scottish_income_tax: boolean;
  over_pension_age: boolean;
  income_tax_breakdown: TaxBandBreakdown[];
  notes: string[];
};

const PAY_FREQUENCIES: { value: PayFrequency; label: string }[] = [
  { value: "yearly", label: "Yearly" },
  { value: "monthly", label: "Monthly" },
  { value: "every_4_weeks", label: "Every 4 weeks" },
  { value: "weekly", label: "Weekly" },
  { value: "daily", label: "Daily" },
  { value: "hourly", label: "Hourly" },
];

const PENSION_TYPES: { value: PensionContributionType; label: string }[] = [
  { value: "salary_sacrifice", label: "Salary sacrifice" },
  { value: "net_pay", label: "Net pay arrangement" },
  { value: "relief_at_source", label: "Relief at source" },
];

const STUDENT_LOAN_OPTIONS: { value: StudentLoanPlan; label: string }[] = [
  { value: "none", label: "No student loan" },
  { value: "plan_1", label: "Plan 1" },
  { value: "plan_2", label: "Plan 2" },
  { value: "plan_4", label: "Plan 4 (Scotland)" },
];

function annualiseGross(value: number, payFrequency: PayFrequency) {
  if (payFrequency === "monthly") return value * 12;
  if (payFrequency === "weekly") return value * 52;
  if (payFrequency === "every_4_weeks") return value * 13;
  if (payFrequency === "daily") return value * 260;
  if (payFrequency === "hourly") return value * 40 * 52;
  return value;
}

function convertAnnualToFrequency(value: number, payFrequency: PayFrequency) {
  if (payFrequency === "monthly") return value / 12;
  if (payFrequency === "weekly") return value / 52;
  if (payFrequency === "every_4_weeks") return value / 13;
  if (payFrequency === "daily") return value / 260;
  if (payFrequency === "hourly") return value / (40 * 52);
  return value;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(value);
}

function sentenceCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function TaxEstimatorPage() {
  const [step, setStep] = useState(1);
  const [gross, setGross] = useState("");
  const [payFrequency, setPayFrequency] = useState<PayFrequency>("yearly");
  const [isOverPensionAge, setIsOverPensionAge] = useState(false);
  const [showPensionInfo, setShowPensionInfo] = useState(false);

  const [taxCodeEnabled, setTaxCodeEnabled] = useState(false);
  const [taxCode, setTaxCode] = useState("");
  const [scottishTaxEnabled, setScottishTaxEnabled] = useState(false);
  const [useScottishTax, setUseScottishTax] = useState(false);
  const [pensionEnabled, setPensionEnabled] = useState(false);
  const [pensionContributionType, setPensionContributionType] = useState<PensionContributionType>("salary_sacrifice");
  const [pensionValueType, setPensionValueType] = useState<PensionValueType>("percent");
  const [pensionValue, setPensionValue] = useState("");
  const [studentLoanEnabled, setStudentLoanEnabled] = useState(false);
  const [studentLoanPlan, setStudentLoanPlan] = useState<StudentLoanPlan>("none");
  const [postgraduateLoanEnabled, setPostgraduateLoanEnabled] = useState(false);
  const [hasPostgraduateLoan, setHasPostgraduateLoan] = useState(false);

  const [result, setResult] = useState<TaxResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const grossValue = Number.parseFloat(gross);
  const annualGross = Number.isFinite(grossValue) ? annualiseGross(grossValue, payFrequency) : 0;
  const takeHomeForSelectedFrequency = useMemo(() => {
    if (!result) {
      return 0;
    }
    return convertAnnualToFrequency(result.net_annual, payFrequency);
  }, [payFrequency, result]);

  async function calculateTax() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(buildApiUrl("/tax/calculate"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gross_annual: annualGross,
          over_pension_age: isOverPensionAge,
          tax_code: taxCodeEnabled ? taxCode.trim() || null : null,
          use_scottish_tax: scottishTaxEnabled ? useScottishTax : false,
          pension_contribution_type: pensionEnabled ? pensionContributionType : null,
          pension_contribution_value_type: pensionEnabled ? pensionValueType : null,
          pension_contribution_value: pensionEnabled && pensionValue ? Number(pensionValue) : null,
          student_loan_plan: studentLoanEnabled && studentLoanPlan !== "none" ? studentLoanPlan : null,
          has_postgraduate_loan: postgraduateLoanEnabled ? hasPostgraduateLoan : false,
        }),
      });

      if (!response.ok) {
        throw new Error("Could not calculate tax.");
      }

      const data: TaxResult = await response.json();
      setResult(data);
      setStep(4);
    } catch {
      setError("We could not calculate your take-home pay right now. Please check your entries and try again.");
    } finally {
      setLoading(false);
    }
  }

  function resetCalculator() {
    setStep(1);
    setGross("");
    setPayFrequency("yearly");
    setIsOverPensionAge(false);
    setShowPensionInfo(false);
    setTaxCodeEnabled(false);
    setTaxCode("");
    setScottishTaxEnabled(false);
    setUseScottishTax(false);
    setPensionEnabled(false);
    setPensionContributionType("salary_sacrifice");
    setPensionValueType("percent");
    setPensionValue("");
    setStudentLoanEnabled(false);
    setStudentLoanPlan("none");
    setPostgraduateLoanEnabled(false);
    setHasPostgraduateLoan(false);
    setResult(null);
    setLoading(false);
    setError("");
  }

  const optionalItems = [
    {
      label: "Tax Code",
      enabled: taxCodeEnabled,
      onToggle: () => setTaxCodeEnabled((value) => !value),
      summary: taxCodeEnabled && taxCode.trim() ? taxCode.toUpperCase() : "Not provided",
      body: (
        <div className="mt-4 rounded-xl border border-[#1f2c4d] bg-[#111c36] p-4">
          <label className="text-sm text-gray-400">Tax code</label>
          <input
            value={taxCode}
            onChange={(event) => setTaxCode(event.target.value.toUpperCase())}
            placeholder="1257L"
            className="mt-2 w-full rounded-xl border border-[#1f2c4d] bg-[#0d1730] px-4 py-3 text-white outline-none transition focus:border-green-400"
          />
          <p className="mt-3 text-sm text-gray-400">
            Examples: <span className="text-white">1257L</span>, <span className="text-white">BR</span>, <span className="text-white">D0</span>, <span className="text-white">S1257L</span>.
          </p>
        </div>
      ),
    },
    {
      label: "Scottish Income Tax",
      enabled: scottishTaxEnabled,
      onToggle: () => setScottishTaxEnabled((value) => !value),
      summary: scottishTaxEnabled ? (useScottishTax ? "Use Scottish tax bands" : "Use UK tax bands") : "Not provided",
      body: (
        <div className="mt-4 rounded-xl border border-[#1f2c4d] bg-[#111c36] p-4">
          <p className="text-sm text-gray-400">Do you pay Scottish Income Tax?</p>
          <div className="mt-3 flex gap-3">
            {[
              { value: false, label: "No" },
              { value: true, label: "Yes" },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => setUseScottishTax(option.value)}
                className={`rounded-xl border px-4 py-2 text-sm transition ${
                  useScottishTax === option.value
                    ? "border-green-400 bg-green-500/10 text-white"
                    : "border-[#1f2c4d] text-gray-400 hover:text-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ),
    },
    {
      label: "Pension contributions",
      enabled: pensionEnabled,
      onToggle: () => setPensionEnabled((value) => !value),
      summary: pensionEnabled && pensionValue
        ? `${sentenceCase(pensionContributionType)} · ${pensionValueType === "percent" ? `${pensionValue}%` : formatCurrency(Number(pensionValue))}`
        : "Not provided",
      body: (
        <div className="mt-4 rounded-xl border border-[#1f2c4d] bg-[#111c36] p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm text-gray-400">Contribution method</label>
              <select
                value={pensionContributionType}
                onChange={(event) => setPensionContributionType(event.target.value as PensionContributionType)}
                className="mt-2 w-full rounded-xl border border-[#1f2c4d] bg-[#0d1730] px-4 py-3 text-white outline-none transition focus:border-green-400"
              >
                {PENSION_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-400">Contribution input</label>
              <select
                value={pensionValueType}
                onChange={(event) => setPensionValueType(event.target.value as PensionValueType)}
                className="mt-2 w-full rounded-xl border border-[#1f2c4d] bg-[#0d1730] px-4 py-3 text-white outline-none transition focus:border-green-400"
              >
                <option value="percent">Percent of gross pay</option>
                <option value="amount">Annual amount (£)</option>
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-sm text-gray-400">
              {pensionValueType === "percent" ? "Contribution percent" : "Annual contribution (£)"}
            </label>
            <input
              type="number"
              min="0"
              step={pensionValueType === "percent" ? "0.1" : "1"}
              value={pensionValue}
              onChange={(event) => setPensionValue(event.target.value)}
              className="mt-2 w-full rounded-xl border border-[#1f2c4d] bg-[#0d1730] px-4 py-3 text-white outline-none transition focus:border-green-400"
              placeholder={pensionValueType === "percent" ? "5" : "1200"}
            />
          </div>
        </div>
      ),
    },
    {
      label: "Student loan",
      enabled: studentLoanEnabled,
      onToggle: () => setStudentLoanEnabled((value) => !value),
      summary: studentLoanEnabled && studentLoanPlan !== "none" ? STUDENT_LOAN_OPTIONS.find((option) => option.value === studentLoanPlan)?.label ?? "Selected" : "Not provided",
      body: (
        <div className="mt-4 rounded-xl border border-[#1f2c4d] bg-[#111c36] p-4">
          <label className="text-sm text-gray-400">Repayment plan</label>
          <select
            value={studentLoanPlan}
            onChange={(event) => setStudentLoanPlan(event.target.value as StudentLoanPlan)}
            className="mt-2 w-full rounded-xl border border-[#1f2c4d] bg-[#0d1730] px-4 py-3 text-white outline-none transition focus:border-green-400"
          >
            {STUDENT_LOAN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ),
    },
    {
      label: "Postgraduate loan",
      enabled: postgraduateLoanEnabled,
      onToggle: () => setPostgraduateLoanEnabled((value) => !value),
      summary: postgraduateLoanEnabled ? (hasPostgraduateLoan ? "Yes" : "No") : "Not provided",
      body: (
        <div className="mt-4 rounded-xl border border-[#1f2c4d] bg-[#111c36] p-4">
          <p className="text-sm text-gray-400">Do you repay a postgraduate loan?</p>
          <div className="mt-3 flex gap-3">
            {[
              { value: false, label: "No" },
              { value: true, label: "Yes" },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => setHasPostgraduateLoan(option.value)}
                className={`rounded-xl border px-4 py-2 text-sm transition ${
                  hasPostgraduateLoan === option.value
                    ? "border-green-400 bg-green-500/10 text-white"
                    : "border-[#1f2c4d] text-gray-400 hover:text-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-10 text-white">
      <div>
        <h1 className="text-4xl font-bold">Tax Estimator</h1>
        <p className="mt-2 text-gray-400">
          Estimate your UK take-home pay using current 2025/26 tax, National Insurance, and loan rules.
        </p>
      </div>

      {step === 1 ? (
        <div className="space-y-8 rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] p-8">
          <div className="flex items-center gap-2">
            <Calculator size={22} className="text-green-400" />
            <h2 className="text-xl font-semibold">How much are you paid?</h2>
          </div>

          <div>
            <label className="text-sm text-gray-400">Gross amount (£)</label>
            <div className="relative mt-2">
              <PoundSterling size={18} className="absolute left-3 top-3 text-gray-400" />
              <input
                type="number"
                min="0"
                value={gross}
                onChange={(event) => setGross(event.target.value)}
                className="w-full rounded-xl border border-[#1f2c4d] bg-[#111c36] py-3 pl-10 pr-4 outline-none transition focus:border-green-400"
                placeholder="Enter amount"
              />
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-sm text-gray-400">How often are you paid this amount?</h3>
            <div className="space-y-3">
              {PAY_FREQUENCIES.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
                    payFrequency === option.value
                      ? "border-green-400 bg-[#111c36]"
                      : "border-[#1f2c4d]"
                  }`}
                >
                  <input
                    type="radio"
                    checked={payFrequency === option.value}
                    onChange={() => setPayFrequency(option.value)}
                    className="accent-green-500"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            disabled={!gross || annualGross <= 0}
            onClick={() => setStep(2)}
            className="rounded-xl bg-green-500 px-6 py-3 font-semibold transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-8 rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] p-8">
          <h2 className="text-2xl font-bold">Are you over the State Pension age?</h2>

          <div className="space-y-4">
            {[
              { value: true, label: "Yes" },
              { value: false, label: "No" },
            ].map((option) => (
              <label
                key={option.label}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${
                  isOverPensionAge === option.value
                    ? "border-green-400 bg-[#111c36]"
                    : "border-[#1f2c4d]"
                }`}
              >
                <input
                  type="radio"
                  checked={isOverPensionAge === option.value}
                  onChange={() => setIsOverPensionAge(option.value)}
                  className="accent-green-500"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>

          <div>
            <button
              onClick={() => setShowPensionInfo((value) => !value)}
              className="flex items-center gap-2 font-medium text-green-400 transition hover:text-green-300"
            >
              {showPensionInfo ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              Why we ask this
            </button>

            {showPensionInfo ? (
              <div className="mt-4 rounded-xl border border-[#1f2c4d] bg-[#111c36] p-5 text-sm leading-relaxed text-gray-400">
                If you are over State Pension age, you normally do not pay employee National Insurance on employment income.
                This changes your estimated take-home pay.
              </div>
            ) : null}
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep(1)}
              className="rounded-xl border border-[#1f2c4d] px-6 py-3"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="rounded-xl bg-green-500 px-6 py-3 font-semibold transition hover:bg-green-600"
            >
              Continue
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-10">
          <div className="rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] p-8">
            <h2 className="mb-8 text-3xl font-bold">Your Income</h2>

            <div className="space-y-6">
              <div className="flex items-start justify-between border-b border-[#1f2c4d] pb-5">
                <div>
                  <p className="text-lg font-semibold">Gross income</p>
                  <p className="mt-1 text-gray-400">
                    {formatCurrency(Number(gross || 0))} a {sentenceCase(payFrequency)}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Equivalent to {formatCurrency(annualGross)} per year
                  </p>
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="font-medium text-green-400 transition hover:text-green-300"
                >
                  Change
                </button>
              </div>

              <div className="flex items-start justify-between border-b border-[#1f2c4d] pb-5">
                <div>
                  <p className="text-lg font-semibold">Over State Pension age</p>
                  <p className="mt-1 text-gray-400">{isOverPensionAge ? "Yes" : "No"}</p>
                </div>
                <button
                  onClick={() => setStep(2)}
                  className="font-medium text-green-400 transition hover:text-green-300"
                >
                  Change
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] p-8">
            <h3 className="text-2xl font-bold">
              Additional questions
              <span className="ml-2 text-lg font-normal text-gray-400">(Optional)</span>
            </h3>

            <p className="mt-2 text-gray-400">
              Add only the options that apply to you. These answers make the estimate more realistic.
            </p>

            <div className="mt-8 space-y-6">
              {optionalItems.map((item) => (
                <div key={item.label} className="border-b border-[#1f2c4d] pb-5 last:border-b-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-semibold">{item.label}</p>
                      <p className="mt-1 text-gray-400">{item.summary}</p>
                    </div>
                    <button
                      onClick={item.onToggle}
                      className="font-medium text-green-400 transition hover:text-green-300"
                    >
                      {item.enabled ? "Remove" : "Add"}
                    </button>
                  </div>
                  {item.enabled ? item.body : null}
                </div>
              ))}
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          <div className="pt-2">
            <button
              onClick={calculateTax}
              disabled={loading}
              className="rounded-xl bg-green-500 px-8 py-4 text-lg font-semibold transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Calculating..." : "Calculate take-home pay"}
            </button>
          </div>
        </div>
      ) : null}

      {step === 4 && result ? (
        <>
          <div className="rounded-2xl bg-green-600 p-8 text-center shadow-lg">
            <p className="text-lg opacity-80">Estimated take-home</p>
            <h2 className="mt-2 text-4xl font-bold">
              {formatCurrency(result.net_annual)} per year
            </h2>
            <p className="mt-2 text-lg">
              {formatCurrency(result.net_monthly)} per month
            </p>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] p-6">
              <h3 className="mb-4 text-xl font-semibold">How this was calculated</h3>

              <div className="space-y-3 text-gray-300">
                <div className="flex justify-between">
                  <span>Gross income</span>
                  <span>{formatCurrency(result.gross_annual)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxable pay after pension adjustments</span>
                  <span>{formatCurrency(result.adjusted_gross_annual)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Personal allowance</span>
                  <span>{formatCurrency(result.personal_allowance)}</span>
                </div>
                <div className="flex justify-between font-semibold text-white">
                  <span>Taxable income</span>
                  <span>{formatCurrency(result.taxable_income)}</span>
                </div>
                <div className="flex justify-between text-red-400">
                  <span>Income Tax</span>
                  <span>-{formatCurrency(result.income_tax)}</span>
                </div>
                <div className="flex justify-between text-red-400">
                  <span>National Insurance</span>
                  <span>-{formatCurrency(result.national_insurance)}</span>
                </div>
                <div className="flex justify-between text-red-400">
                  <span>Student loan</span>
                  <span>-{formatCurrency(result.student_loan)}</span>
                </div>
                <div className="flex justify-between text-red-400">
                  <span>Postgraduate loan</span>
                  <span>-{formatCurrency(result.postgraduate_loan)}</span>
                </div>
                <div className="flex justify-between text-red-400">
                  <span>Pension contribution</span>
                  <span>-{formatCurrency(result.pension_contribution)}</span>
                </div>
                {result.pension_tax_relief_estimate > 0 ? (
                  <div className="flex justify-between text-emerald-300">
                    <span>Extra pension tax relief estimate</span>
                    <span>{formatCurrency(result.pension_tax_relief_estimate)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-[#1f2c4d] pt-4 text-lg font-bold text-green-400">
                  <span>Net income</span>
                  <span>{formatCurrency(result.net_annual)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] p-6">
                <h3 className="text-xl font-semibold">Income Tax breakdown</h3>
                <div className="mt-4 space-y-3">
                  {result.income_tax_breakdown.length ? result.income_tax_breakdown.map((band) => (
                    <div key={band.label} className="rounded-xl border border-[#1f2c4d] bg-[#111c36] p-4">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-white">{band.label}</p>
                        <p className="text-sm text-green-300">{(band.rate * 100).toFixed(0)}%</p>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm text-gray-400">
                        <span>Taxed amount</span>
                        <span>{formatCurrency(band.taxable_amount)}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-sm text-gray-400">
                        <span>Tax due</span>
                        <span>{formatCurrency(band.tax_due)}</span>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-gray-400">No Income Tax is due on this estimate.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] p-6">
                <h3 className="text-xl font-semibold">Applied settings</h3>
                <div className="mt-4 space-y-2 text-sm text-gray-300">
                  <div className="flex justify-between">
                    <span>Tax code</span>
                    <span>{result.tax_code_used}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Scottish Income Tax</span>
                    <span>{result.uses_scottish_income_tax ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Over State Pension age</span>
                    <span>{result.over_pension_age ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pension method</span>
                    <span>{sentenceCase(result.pension_contribution_type || "none")}</span>
                  </div>
                </div>

                {result.notes.length ? (
                  <div className="mt-5 rounded-xl border border-[#1f2c4d] bg-[#111c36] p-4 text-sm text-gray-400">
                    <p className="mb-2 font-medium text-white">Notes</p>
                    <div className="space-y-2">
                      {result.notes.map((note) => (
                        <p key={note}>{note}</p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep(3)}
              className="rounded-xl border border-[#1f2c4d] px-6 py-3"
            >
              Back to details
            </button>
            <button
              onClick={resetCalculator}
              className="rounded-xl bg-[#111c36] px-6 py-3"
            >
              Start again
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

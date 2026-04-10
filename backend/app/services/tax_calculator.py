from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


PERSONAL_ALLOWANCE = 12_570.0
PERSONAL_ALLOWANCE_TAPER_START = 100_000.0
PERSONAL_ALLOWANCE_TAPER_END = 125_140.0

UK_BANDS = (
    ("Basic rate", 37_700.0, 0.20),
    ("Higher rate", 87_440.0, 0.40),
    ("Additional rate", None, 0.45),
)

SCOTTISH_BANDS = (
    ("Starter rate", 2_827.0, 0.19),
    ("Basic rate", 11_685.0, 0.20),
    ("Intermediate rate", 17_101.0, 0.21),
    ("Higher rate", 75_000.0, 0.42),
    ("Advanced rate", 62_430.0, 0.45),
    ("Top rate", None, 0.48),
)

NI_PRIMARY_THRESHOLD = 12_570.0
NI_UPPER_EARNINGS_LIMIT = 50_270.0
NI_MAIN_RATE = 0.08
NI_ADDITIONAL_RATE = 0.02

STUDENT_LOAN_PLANS = {
    "plan_1": {"threshold": 26_065.0, "rate": 0.09, "label": "Plan 1"},
    "plan_2": {"threshold": 28_470.0, "rate": 0.09, "label": "Plan 2"},
    "plan_4": {"threshold": 32_745.0, "rate": 0.09, "label": "Plan 4"},
}

POSTGRAD_THRESHOLD = 21_000.0
POSTGRAD_RATE = 0.06

SPECIAL_TAX_CODES = {"BR", "D0", "D1", "NT", "0T"}


@dataclass
class TaxBandResult:
    label: str
    rate: float
    taxable_amount: float
    tax_due: float


def _round_money(value: float) -> float:
    return round(float(value), 2)


def _clamp_non_negative(value: float) -> float:
    return max(float(value), 0.0)


def _normalise_tax_code(tax_code: str | None) -> str:
    if not tax_code:
        return ""
    return tax_code.replace(" ", "").upper()


def _parse_tax_code(tax_code: str | None) -> tuple[str, float | None, str | None]:
    code = _normalise_tax_code(tax_code)
    if not code:
        return "", None, None

    region = None
    if code[0] in {"S", "C"}:
        region = code[0]
        code = code[1:]

    if code in SPECIAL_TAX_CODES:
        return code, None, region

    if code.startswith("K") and code[1:].isdigit():
        return code, -(int(code[1:]) * 10.0), region

    digits = "".join(char for char in code if char.isdigit())
    if digits:
        return code, int(digits) * 10.0, region

    return code, None, region


def _default_personal_allowance(gross_annual: float) -> float:
    if gross_annual <= PERSONAL_ALLOWANCE_TAPER_START:
        return PERSONAL_ALLOWANCE
    if gross_annual >= PERSONAL_ALLOWANCE_TAPER_END:
        return 0.0

    reduction = (gross_annual - PERSONAL_ALLOWANCE_TAPER_START) / 2.0
    return max(PERSONAL_ALLOWANCE - reduction, 0.0)


def _calculate_tax_by_bands(taxable_income: float, bands: Iterable[tuple[str, float | None, float]]) -> tuple[float, list[TaxBandResult]]:
    remaining = max(taxable_income, 0.0)
    total_tax = 0.0
    breakdown: list[TaxBandResult] = []

    for label, width, rate in bands:
        if remaining <= 0:
            break

        taxable_at_band = remaining if width is None else min(remaining, width)
        tax_due = taxable_at_band * rate
        breakdown.append(
            TaxBandResult(
                label=label,
                rate=rate,
                taxable_amount=_round_money(taxable_at_band),
                tax_due=_round_money(tax_due),
            )
        )
        total_tax += tax_due
        remaining -= taxable_at_band

    return _round_money(total_tax), breakdown


def _calculate_standard_income_tax(taxable_income: float, uses_scottish_income_tax: bool) -> tuple[float, list[TaxBandResult]]:
    bands = SCOTTISH_BANDS if uses_scottish_income_tax else UK_BANDS
    return _calculate_tax_by_bands(taxable_income, bands)


def _calculate_special_tax_code_income_tax(gross_for_tax: float, code: str, uses_scottish_income_tax: bool) -> tuple[float, list[TaxBandResult], float]:
    taxable_income = max(gross_for_tax, 0.0)

    if code == "NT":
        return 0.0, [], taxable_income

    special_rates = {
        "BR": 0.20,
        "D0": 0.42 if uses_scottish_income_tax else 0.40,
        "D1": 0.48 if uses_scottish_income_tax else 0.45,
        "0T": None,
    }

    if code == "0T":
        total_tax, breakdown = _calculate_standard_income_tax(taxable_income, uses_scottish_income_tax)
        return total_tax, breakdown, taxable_income

    rate = special_rates[code]
    tax_due = taxable_income * rate
    label_lookup = {
        "BR": "Basic rate",
        "D0": "Higher rate",
        "D1": "Additional rate",
    }
    breakdown = [
        TaxBandResult(
            label=label_lookup[code],
            rate=rate,
            taxable_amount=_round_money(taxable_income),
            tax_due=_round_money(tax_due),
        )
    ]
    return _round_money(tax_due), breakdown, taxable_income


def _calculate_national_insurance(ni_earnings: float, over_pension_age: bool) -> float:
    if over_pension_age:
        return 0.0

    earnings = max(ni_earnings, 0.0)
    if earnings <= NI_PRIMARY_THRESHOLD:
        return 0.0

    main_band = min(earnings, NI_UPPER_EARNINGS_LIMIT) - NI_PRIMARY_THRESHOLD
    additional_band = max(earnings - NI_UPPER_EARNINGS_LIMIT, 0.0)
    contribution = (main_band * NI_MAIN_RATE) + (additional_band * NI_ADDITIONAL_RATE)
    return _round_money(contribution)


def _calculate_student_loan(loan_earnings: float, student_loan_plan: str | None) -> float:
    if not student_loan_plan:
        return 0.0

    plan = STUDENT_LOAN_PLANS.get(student_loan_plan)
    if not plan:
        return 0.0

    repayment_income = max(loan_earnings - plan["threshold"], 0.0)
    return _round_money(repayment_income * plan["rate"])


def _calculate_postgraduate_loan(loan_earnings: float, has_postgraduate_loan: bool) -> float:
    if not has_postgraduate_loan:
        return 0.0

    repayment_income = max(loan_earnings - POSTGRAD_THRESHOLD, 0.0)
    return _round_money(repayment_income * POSTGRAD_RATE)


def _resolve_pension_contribution(gross_annual: float, contribution_value_type: str | None, contribution_value: float | None) -> float:
    if not contribution_value or contribution_value <= 0:
        return 0.0

    if contribution_value_type == "percent":
        return _round_money(gross_annual * (contribution_value / 100.0))

    return _round_money(contribution_value)


def _estimate_relief_at_source_extra_tax_relief(
    gross_for_tax: float,
    gross_pension_contribution: float,
    uses_scottish_income_tax: bool,
    default_personal_allowance: float,
) -> float:
    if gross_pension_contribution <= 0:
        return 0.0

    taxable_before = max(gross_for_tax - default_personal_allowance, 0.0)
    tax_before, _ = _calculate_standard_income_tax(taxable_before, uses_scottish_income_tax)

    taxable_after = max(taxable_before - gross_pension_contribution, 0.0)
    tax_after, _ = _calculate_standard_income_tax(taxable_after, uses_scottish_income_tax)

    extra_relief = max(tax_before - tax_after, 0.0)
    basic_relief = gross_pension_contribution * 0.20
    return _round_money(max(extra_relief - basic_relief, 0.0))


def calculate_uk_tax(
    gross_annual: float,
    over_pension_age: bool = False,
    tax_code: str | None = None,
    use_scottish_tax: bool = False,
    pension_contribution_type: str | None = None,
    pension_contribution_value_type: str | None = None,
    pension_contribution_value: float | None = None,
    student_loan_plan: str | None = None,
    has_postgraduate_loan: bool = False,
):
    gross_annual = _round_money(max(gross_annual, 0.0))
    normalized_tax_code = _normalise_tax_code(tax_code)
    parsed_code, tax_code_allowance, tax_code_region = _parse_tax_code(tax_code)
    uses_scottish_income_tax = use_scottish_tax or tax_code_region == "S"

    pension_contribution_type = (pension_contribution_type or "none").lower()
    pension_contribution_value_type = (pension_contribution_value_type or "amount").lower()
    pension_contribution = _resolve_pension_contribution(
        gross_annual,
        pension_contribution_value_type,
        pension_contribution_value,
    )

    gross_for_tax = gross_annual
    ni_earnings = gross_annual
    loan_earnings = gross_annual
    pension_cash_deduction = 0.0
    pension_tax_relief_estimate = 0.0
    notes: list[str] = []

    if pension_contribution_type == "salary_sacrifice":
        gross_for_tax = max(gross_annual - pension_contribution, 0.0)
        ni_earnings = gross_for_tax
        loan_earnings = gross_for_tax
        pension_cash_deduction = pension_contribution
        notes.append("Salary sacrifice reduces your taxable pay, National Insurance, and student loan earnings.")
    elif pension_contribution_type == "net_pay":
        gross_for_tax = max(gross_annual - pension_contribution, 0.0)
        pension_cash_deduction = pension_contribution
        notes.append("Net pay pension contributions reduce taxable pay before Income Tax is calculated.")
    elif pension_contribution_type == "relief_at_source":
        pension_cash_deduction = pension_contribution
        gross_pension_contribution = pension_contribution / 0.80 if pension_contribution > 0 else 0.0
        pension_tax_relief_estimate = _estimate_relief_at_source_extra_tax_relief(
            gross_for_tax,
            gross_pension_contribution,
            uses_scottish_income_tax,
            _default_personal_allowance(gross_for_tax),
        )
        if pension_tax_relief_estimate > 0:
            notes.append("The pension tax relief estimate shows extra higher-rate relief you may need to claim separately.")
    else:
        pension_contribution_type = "none"
        pension_contribution = 0.0

    default_allowance = _default_personal_allowance(gross_for_tax)
    personal_allowance = default_allowance if tax_code_allowance is None else tax_code_allowance
    tax_code_used = normalized_tax_code or "1257L"

    if parsed_code in SPECIAL_TAX_CODES:
        income_tax, income_tax_breakdown, taxable_income = _calculate_special_tax_code_income_tax(
            gross_for_tax,
            parsed_code,
            uses_scottish_income_tax,
        )
        if parsed_code == "NT":
            personal_allowance = 0.0
    else:
        taxable_income = max(gross_for_tax - personal_allowance, 0.0)
        income_tax, income_tax_breakdown = _calculate_standard_income_tax(taxable_income, uses_scottish_income_tax)

    national_insurance = _calculate_national_insurance(ni_earnings, over_pension_age)
    student_loan = _calculate_student_loan(loan_earnings, student_loan_plan)
    postgraduate_loan = _calculate_postgraduate_loan(loan_earnings, has_postgraduate_loan)

    net_annual = gross_annual - income_tax - national_insurance - student_loan - postgraduate_loan - pension_cash_deduction
    net_annual = _round_money(net_annual)

    if uses_scottish_income_tax:
        notes.append("Scottish Income Tax bands have been used for the Income Tax calculation.")
    if over_pension_age:
        notes.append("Employee National Insurance has been removed because you are over State Pension age.")
    if parsed_code.startswith("K"):
        notes.append("A K tax code increases the amount of income taxed because it represents a negative allowance.")
    if parsed_code in {"BR", "D0", "D1", "NT", "0T"}:
        notes.append(f"The special tax code {parsed_code} changes how Income Tax is applied to your pay.")

    return {
        "gross_annual": gross_annual,
        "adjusted_gross_annual": _round_money(gross_for_tax),
        "personal_allowance": _round_money(personal_allowance),
        "taxable_income": _round_money(_clamp_non_negative(taxable_income)),
        "income_tax": income_tax,
        "national_insurance": national_insurance,
        "student_loan": student_loan,
        "postgraduate_loan": postgraduate_loan,
        "pension_contribution": _round_money(pension_cash_deduction),
        "pension_contribution_type": pension_contribution_type,
        "pension_tax_relief_estimate": pension_tax_relief_estimate,
        "net_annual": net_annual,
        "net_monthly": _round_money(net_annual / 12.0),
        "tax_code_used": tax_code_used,
        "uses_scottish_income_tax": uses_scottish_income_tax,
        "over_pension_age": over_pension_age,
        "income_tax_breakdown": [
            {
                "label": band.label,
                "rate": band.rate,
                "taxable_amount": band.taxable_amount,
                "tax_due": band.tax_due,
            }
            for band in income_tax_breakdown
        ],
        "notes": notes,
    }

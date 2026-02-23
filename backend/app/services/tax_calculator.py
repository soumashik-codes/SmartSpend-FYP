def calculate_uk_tax(gross_annual: float):
    PERSONAL_ALLOWANCE = 12570
    BASIC_RATE_LIMIT = 50270
    HIGHER_RATE_LIMIT = 125140

    taxable_income = max(0, gross_annual - PERSONAL_ALLOWANCE)

    income_tax = 0

    # Basic rate 20%
    if gross_annual > PERSONAL_ALLOWANCE:
        basic_taxable = min(taxable_income, BASIC_RATE_LIMIT - PERSONAL_ALLOWANCE)
        income_tax += basic_taxable * 0.20

    # Higher rate 40%
    if gross_annual > BASIC_RATE_LIMIT:
        higher_taxable = min(
            gross_annual - BASIC_RATE_LIMIT,
            HIGHER_RATE_LIMIT - BASIC_RATE_LIMIT
        )
        income_tax += higher_taxable * 0.40

    # Additional rate 45%
    if gross_annual > HIGHER_RATE_LIMIT:
        additional_taxable = gross_annual - HIGHER_RATE_LIMIT
        income_tax += additional_taxable * 0.45

    # National Insurance (Class 1 simplified)
    ni = 0
    if gross_annual > PERSONAL_ALLOWANCE:
        ni_basic = min(
            gross_annual - PERSONAL_ALLOWANCE,
            BASIC_RATE_LIMIT - PERSONAL_ALLOWANCE
        )
        ni += ni_basic * 0.08

    if gross_annual > BASIC_RATE_LIMIT:
        ni_higher = gross_annual - BASIC_RATE_LIMIT
        ni += ni_higher * 0.02

    net_annual = gross_annual - income_tax - ni
    net_monthly = net_annual / 12

    return {
        "gross_annual": gross_annual,
        "personal_allowance": PERSONAL_ALLOWANCE,
        "taxable_income": taxable_income,
        "income_tax": round(income_tax, 2),
        "national_insurance": round(ni, 2),
        "net_annual": round(net_annual, 2),
        "net_monthly": round(net_monthly, 2),
    }
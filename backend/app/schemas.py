from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict
from datetime import date


class UserCreate(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    password: str


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: Optional[str] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AccountCreate(BaseModel):
    name: str
    opening_balance: float


class AccountOut(BaseModel):
    id: int
    name: str
    opening_balance: float
    current_balance: float

    class Config:
        from_attributes = True


class TransactionIn(BaseModel):
    date: str
    description: str
    amount: float
    balance: Optional[float] = None


class TransactionUploadRequest(BaseModel):
    account_id: int
    file_name: Optional[str] = None
    raw_csv: Optional[str] = None
    transactions: List[TransactionIn]


class TransactionOut(BaseModel):
    id: int
    account_id: int
    date: date
    description: str
    amount: float
    transaction_type: str
    category: Optional[str] = None
    category_source: str = "system"
    balance_after: float
    source_fingerprint: Optional[str] = None
    import_id: Optional[int] = None
    is_anomaly: bool = False
    anomaly_score: Optional[float] = None
    anomaly_reasons: List[str] = []

    class Config:
        from_attributes = True


class UploadResult(BaseModel):
    imported: int
    duplicates_skipped: int
    rows_received: int
    opening_balance_used: float
    closing_balance: float
    file_name: Optional[str] = None
    import_id: Optional[int] = None
    import_status: str = "completed"

class ReceiptItemOut(BaseModel):
    name: str
    qty: float
    unit_price: Optional[float] = None
    line_total: Optional[float] = None

    class Config:
        from_attributes = True


class ReceiptExtractOut(BaseModel):
    merchant: Optional[str] = None
    receipt_date: Optional[str] = None
    total: Optional[float] = None
    items: List[ReceiptItemOut] = []
    raw_text: Optional[str] = None


class ReceiptSummaryOut(BaseModel):
    id: int
    merchant: Optional[str] = None
    receipt_date: Optional[str] = None
    total: Optional[float] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True


class TransactionUpdate(BaseModel):
    category: str
    apply_to_future_merchant: bool = False
    apply_to_all_merchant: bool = False


class WhatIfAdjustment(BaseModel):
    category: str
    change_pct: float


class WhatIfRequest(BaseModel):
    account_id: int
    horizon_months: int = 6
    adjustments: List[WhatIfAdjustment] = []


class WhatIfCategoryOut(BaseModel):
    category: str
    label: str
    monthly_amount: float
    adjustment_pct: float


class WhatIfPointOut(BaseModel):
    date: str
    baseline: float
    adjusted: float


class WhatIfSummaryOut(BaseModel):
    monthly_change: float
    horizon_impact: float
    baseline_end_balance: float
    adjusted_end_balance: float


class WhatIfResponse(BaseModel):
    horizon_months: int
    current_balance: float
    categories: List[WhatIfCategoryOut]
    points: List[WhatIfPointOut]
    summary: WhatIfSummaryOut
    debug_account_id_used: Optional[int] = None
    debug_recent_months_used: List[str] = Field(default_factory=list)
    debug_month_count_used: int = 0
    debug_category_monthly_breakdown: Dict[str, Dict[str, float]] = Field(default_factory=dict)
    debug_category_totals: Dict[str, float] = Field(default_factory=dict)
    debug_category_averages: Dict[str, float] = Field(default_factory=dict)


class TaxBandBreakdown(BaseModel):
    label: str
    rate: float
    taxable_amount: float
    tax_due: float


class TaxCalculationRequest(BaseModel):
    gross_annual: float
    over_pension_age: bool = False
    tax_code: Optional[str] = None
    use_scottish_tax: bool = False
    pension_contribution_type: Optional[str] = None
    pension_contribution_value_type: Optional[str] = None
    pension_contribution_value: Optional[float] = None
    student_loan_plan: Optional[str] = None
    has_postgraduate_loan: bool = False


class TaxCalculationResponse(BaseModel):
    gross_annual: float
    adjusted_gross_annual: float
    personal_allowance: float
    taxable_income: float
    income_tax: float
    national_insurance: float
    student_loan: float
    postgraduate_loan: float
    pension_contribution: float
    pension_contribution_type: Optional[str] = None
    pension_tax_relief_estimate: float
    net_annual: float
    net_monthly: float
    tax_code_used: str
    uses_scottish_income_tax: bool
    over_pension_age: bool
    income_tax_breakdown: List[TaxBandBreakdown]
    notes: List[str]


class AdvisorScoreOut(BaseModel):
    value: int
    label: str
    message: str
    reasons: List[str]


class AdvisorHighlightOut(BaseModel):
    kind: str
    title: str
    detail: str
    metric_label: Optional[str] = None
    metric_value: Optional[str] = None


class AdvisorNarrativeOut(BaseModel):
    summary: str
    source: str


class AdvisorStatBlockOut(BaseModel):
    current_month: Optional[str] = None
    current_month_expenses: float
    average_monthly_expenses: float
    savings_rate_pct: float
    savings_rate_month: Optional[str] = None
    unusual_transaction_count: int
    recurring_monthly_total: float
    recurring_charge_count: int
    analysis_months: int
    recent_period_months: int


class AdvisorCategoryOut(BaseModel):
    category: str
    total: float
    change_pct: float
    recent_average: float


class AdvisorMerchantOut(BaseModel):
    merchant: str
    total: float
    transaction_count: int


class AdvisorCategoryDrilldownOut(BaseModel):
    category: str
    recent_average: float
    previous_average: float
    change_pct: float
    recent_total: float
    share_pct: float
    top_merchants: List[AdvisorMerchantOut]


class AdvisorRecurringChargeOut(BaseModel):
    merchant: str
    average_amount: float
    transaction_count: int
    latest_date: str
    category: str
    cadence_label: str


class AdvisorAnomalyOut(BaseModel):
    id: int
    date: str
    description: str
    amount: float
    category: str
    reasons: List[str]


class AdvisorSummaryOut(BaseModel):
    account_id: int
    account_name: str
    score: AdvisorScoreOut
    narrative: AdvisorNarrativeOut
    highlights: List[AdvisorHighlightOut]
    recommendations: List[str]
    stats: AdvisorStatBlockOut
    top_categories: List[AdvisorCategoryOut]
    recurring_charges: List[AdvisorRecurringChargeOut]
    category_drilldowns: List[AdvisorCategoryDrilldownOut]
    recent_anomalies: List[AdvisorAnomalyOut]

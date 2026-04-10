from fastapi import APIRouter

from app import schemas
from app.services.tax_calculator import calculate_uk_tax

router = APIRouter(prefix="/tax", tags=["Tax"])

@router.post("/calculate", response_model=schemas.TaxCalculationResponse)
def calculate_tax(payload: schemas.TaxCalculationRequest):
    return calculate_uk_tax(
        gross_annual=payload.gross_annual,
        over_pension_age=payload.over_pension_age,
        tax_code=payload.tax_code,
        use_scottish_tax=payload.use_scottish_tax,
        pension_contribution_type=payload.pension_contribution_type,
        pension_contribution_value_type=payload.pension_contribution_value_type,
        pension_contribution_value=payload.pension_contribution_value,
        student_loan_plan=payload.student_loan_plan,
        has_postgraduate_loan=payload.has_postgraduate_loan,
    )

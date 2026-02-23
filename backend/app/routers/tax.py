from fastapi import APIRouter
from pydantic import BaseModel
from app.services.tax_calculator import calculate_uk_tax

router = APIRouter(prefix="/tax", tags=["Tax"])


class TaxRequest(BaseModel):
    gross_annual: float


@router.post("/calculate")
def calculate_tax(payload: TaxRequest):
    return calculate_uk_tax(payload.gross_annual)
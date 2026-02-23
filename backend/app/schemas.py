from pydantic import BaseModel, EmailStr
from typing import Optional, List
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


class TransactionUploadRequest(BaseModel):
    account_id: int
    transactions: List[TransactionIn]


class TransactionOut(BaseModel):
    id: int
    account_id: int
    date: date
    description: str
    amount: float
    transaction_type: str
    category: Optional[str] = None
    balance_after: float

    class Config:
        from_attributes = True


class UploadResult(BaseModel):
    imported: int
    duplicates_skipped: int
    opening_balance_used: float
    closing_balance: float

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
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

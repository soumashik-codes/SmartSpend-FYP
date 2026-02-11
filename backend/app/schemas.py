from pydantic import BaseModel
from typing import List


class TransactionCreate(BaseModel):
    date: str
    description: str
    category: str
    amount: float


class TransactionUploadRequest(BaseModel):
    transactions: List[TransactionCreate]


class TransactionResponse(BaseModel):
    id: int
    date: str
    description: str
    category: str
    amount: float

    class Config:
        from_attributes = True

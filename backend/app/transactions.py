from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from . import models, schemas
from .database import get_db

router = APIRouter(
    prefix="/transactions",
    tags=["Transactions"]
)

# POST: Upload transactions
@router.post("/upload", response_model=List[schemas.TransactionResponse])
def upload_transactions(
    payload: schemas.TransactionUploadRequest,
    db: Session = Depends(get_db)
):
    saved_transactions = []

    for tx in payload.transactions:
        transaction = models.Transaction(
            date=tx.date,
            description=tx.description,
            category=tx.category,
            amount=tx.amount,
        )
        db.add(transaction)
        saved_transactions.append(transaction)

    db.commit()

    for tx in saved_transactions:
        db.refresh(tx)

    return saved_transactions


# GET: All transactions
@router.get("/", response_model=List[schemas.TransactionResponse])
def get_transactions(db: Session = Depends(get_db)):
    transactions = (
        db.query(models.Transaction)
        .order_by(models.Transaction.date.desc())
        .all()
    )
    return transactions


# GET: Dashboard summary
@router.get("/summary")
def get_transaction_summary(db: Session = Depends(get_db)):
    total_income = (
        db.query(func.sum(models.Transaction.amount))
        .filter(models.Transaction.amount > 0)
        .scalar()
        or 0
    )

    total_expenses = (
        db.query(func.sum(models.Transaction.amount))
        .filter(models.Transaction.amount < 0)
        .scalar()
        or 0
    )

    current_balance = total_income + total_expenses

    return {
        "total_income": round(total_income, 2),
        "total_expenses": round(abs(total_expenses), 2),
        "current_balance": round(current_balance, 2),
        "transaction_count": db.query(models.Transaction).count(),
    }
    

# GET: Recent transactions
@router.get("/recent", response_model=List[schemas.TransactionResponse])
def get_recent_transactions(
    limit: int = 10,
    db: Session = Depends(get_db)
):
    transactions = (
        db.query(models.Transaction)
        .order_by(models.Transaction.id.desc())
        .limit(limit)
        .all()
    )
    return transactions

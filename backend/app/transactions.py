from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from .ml.categorizer import predict_category
from . import models, schemas
from .database import get_db

router = APIRouter(
    prefix="/transactions",
    tags=["Transactions"],
)


# POST: Upload Transactions
@router.post("/upload", response_model=List[schemas.TransactionResponse])
def upload_transactions(
    payload: schemas.TransactionUploadRequest,
    db: Session = Depends(get_db),
):
    saved_transactions = []

    for tx in payload.transactions:

        # Rule override: positive amounts are Income
        if tx.amount > 0:
            predicted_category = "Income"
        else:
            predicted_category = predict_category(tx.description)

        transaction = models.Transaction(
            date=tx.date,
            description=tx.description,
            category=predicted_category,
            amount=tx.amount,
        )

        db.add(transaction)
        saved_transactions.append(transaction)

    db.commit()

    for tx in saved_transactions:
        db.refresh(tx)

    return saved_transactions


# GET: All Transactions
@router.get("/", response_model=List[schemas.TransactionResponse])
def get_transactions(db: Session = Depends(get_db)):
    transactions = (
        db.query(models.Transaction).order_by(
            models.Transaction.date.desc()).all()
    )
    return transactions


# GET: Dashboard Summary
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
    transaction_count = db.query(models.Transaction).count()

    return {
        "total_income": round(total_income, 2),
        "total_expenses": round(abs(total_expenses), 2),
        "current_balance": round(current_balance, 2),
        "transaction_count": transaction_count,
    }


# GET: Recent Transactions
@router.get("/recent", response_model=List[schemas.TransactionResponse])
def get_recent_transactions(
    limit: int = 10,
    db: Session = Depends(get_db),
):
    transactions = (
        db.query(models.Transaction)
        .order_by(models.Transaction.id.desc())
        .limit(limit)
        .all()
    )
    return transactions


# GET: Spending by Category
@router.get("/by-category")
def get_spending_by_category(db: Session = Depends(get_db)):
    results = (
        db.query(
            models.Transaction.category,
            func.sum(models.Transaction.amount).label("total"),
        )
        .filter(models.Transaction.amount < 0)
        .group_by(models.Transaction.category)
        .all()
    )

    return [
        {
            "category": category or "Uncategorised",
            "total": round(abs(total), 2),
        }
        for category, total in results
    ]

# GET: Balance over time
@router.get("/balance-over-time")
def get_balance_over_time(db: Session = Depends(get_db)):
    transactions = (
        db.query(models.Transaction)
        .order_by(models.Transaction.date.asc())
        .all()
    )

    running_balance = 0
    result = []

    for tx in transactions:
        running_balance += tx.amount
        result.append({
            "date": tx.date,
            "balance": round(running_balance, 2)
        })

    return result

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List
from datetime import date
from dateutil import parser as dateparser
from sqlalchemy import func

from ..database import get_db
from .. import models, schemas
from ..security import decode_token
from ..ml.categorizer import predict_category

router = APIRouter(prefix="/transactions", tags=["Transactions"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def parse_date_any(raw: str) -> date:
    dt = dateparser.parse(str(raw), dayfirst=True)
    if not dt:
        raise ValueError("Invalid date")
    return dt.date()


def get_current_user(db: Session, token: str):
    email = decode_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


def get_account_owned(db: Session, user_id: int, account_id: int) -> models.Account:
    account = (
        db.query(models.Account)
        .filter(models.Account.id == account_id, models.Account.user_id == user_id)
        .first()
    )
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.post("/upload", response_model=schemas.UploadResult)
def upload_transactions(
    payload: schemas.TransactionUploadRequest,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    user = get_current_user(db, token)
    account = get_account_owned(db, user.id, payload.account_id)

    last_tx = (
        db.query(models.Transaction)
        .filter(models.Transaction.account_id == account.id)
        .order_by(models.Transaction.date.desc(), models.Transaction.id.desc())
        .first()
    )

    running_balance = last_tx.balance_after if last_tx else account.opening_balance

    cleaned = []
    for tx in payload.transactions:
        try:
            tx_date = parse_date_any(tx.date)
        except Exception:
            continue

        desc = (tx.description or "").strip()
        if not desc:
            continue

        try:
            amt = float(tx.amount)
        except Exception:
            continue

        cleaned.append((tx_date, desc, amt))

    if not cleaned:
        raise HTTPException(status_code=400, detail="No valid transactions provided")

    # ✅ enforce chronological uploads
    if last_tx:
        earliest_new_date = min(t[0] for t in cleaned)
        if earliest_new_date <= last_tx.date:
            raise HTTPException(
                status_code=400,
                detail="Upload must contain only transactions newer than your last saved transaction date.",
            )

    cleaned.sort(key=lambda x: x[0])

    imported = 0
    duplicates = 0

    for tx_date, description, amount in cleaned:
        tx_type = "CREDIT" if amount > 0 else "DEBIT"
        running_balance = float(round(running_balance + amount, 2))

        predicted = predict_category(description)

        row = models.Transaction(
            account_id=account.id,
            date=tx_date,
            description=description,
            amount=amount,
            transaction_type=tx_type,
            category=predicted,
            balance_after=running_balance,
        )

        db.add(row)
        try:
            db.commit()
            imported += 1
        except IntegrityError:
            db.rollback()
            duplicates += 1
            running_balance = float(round(running_balance - amount, 2))

    account.current_balance = float(round(running_balance, 2))
    db.commit()

    return {
        "imported": imported,
        "duplicates_skipped": duplicates,
        "opening_balance_used": float(account.opening_balance),
        "closing_balance": float(account.current_balance),
    }


@router.get("/", response_model=List[schemas.TransactionOut])
def get_transactions(
    account_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    user = get_current_user(db, token)
    account = get_account_owned(db, user.id, account_id)

    return (
        db.query(models.Transaction)
        .filter(models.Transaction.account_id == account.id)
        .order_by(models.Transaction.date.desc(), models.Transaction.id.desc())
        .all()
    )


@router.get("/summary")
def get_account_summary(
    account_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    user = get_current_user(db, token)
    account = get_account_owned(db, user.id, account_id)

    total_income = (
        db.query(func.sum(models.Transaction.amount))
        .filter(models.Transaction.account_id == account.id)
        .filter(models.Transaction.amount > 0)
        .scalar()
        or 0
    )

    total_expenses = (
        db.query(func.sum(models.Transaction.amount))
        .filter(models.Transaction.account_id == account.id)
        .filter(models.Transaction.amount < 0)
        .scalar()
        or 0
    )

    count = (
        db.query(models.Transaction)
        .filter(models.Transaction.account_id == account.id)
        .count()
    )

    first_tx = (
        db.query(models.Transaction)
        .filter(models.Transaction.account_id == account.id)
        .order_by(models.Transaction.date.asc(), models.Transaction.id.asc())
        .first()
    )

    last_tx = (
        db.query(models.Transaction)
        .filter(models.Transaction.account_id == account.id)
        .order_by(models.Transaction.date.desc(), models.Transaction.id.desc())
        .first()
    )

    return {
        "account_id": account.id,
        "account_name": account.name,
        "opening_balance": float(account.opening_balance),
        "current_balance": float(account.current_balance),
        "total_income": float(round(total_income, 2)),
        "total_expenses": float(round(abs(total_expenses), 2)),
        "transaction_count": count,
        "date_from": str(first_tx.date) if first_tx else None,
        "date_to": str(last_tx.date) if last_tx else None,
    }

@router.get("/balance-history")
def get_balance_history(
    account_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    user = get_current_user(db, token)
    account = get_account_owned(db, user.id, account_id)

    # Get transactions ordered oldest → newest
    transactions = (
        db.query(models.Transaction)
        .filter(models.Transaction.account_id == account.id)
        .order_by(models.Transaction.date.asc(), models.Transaction.id.asc())
        .all()
    )

    if not transactions:
        return []

    daily_balances = {}
    
    for tx in transactions:
        # overwrite per day so we keep the LAST transaction of that day
        daily_balances[str(tx.date)] = float(tx.balance_after)

    # Convert dict to sorted list
    result = [
        {"date": date, "balance": balance}
        for date, balance in sorted(daily_balances.items())
    ]

    return result

@router.get("/by-category")
def get_spending_by_category(
    account_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    user = get_current_user(db, token)
    account = get_account_owned(db, user.id, account_id)

    results = (
        db.query(
            models.Transaction.category,
            func.sum(models.Transaction.amount).label("total"),
        )
        .filter(models.Transaction.account_id == account.id)
        .filter(models.Transaction.amount < 0)  # only expenses
        .group_by(models.Transaction.category)
        .all()
    )

    return [
        {
            "category": r.category or "Uncategorised",
            "total": float(abs(r.total)),
        }
        for r in results
    ]



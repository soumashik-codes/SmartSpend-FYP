from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List
from datetime import date
from dateutil import parser as dateparser
from sqlalchemy import func, case

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

        bal = None
        if tx.balance is not None:
            try:
                bal = float(tx.balance)
            except Exception:
                bal = None

        cleaned.append((tx_date, desc, amt, bal))

    if not cleaned:
        raise HTTPException(
            status_code=400, detail="No valid transactions provided")

    cleaned.sort(key=lambda x: x[0])

    imported = 0
    duplicates = 0

    for tx_date, description, amount, balance in cleaned:
        prev_running_balance = running_balance
        tx_type = "CREDIT" if amount > 0 else "DEBIT"
        if balance is not None:
            running_balance = float(round(balance, 2))
        else:
            running_balance = float(round(running_balance + amount, 2))

        predicted = predict_category(description, amount)

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
            running_balance = prev_running_balance

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
    start_date: str | None = None,
    end_date: str | None = None,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    user = get_current_user(db, token)
    account = get_account_owned(db, user.id, account_id)

    query = db.query(models.Transaction).filter(
        models.Transaction.account_id == account.id
    )

    # Apply optional date filters
    if start_date:
        query = query.filter(models.Transaction.date >= start_date)

    if end_date:
        query = query.filter(models.Transaction.date <= end_date)

    transactions = query.all()

    total_income = sum(t.amount for t in transactions if t.amount > 0)
    total_expenses = sum(t.amount for t in transactions if t.amount < 0)

    count = len(transactions)

    first_tx = (
        min(transactions, key=lambda x: x.date)
        if transactions else None
    )

    last_tx = (
        max(transactions, key=lambda x: x.date)
        if transactions else None
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
    start_date: str | None = None,
    end_date: str | None = None,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    user = get_current_user(db, token)
    account = get_account_owned(db, user.id, account_id)

    query = db.query(models.Transaction).filter(
        models.Transaction.account_id == account.id
    )

    # Apply optional date filters
    if start_date:
        query = query.filter(models.Transaction.date >= start_date)

    if end_date:
        query = query.filter(models.Transaction.date <= end_date)

    transactions = query.order_by(
        models.Transaction.date.asc(),
        models.Transaction.id.asc()
    ).all()

    if not transactions:
        return []

    daily_balances = {}

    for tx in transactions:
        # keep last transaction balance for each day
        daily_balances[str(tx.date)] = float(tx.balance_after)

    result = [
        {"date": date, "balance": balance}
        for date, balance in sorted(daily_balances.items())
    ]

    return result


@router.get("/by-category")
def get_spending_by_category(
    account_id: int,
    start_date: str | None = None,
    end_date: str | None = None,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    user = get_current_user(db, token)
    account = get_account_owned(db, user.id, account_id)

    query = db.query(
        models.Transaction.category,
        func.sum(models.Transaction.amount).label("total"),
    ).filter(
        models.Transaction.account_id == account.id
    )

    # Apply optional time filters
    if start_date:
        query = query.filter(models.Transaction.date >= start_date)

    if end_date:
        query = query.filter(models.Transaction.date <= end_date)

    results = (
        query
        .filter(models.Transaction.amount < 0)  # expenses only
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


@router.get("/monthly-summary")
def get_monthly_summary(
    account_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    user = get_current_user(db, token)
    account = get_account_owned(db, user.id, account_id)

    results = (
        db.query(
            func.strftime("%Y-%m", models.Transaction.date).label("month"),

            func.sum(
                case(
                    (models.Transaction.amount > 0, models.Transaction.amount),
                    else_=0
                )
            ).label("income"),

            func.sum(
                case(
                    (models.Transaction.amount < 0, models.Transaction.amount),
                    else_=0
                )
            ).label("expenses"),
        )
        .filter(models.Transaction.account_id == account.id)
        .group_by("month")
        .order_by("month")
        .all()
    )

    return [
        {
            "month": r.month,
            "income": float(r.income or 0),
            "expenses": float(abs(r.expenses or 0)),
            "net": float((r.income or 0) + (r.expenses or 0)),
        }
        for r in results
    ]

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List
from datetime import date, datetime
from dateutil import parser as dateparser
from sqlalchemy import func, case
import hashlib

from ..database import get_db
from .. import models, schemas
from ..security import decode_token
from ..ml.anomaly_detector import detect_expense_anomalies
from ..ml.categorizer import predict_category
from ..ml.merchant_normalizer import canonicalize_merchant, normalize_merchant
from ..services.import_identity import build_transaction_fingerprint

router = APIRouter(prefix="/transactions", tags=["Transactions"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def parse_date_any(raw: str) -> date:
    value = str(raw).strip()

    for fmt in (
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%d-%m-%y",
        "%d/%m/%y",
        "%d %b %Y",
        "%d %B %Y",
        "%d %b %y",
        "%d %B %y",
    ):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue

    dt = dateparser.parse(value, dayfirst=True)
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


def build_file_hash(raw_csv: str | None, file_name: str | None, transactions: list[schemas.TransactionIn]) -> str:
    if raw_csv:
        return hashlib.sha256(raw_csv.encode("utf-8")).hexdigest()

    canonical_rows = [
        f"{tx.date}|{(tx.description or '').strip()}|{float(tx.amount):.2f}|"
        f"{'' if tx.balance is None else float(tx.balance):.2f}"
        for tx in transactions
    ]
    payload = f"{file_name or ''}\n" + "\n".join(canonical_rows)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def refresh_account_anomalies(db: Session, account_id: int):
    account_transactions = (
        db.query(models.Transaction)
        .filter(models.Transaction.account_id == account_id)
        .order_by(models.Transaction.date.asc(), models.Transaction.id.asc())
        .all()
    )

    results = detect_expense_anomalies(account_transactions)

    for transaction in account_transactions:
        if float(transaction.amount) >= 0:
            transaction.is_anomaly = False
            transaction.anomaly_score = None
            continue

        result = results.get(transaction.id)
        if result is None:
            transaction.is_anomaly = False
            transaction.anomaly_score = None
            continue

        transaction.is_anomaly = result.is_anomaly
        transaction.anomaly_score = result.anomaly_score


def upsert_merchant_override(
    db: Session,
    user_id: int,
    merchant_key: str,
    category: str,
):
    if not merchant_key:
        return

    override = (
        db.query(models.MerchantCategoryOverride)
        .filter(
            models.MerchantCategoryOverride.user_id == user_id,
            models.MerchantCategoryOverride.merchant_key == merchant_key,
        )
        .first()
    )

    if override:
        override.category = category
        return

    db.add(
        models.MerchantCategoryOverride(
            user_id=user_id,
            merchant_key=merchant_key,
            category=category,
        )
    )


def attach_anomaly_reasons(transactions: list[models.Transaction]) -> list[models.Transaction]:
    results = detect_expense_anomalies(transactions)

    for transaction in transactions:
        result = results.get(transaction.id)
        transaction.anomaly_reasons = result.reasons if result else []

    return transactions


@router.post("/upload", response_model=schemas.UploadResult)
def upload_transactions(
    payload: schemas.TransactionUploadRequest,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    user = get_current_user(db, token)
    account = get_account_owned(db, user.id, payload.account_id)
    file_hash = build_file_hash(payload.raw_csv, payload.file_name, payload.transactions)

    existing_import = (
        db.query(models.TransactionImport)
        .filter(
            models.TransactionImport.account_id == account.id,
            models.TransactionImport.file_hash == file_hash,
        )
        .first()
    )
    if existing_import:
        raise HTTPException(
            status_code=409,
            detail="This file appears to have already been uploaded for this account.",
        )

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

    import_record = models.TransactionImport(
        account_id=account.id,
        file_name=payload.file_name,
        file_hash=file_hash,
        rows_received=len(payload.transactions),
        rows_inserted=0,
        rows_skipped_duplicates=0,
        status="processing",
        date_from=min(row[0] for row in cleaned),
        date_to=max(row[0] for row in cleaned),
    )
    db.add(import_record)
    db.commit()
    db.refresh(import_record)

    cleaned.sort(key=lambda x: x[0])

    imported = 0
    duplicates = 0

    try:
        for tx_date, description, amount, balance in cleaned:
            prev_running_balance = running_balance
            tx_type = "CREDIT" if amount > 0 else "DEBIT"
            if balance is not None:
                running_balance = float(round(balance, 2))
            else:
                running_balance = float(round(running_balance + amount, 2))

            source_fingerprint = build_transaction_fingerprint(
                account.id,
                tx_date,
                amount,
                description,
            )

            existing_transaction = (
                db.query(models.Transaction)
                .filter(
                    models.Transaction.account_id == account.id,
                    models.Transaction.source_fingerprint == source_fingerprint,
                )
                .first()
            )
            if existing_transaction:
                duplicates += 1
                running_balance = prev_running_balance
                continue

            predicted = predict_category(description, amount, db=db, user_id=user.id)

            row = models.Transaction(
                account_id=account.id,
                date=tx_date,
                description=description,
                amount=amount,
                transaction_type=tx_type,
                category=predicted,
                category_source="system",
                balance_after=running_balance,
                source_fingerprint=source_fingerprint,
                import_id=import_record.id,
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
        refresh_account_anomalies(db, account.id)
        import_record.rows_inserted = imported
        import_record.rows_skipped_duplicates = duplicates
        import_record.status = "completed"
        db.commit()
    except Exception as exc:
        db.rollback()
        import_record = db.query(models.TransactionImport).filter(
            models.TransactionImport.id == import_record.id
        ).first()
        if import_record:
            import_record.status = "failed"
            import_record.error_message = str(exc)
            import_record.rows_inserted = imported
            import_record.rows_skipped_duplicates = duplicates
            db.commit()
        raise

    return {
        "imported": imported,
        "duplicates_skipped": duplicates,
        "rows_received": len(payload.transactions),
        "opening_balance_used": float(account.opening_balance),
        "closing_balance": float(account.current_balance),
        "file_name": payload.file_name,
        "import_id": import_record.id,
        "import_status": import_record.status,
    }


@router.get("/", response_model=List[schemas.TransactionOut])
def get_transactions(
    account_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    user = get_current_user(db, token)
    account = get_account_owned(db, user.id, account_id)

    transactions = (
        db.query(models.Transaction)
        .filter(models.Transaction.account_id == account.id)
        .order_by(models.Transaction.date.desc(), models.Transaction.id.desc())
        .all()
    )

    return attach_anomaly_reasons(transactions)


@router.delete("/reset-account")
def reset_account_transactions(
    account_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    user = get_current_user(db, token)
    account = get_account_owned(db, user.id, account_id)

    deleted_transactions = (
        db.query(models.Transaction)
        .filter(models.Transaction.account_id == account.id)
        .delete(synchronize_session=False)
    )
    deleted_imports = (
        db.query(models.TransactionImport)
        .filter(models.TransactionImport.account_id == account.id)
        .delete(synchronize_session=False)
    )

    account.current_balance = float(account.opening_balance)
    db.commit()

    return {
        "account_id": account.id,
        "deleted_transactions": deleted_transactions,
        "deleted_imports": deleted_imports,
        "current_balance": float(account.current_balance),
    }


@router.patch("/{transaction_id}", response_model=schemas.TransactionOut)
def update_transaction_category(
    transaction_id: int,
    payload: schemas.TransactionUpdate,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    user = get_current_user(db, token)

    transaction = (
        db.query(models.Transaction)
        .join(models.Account, models.Transaction.account_id == models.Account.id)
        .filter(models.Transaction.id == transaction_id, models.Account.user_id == user.id)
        .first()
    )

    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")

    target_category = payload.category.strip() or transaction.category
    transaction.category = target_category
    transaction.category_source = "user"

    accounts = (
        db.query(models.Account.id)
        .filter(models.Account.user_id == user.id)
        .all()
    )
    account_ids = [account_id for account_id, in accounts]

    merchant_key = normalize_merchant(transaction.description)
    learning_key = canonicalize_merchant(transaction.description) or merchant_key

    if learning_key and payload.apply_to_all_merchant and account_ids:
        similar_transactions = (
            db.query(models.Transaction)
            .filter(models.Transaction.account_id.in_(account_ids))
            .all()
        )

        for similar in similar_transactions:
            similar_key = canonicalize_merchant(similar.description)
            if similar_key == learning_key or normalize_merchant(similar.description) == merchant_key:
                similar.category = target_category
                similar.category_source = "user"

    if learning_key and payload.apply_to_future_merchant:
        upsert_merchant_override(db, user.id, learning_key, target_category)

    affected_account_ids = {
        account_id
        for account_id, in (
            db.query(models.Transaction.account_id)
            .join(models.Account, models.Transaction.account_id == models.Account.id)
            .filter(models.Account.user_id == user.id)
            .all()
        )
    }

    for account_id in affected_account_ids:
        refresh_account_anomalies(db, account_id)

    db.commit()
    db.refresh(transaction)
    account_transactions = (
        db.query(models.Transaction)
        .filter(models.Transaction.account_id == transaction.account_id)
        .order_by(models.Transaction.date.desc(), models.Transaction.id.desc())
        .all()
    )
    attach_anomaly_reasons(account_transactions)
    transaction = next((item for item in account_transactions if item.id == transaction.id), transaction)
    return transaction


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
    unusual_transaction_count = sum(
        1 for t in transactions if t.amount < 0 and bool(getattr(t, "is_anomaly", False))
    )

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
        "unusual_transaction_count": unusual_transaction_count,
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
            "category": r.category or "Other",
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

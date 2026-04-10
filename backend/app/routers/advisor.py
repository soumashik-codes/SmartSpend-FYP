from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import decode_token
from ..services.advisor_engine import build_advisor_summary

router = APIRouter(prefix="/advisor", tags=["Advisor"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


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


@router.get("/summary", response_model=schemas.AdvisorSummaryOut)
def get_advisor_summary(
    account_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    user = get_current_user(db, token)
    account = get_account_owned(db, user.id, account_id)

    transactions = (
        db.query(models.Transaction)
        .filter(models.Transaction.account_id == account.id)
        .order_by(models.Transaction.date.asc(), models.Transaction.id.asc())
        .all()
    )

    return build_advisor_summary(account, transactions)

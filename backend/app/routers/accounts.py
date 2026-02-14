from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from .. import models, schemas
from ..security import decode_token

router = APIRouter(prefix="/accounts", tags=["Accounts"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def get_current_user(db: Session, token: str):
    email = decode_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


@router.get("/", response_model=List[schemas.AccountOut])
def list_accounts(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user = get_current_user(db, token)
    return db.query(models.Account).filter(models.Account.user_id == user.id).all()


@router.post("/", response_model=schemas.AccountOut)
def create_account(payload: schemas.AccountCreate, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user = get_current_user(db, token)

    account = models.Account(
        user_id=user.id,
        name=payload.name,
        opening_balance=payload.opening_balance,
        current_balance=payload.opening_balance,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account

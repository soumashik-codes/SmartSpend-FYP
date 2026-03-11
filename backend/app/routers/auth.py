from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel

from ..database import get_db
from .. import models, schemas
from ..security import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


# REGISTER
@router.post("/register", response_model=schemas.UserOut)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = (
        db.query(models.User)
        .filter(models.User.email == payload.email)
        .first()
    )

    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    # Automatically create default account
    default_account = models.Account(
        name="Main Account",
        opening_balance=0,
        current_balance=0,
        user_id=user.id,
    )

    db.add(default_account)
    db.commit()

    return user


# LOGIN
@router.post("/login", response_model=schemas.Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = (
        db.query(models.User)
        .filter(models.User.email == form_data.username)
        .first()
    )

    if not user or not verify_password(
        form_data.password, user.hashed_password
    ):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(subject=user.email)

    return {
        "access_token": token,
        "token_type": "bearer",
    }


# GET CURRENT USER
@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


# UPDATE PROFILE
class UpdateProfile(BaseModel):
    full_name: str


@router.put("/update-profile", response_model=schemas.UserOut)
def update_profile(
    payload: UpdateProfile,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    current_user.full_name = payload.full_name.strip()
    db.commit()
    db.refresh(current_user)
    return current_user


# CHANGE PASSWORD
class ChangePassword(BaseModel):
    current_password: str
    new_password: str


@router.put("/change-password")
def change_password(
    payload: ChangePassword,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password incorrect")

    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()

    return {"message": "Password updated successfully"}


# DELETE ACCOUNT
@router.delete("/delete-account")
def delete_account(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db.delete(current_user)
    db.commit()
    return {"message": "Account deleted successfully"}
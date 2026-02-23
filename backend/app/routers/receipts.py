from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from PIL import Image

from ..database import get_db
from .. import models
from ..models import Receipt, ReceiptItem
from ..security import decode_token
from ..ml.receipt_engine import extract_receipt

router = APIRouter(prefix="/receipts", tags=["Receipts"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def get_current_user(db: Session, token: str):
    email = decode_token(token)
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.post("/upload")
async def upload_receipt(
    file: UploadFile = File(...),
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    user = get_current_user(db, token)

    if file.content_type not in ["image/png", "image/jpeg"]:
        raise HTTPException(status_code=400, detail="Only JPG/PNG supported")

    try:
        img = Image.open(file.file)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image")

    extracted = extract_receipt(img)

    receipt = Receipt(
        user_id=user.id,
        merchant=extracted.get("merchant"),
        receipt_date=extracted.get("receipt_date"),
        total=extracted.get("total"),
        raw_text=extracted.get("raw_text"),
        image_filename=file.filename,
    )

    db.add(receipt)
    db.commit()
    db.refresh(receipt)

    for item in extracted.get("items", []):
        db.add(ReceiptItem(
            receipt_id=receipt.id,
            name=item["name"],
            qty=float(item.get("qty", 1.0)),
            unit_price=item.get("unit_price"),
            line_total=item.get("line_total"),
        ))

    db.commit()

    return {
        "id": receipt.id,
        **extracted
    }


@router.get("/")
def list_receipts(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    user = get_current_user(db, token)

    receipts = (
        db.query(Receipt)
        .filter(Receipt.user_id == user.id)
        .order_by(Receipt.created_at.desc())
        .all()
    )

    return receipts
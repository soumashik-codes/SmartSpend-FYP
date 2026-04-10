from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, UniqueConstraint, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    accounts = relationship("Account", back_populates="user", cascade="all, delete-orphan")


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    name = Column(String, nullable=False)
    opening_balance = Column(Float, default=0.0)
    current_balance = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="accounts")
    transactions = relationship("Transaction", back_populates="account", cascade="all, delete-orphan")


class MerchantCategoryOverride(Base):
    __tablename__ = "merchant_category_overrides"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    merchant_key = Column(String, nullable=False)
    category = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "merchant_key", name="uq_user_merchant_override"),
    )


class TransactionImport(Base):
    __tablename__ = "transaction_imports"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False, index=True)
    file_name = Column(String, nullable=True)
    file_hash = Column(String, nullable=False, index=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    rows_received = Column(Integer, nullable=False, default=0)
    rows_inserted = Column(Integer, nullable=False, default=0)
    rows_skipped_duplicates = Column(Integer, nullable=False, default=0)
    status = Column(String, nullable=False, default="completed")
    date_from = Column(Date, nullable=True)
    date_to = Column(Date, nullable=True)
    error_message = Column(String, nullable=True)

    account = relationship("Account")
    transactions = relationship("Transaction", back_populates="import_record")

    __table_args__ = (
        UniqueConstraint("account_id", "file_hash", name="uq_transaction_import_account_hash"),
    )


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)

    date = Column(Date, nullable=False)
    description = Column(String, nullable=False)

    amount = Column(Float, nullable=False)  # +income, -expense
    transaction_type = Column(String, nullable=False)  # CREDIT/DEBIT

    category = Column(String, nullable=True)
    category_source = Column(String, nullable=False, default="system")
    balance_after = Column(Float, nullable=False)
    source_fingerprint = Column(String, nullable=False, index=True)
    import_id = Column(Integer, ForeignKey("transaction_imports.id"), nullable=True, index=True)
    is_anomaly = Column(Boolean, nullable=False, default=False)
    anomaly_score = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    account = relationship("Account", back_populates="transactions")
    import_record = relationship("TransactionImport", back_populates="transactions")

    
class Receipt(Base):
    __tablename__ = "receipts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)

    merchant = Column(String, nullable=True)
    receipt_date = Column(String, nullable=True)
    total = Column(Float, nullable=True)

    raw_text = Column(String, nullable=True)
    image_filename = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    items = relationship("ReceiptItem", back_populates="receipt", cascade="all, delete-orphan")


class ReceiptItem(Base):
    __tablename__ = "receipt_items"

    id = Column(Integer, primary_key=True, index=True)
    receipt_id = Column(Integer, ForeignKey("receipts.id"), nullable=False)

    name = Column(String, nullable=False)
    qty = Column(Float, default=1.0)
    unit_price = Column(Float, nullable=True)
    line_total = Column(Float, nullable=True)

    receipt = relationship("Receipt", back_populates="items")

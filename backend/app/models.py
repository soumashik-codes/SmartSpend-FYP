from sqlalchemy import Column, Integer, String, Float
from .database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, nullable=False)
    description = Column(String, nullable=False)
    category = Column(String, default="Uncategorised")
    amount = Column(Float, nullable=False)

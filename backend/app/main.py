import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from .database import Base, engine, ensure_sqlite_transaction_columns
from .routers import auth, accounts, transactions, forecast, receipts, tax, advisor

app = FastAPI(title="SmartSpend API")

Base.metadata.create_all(bind=engine)
ensure_sqlite_transaction_columns()

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(transactions.router)
app.include_router(forecast.router)
app.include_router(receipts.router)
app.include_router(tax.router)
app.include_router(advisor.router)


@app.get("/")
def root():
    return {"status": "ok"}

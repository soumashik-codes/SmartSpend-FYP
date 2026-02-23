from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


from .database import Base, engine
from .routers import auth, accounts, transactions, forecast, receipts, tax

app = FastAPI(title="SmartSpend API")

Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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

@app.get("/")
def root():
    return {"status": "ok"}
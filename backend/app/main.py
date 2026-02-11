from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine
from . import models
from .transactions import router as transactions_router

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SmartSpend API", description="Backend API for SmartSpend", version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transactions_router)


@app.get("/")
def health_check():
    return {"status": "SmartSpend backend running"}

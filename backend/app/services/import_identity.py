import hashlib
import re
from datetime import date

FINGERPRINT_FILLER_WORDS = {
    "CARD",
    "PAYMENT",
    "POS",
    "PURCHASE",
    "DEBIT",
    "CREDIT",
}


def normalize_fingerprint_description(description: str) -> str:
    normalized = (description or "").upper()
    normalized = re.sub(r"[^A-Z0-9\s]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    if not normalized:
        return ""

    tokens = [token for token in normalized.split(" ") if token and token not in FINGERPRINT_FILLER_WORDS]
    return " ".join(tokens)


def build_transaction_fingerprint(account_id: int, tx_date: date | str, amount: float, description: str) -> str:
    normalized_description = normalize_fingerprint_description(description)
    normalized_amount = f"{float(amount):.2f}"
    normalized_date = tx_date.isoformat() if hasattr(tx_date, "isoformat") else str(tx_date)
    payload = f"{account_id}|{normalized_date}|{normalized_amount}|{normalized_description}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()

import re


FILLER_WORDS = {
    "LTD","LIMITED","BAR","LOUNGE","LONDON",
    "SHOP","STORE","STORES","RESTAURANT","CAFE",
    "UK","GB",
    "PAYMENT","CARD","PURCHASE",
    "POS","CONTACTLESS","DEBIT","CREDIT",
    "ONLINE","INTERNET","TRANSACTION",
    "AUTH","AUTHORIZATION",
    "REF","NO","ID"
}


def normalize_merchant(description: str) -> str:
    cleaned = (description or "").upper()
    cleaned = re.sub(r"\d+", " ", cleaned)
    cleaned = re.sub(r"[^A-Z\s]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    if not cleaned:
        return ""

    # basic spelling normalisation
    cleaned = cleaned.replace("SHEESHA", "SHISHA")

    filtered_words = [word for word in cleaned.split() if word not in FILLER_WORDS]
    normalized = " ".join(filtered_words).strip()

    return normalized or cleaned
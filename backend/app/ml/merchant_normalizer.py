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


CANONICAL_MERCHANT_PATTERNS = [
    (re.compile(r"\bTESCO\b"), "TESCO"),
    (re.compile(r"\bSAINSBURY(?:S)?\b"), "SAINSBURYS"),
    (re.compile(r"\bMCDONALD(?:S)?\b"), "MCDONALDS"),
    (re.compile(r"\bALDI\b"), "ALDI"),
    (re.compile(r"\bASDA\b"), "ASDA"),
    (re.compile(r"\bLIDL\b"), "LIDL"),
    (re.compile(r"\bWAITROSE\b"), "WAITROSE"),
    (re.compile(r"\bSTARBUCKS\b"), "STARBUCKS"),
    (re.compile(r"\bCOSTA\b"), "COSTA"),
    (re.compile(r"\bCAFE\s+NERO\b"), "CAFE NERO"),
    (re.compile(r"\bGREGGS\b"), "GREGGS"),
]


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


def canonicalize_merchant(description: str) -> str:
    normalized = normalize_merchant(description)
    if not normalized:
        return ""

    for pattern, canonical in CANONICAL_MERCHANT_PATTERNS:
        if pattern.search(normalized):
            return canonical

    return normalized

import re
from collections import defaultdict
from typing import Optional


CATEGORY_PATTERNS = {
    "Groceries": [
        "TESCO", "SAINSBURY", "SAINSBURYS", "ALDI", "ASDA", "LIDL",
        "WAITROSE", "MORRISONS", "CO OP", "COOP", "ICELAND",
        "MARKS SPENCER FOOD", "M&S FOOD", "WHOLE FOODS", "OCADO",
        "FARMFOODS", "COSTCUTTER", "SUPERMARKET", "GROCERY"
    ],
    "Dining": [
        "MCDONALD", "MCD", "KFC", "BURGER KING", "NANDO", "NANDOS", "SUBWAY",
        "PIZZA HUT", "DOMINOS", "PAPA JOHNS", "GREGGS", "PRET",
        "STARBUCKS", "COSTA", "CAFE NERO", "RESTAURANT", "DINER",
        "TAKEAWAY", "JUST EAT", "DELIVEROO", "UBER EATS", "EAT",
        "KEBAB", "GRILL", "SHISHA", "BBQ", "PIZZA", "CHICKEN", "TANDOORI"
    ],
    "Transport": [
        "UBER", "BOLT", "TFL", "TRAINLINE", "NATIONAL RAIL",
        "SOUTHERN RAIL", "THAMESLINK", "BUS", "TRAVEL", "STATION",
        "FUEL", "PETROL", "SHELL", "BP", "ESSO", "TEXACO", "PARKING",
        "MOTORWAY", "ROAD TOLL", "TICKET"
    ],
    "Entertainment": [
        "NETFLIX", "SPOTIFY", "DISNEY", "YOUTUBE PREMIUM", "AMAZON PRIME",
        "APPLE TV", "SKY", "NOW TV", "CINEMA", "ODEON", "VUE", "GAME",
        "STEAM", "PLAYSTATION", "XBOX", "NINTENDO"
    ],
    "Travel": [
        "HOLIDAY", "BOOKING", "AIRBNB", "EXPEDIA", "EASYJET", "RYANAIR",
        "JET", "BRITISH AIRWAYS", "HOTEL", "HOSTEL", "FLIGHT", "FERRY",
        "BAGGAGE", "AIRPORT PARKING", "CAR HIRE", "VISA FEE", "TRAVEL AGENCY"
    ],
    "Shopping": [
        "AMAZON", "EBAY", "ETSY", "SHOPIFY", "ZARA", "H&M", "HM",
        "PRIMARK", "NEXT", "ASOS", "SHEIN", "TEMU", "TK MAXX",
        "MARKS SPENCER", "M&S", "JOHN LEWIS", "ARGOS", "CURRYS"
    ],
    "Utilities": [
        "BRITISH GAS", "OCTOPUS ENERGY", "EDF", "EON", "SCOTTISH POWER",
        "THAMES WATER", "SEVERN TRENT", "VODAFONE", "VIRGIN MEDIA",
        "BT", "EE", "O2", "THREE", "GAS", "WATER", "ELECTRIC",
        "ENERGY", "BROADBAND", "MOBILE", "INTERNET", "COUNCIL TAX"
    ],
    "Housing": [
        "RENT", "LANDLORD", "LETTINGS", "MORTGAGE", "LONDON HOMES",
        "PROPERTY", "HOUSING", "ESTATE", "SERVICE CHARGE"
    ],
    "Healthcare": [
        "NHS", "PHARMACY", "BOOTS", "SUPERDRUG", "DENTAL", "DENTIST",
        "CLINIC", "DOCTOR", "HOSPITAL", "OPTICIAN", "VISION EXPRESS"
    ],
    "Personal Care": [
        "BARBER", "HAIR SALON", "BEAUTY SALON", "NAIL", "SPA", "WAXING",
        "THREADING", "SKINCARE", "COSMETICS", "MAKEUP", "TOILETRIES",
        "MASSAGE", "GROOMING", "TANNING", "TONI", "SUPERCUTS", "SEPHORA"
    ],
    "Fitness": [
        "PUREGYM", "JD GYM", "GYM GROUP", "DAVID LLOYD", "FITNESS",
        "GYM", "CROSSFIT", "PILATES", "YOGA"
    ],
    "Cash Withdrawal": [
        "ATM", "CASH WITHDRAWAL", "CASH WD", "CASH MACHINE"
    ],
    "Bank Fees": [
        "FEE", "CHARGE", "OVERDRAFT", "LATE PAYMENT", "INTEREST CHARGED"
    ],
    "Transfer": [
        "TRANSFER", "BANK TRANSFER", "FASTER PAYMENT", "STANDING ORDER",
        "DIRECT TRANSFER", "TO SAVINGS", "FROM SAVINGS"
    ],
    "Income": [
        "SALARY", "PAYROLL", "PAYMENT FROM", "WAGE", "BONUS",
        "EMPLOYER", "HMRC", "REFUND", "CASHBACK"
    ],
}


def clean_description(text: str) -> str:
    text = (text or "").upper()
    text = re.sub(r"\d+", " ", text)
    text = re.sub(r"[^A-Z\s]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _matches_pattern(cleaned: str, pattern: str) -> bool:
    tokens = pattern.split()
    if not tokens:
        return False

    regex = r"\b" + r"\s+".join(re.escape(token) for token in tokens) + r"\b"
    return re.search(regex, cleaned) is not None


def _score_pattern_matches(cleaned: str) -> dict[str, int]:
    scores: dict[str, int] = defaultdict(int)

    for category, patterns in CATEGORY_PATTERNS.items():
        for pattern in patterns:
            if _matches_pattern(cleaned, pattern):
                token_bonus = max(1, len(pattern.split()))
                scores[category] += token_bonus

    return scores


def rule_based_category(description: str) -> Optional[str]:
    cleaned = clean_description(description)
    if not cleaned:
        return None

    scores = _score_pattern_matches(cleaned)
    if not scores:
        return None

    best_category = max(scores, key=scores.get)
    return best_category if scores[best_category] > 0 else None

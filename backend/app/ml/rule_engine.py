import re
from collections import defaultdict

CATEGORY_KEYWORDS = {
    "Food": [
        "KFC", "MCDONALD", "BURGER", "NANDO",
        "PERI", "GRILL", "CHICKEN", "KEBAB",
        "PIZZA", "TAKEAWAY", "CAFE", "COFFEE",
        "RESTAURANT", "DINER", "SUBWAY",
        "GREGGS", "DELIVEROO", "UBER EATS"
    ],
    "Groceries": [
        "TESCO", "ALDI", "SAINSBURY", "ASDA",
        "LIDL", "MART", "MINI", "MARKET",
        "SUPERMARKET", "OFF LICENCE",
        "COSTCUTTER", "FOOD CENTER"
    ],
    "Transport": [
        "TFL", "UBER", "BOLT", "TRAIN",
        "RAIL", "BUS", "TRAVEL",
        "STATION", "TICKET"
    ],
    "Subscription": [
        "SPOTIFY", "NETFLIX", "PRIME",
        "DISNEY", "APPLE", "CHATGPT"
    ],
    "Shopping": [
        "AMAZON", "EBAY", "H&M",
        "ZARA", "PRIMARK", "WETHERSPOON"
    ],
    "Utilities": [
        "GAS", "WATER", "ELECTRIC",
        "VODAFONE", "EE", "O2",
        "BILL", "MOBILE"
    ],
    "Fitness": [
        "GYM", "PUREGYM", "JD GYM"
    ]
}


def clean_description(text: str) -> str:
    text = text.upper()
    text = re.sub(r"\d+", " ", text)
    text = re.sub(r"[^A-Z\s]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def rule_based_category(description: str):
    cleaned = clean_description(description)
    words = cleaned.split()

    scores = defaultdict(int)

    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword in cleaned:
                scores[category] += 1

    if not scores:
        return None

    # return category with highest score
    return max(scores, key=scores.get)

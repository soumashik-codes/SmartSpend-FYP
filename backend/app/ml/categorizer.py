import os
import re
import joblib
from typing import Optional
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from .merchant_normalizer import normalize_merchant
from .rule_engine import rule_based_category
from .llm_categorizer import llm_categorize


MODEL_VERSION = "v1"
MODEL_PATH = os.path.join(
    os.path.dirname(__file__),
    f"category_model_{MODEL_VERSION}.pkl",
)

INCOME_KEYWORDS = [
    "SALARY", "PAYROLL", "TRANSFER FROM", "PAYMENT FROM", "RECEIVED FROM",
    "WAGE", "EMPLOYER", "BONUS", "PAY", "HMRC", "REFUND", "INTEREST"
]

TRANSFER_KEYWORDS = [
    "TRANSFER", "FASTER PAYMENT", "BANK TRANSFER", "STANDING ORDER",
    "TO SAVINGS", "FROM SAVINGS", "INTERNAL TRANSFER"
]


def clean_text(text: str) -> str:
    text = (text or "").upper()
    text = re.sub(r"\d+", " ", text)
    text = re.sub(r"[^A-Z\s]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


TRAIN_DATA = [
    ("TESCO STORES", "Groceries"),
    ("TESCO EXTRA", "Groceries"),
    ("SAINSBURYS", "Groceries"),
    ("SAINSBURY LOCAL", "Groceries"),
    ("ALDI STORE", "Groceries"),
    ("ASDA SUPERSTORE", "Groceries"),
    ("LIDL GB", "Groceries"),
    ("WAITROSE", "Groceries"),
    ("MORRISONS", "Groceries"),
    ("CO OP FOOD", "Groceries"),
    ("OCADO", "Groceries"),
    ("MARKS SPENCER FOOD", "Groceries"),
    ("ICELAND FOODS", "Groceries"),
    ("SUPERMARKET", "Groceries"),
    ("LOCAL SUPERMARKET", "Groceries"),

    ("MCDONALDS", "Dining"),
    ("KFC", "Dining"),
    ("BURGER KING", "Dining"),
    ("NANDOS", "Dining"),
    ("GREGGS", "Dining"),
    ("STARBUCKS", "Dining"),
    ("COSTA COFFEE", "Dining"),
    ("CAFE NERO", "Dining"),
    ("PRET A MANGER", "Dining"),
    ("SUBWAY", "Dining"),
    ("DOMINOS", "Dining"),
    ("PIZZA HUT", "Dining"),
    ("UBER EATS", "Dining"),
    ("DELIVEROO", "Dining"),
    ("JUST EAT", "Dining"),
    ("RESTAURANT", "Dining"),
    ("KEBAB HOUSE", "Dining"),
    ("LOCAL KEBAB HOUSE", "Dining"),
    ("GRILL HOUSE", "Dining"),
    ("SHISHA LOUNGE", "Dining"),
    ("SHISHA BAR", "Dining"),
    ("PIZZA SHOP", "Dining"),
    ("FRIED CHICKEN", "Dining"),
    ("TANDOORI HOUSE", "Dining"),

    ("UBER TRIP", "Transport"),
    ("BOLT TRIP", "Transport"),
    ("TFL TRAVEL", "Transport"),
    ("TRAINLINE", "Transport"),
    ("NATIONAL RAIL", "Transport"),
    ("THAMESLINK", "Transport"),
    ("SHELL PETROL", "Transport"),
    ("BP PETROL", "Transport"),
    ("ESSO FUEL", "Transport"),
    ("TEXACO", "Transport"),
    ("PARKING", "Transport"),
    ("BUS TICKET", "Transport"),

    ("NETFLIX", "Entertainment"),
    ("SPOTIFY", "Entertainment"),
    ("DISNEY PLUS", "Entertainment"),
    ("YOUTUBE PREMIUM", "Entertainment"),
    ("AMAZON PRIME", "Entertainment"),
    ("APPLE TV", "Entertainment"),
    ("SKY DIGITAL", "Entertainment"),
    ("ODEON CINEMA", "Entertainment"),
    ("STEAM GAMES", "Entertainment"),
    ("PLAYSTATION", "Entertainment"),

    ("HOLIDAY BOOKING", "Travel"),
    ("BOOKING COM", "Travel"),
    ("AIRBNB", "Travel"),
    ("EXPEDIA", "Travel"),
    ("EASYJET", "Travel"),
    ("RYANAIR", "Travel"),
    ("JET2", "Travel"),
    ("BRITISH AIRWAYS", "Travel"),
    ("HOTELS COM", "Travel"),
    ("HOTEL STAY", "Travel"),
    ("HOSTELWORLD", "Travel"),
    ("CAR HIRE", "Travel"),

    ("AMAZON MARKETPLACE", "Shopping"),
    ("AMAZON PURCHASE", "Shopping"),
    ("EBAY", "Shopping"),
    ("ETSY", "Shopping"),
    ("ZARA", "Shopping"),
    ("H M", "Shopping"),
    ("PRIMARK", "Shopping"),
    ("ASOS", "Shopping"),
    ("NEXT", "Shopping"),
    ("CURRYS", "Shopping"),
    ("JOHN LEWIS", "Shopping"),
    ("ARGOS", "Shopping"),

    ("BARBER SHOP", "Personal Care"),
    ("HAIR SALON", "Personal Care"),
    ("BEAUTY SALON", "Personal Care"),
    ("NAIL BAR", "Personal Care"),
    ("SPA TREATMENT", "Personal Care"),
    ("TONI AND GUY", "Personal Care"),
    ("SUPERCUTS", "Personal Care"),
    ("SEPHORA", "Personal Care"),
    ("SKINCARE PURCHASE", "Personal Care"),
    ("COSMETICS", "Personal Care"),
    ("MAKEUP STORE", "Personal Care"),
    ("MASSAGE", "Personal Care"),

    ("PUREGYM", "Fitness"),
    ("JD GYM", "Fitness"),
    ("GYM GROUP", "Fitness"),
    ("DAVID LLOYD", "Fitness"),
    ("YOGA STUDIO", "Fitness"),

    ("BRITISH GAS", "Utilities"),
    ("OCTOPUS ENERGY", "Utilities"),
    ("THAMES WATER", "Utilities"),
    ("SEVERN TRENT", "Utilities"),
    ("VODAFONE", "Utilities"),
    ("EE LIMITED", "Utilities"),
    ("O2 TELEFONICA", "Utilities"),
    ("VIRGIN MEDIA", "Utilities"),
    ("BT GROUP", "Utilities"),
    ("COUNCIL TAX", "Utilities"),
    ("ELECTRIC BILL", "Utilities"),

    ("RENT LONDON HOMES", "Housing"),
    ("MONTHLY RENT", "Housing"),
    ("MORTGAGE PAYMENT", "Housing"),
    ("LETTINGS", "Housing"),
    ("SERVICE CHARGE", "Housing"),

    ("NHS PHARMACY", "Healthcare"),
    ("BOOTS PHARMACY", "Healthcare"),
    ("SUPERDRUG", "Healthcare"),
    ("DENTAL CLINIC", "Healthcare"),
    ("HOSPITAL PAYMENT", "Healthcare"),
    ("OPTICIAN", "Healthcare"),
    ("PHARMACY", "Healthcare"),

    ("ATM CASH WITHDRAWAL", "Cash Withdrawal"),
    ("CASH WITHDRAWAL", "Cash Withdrawal"),

    ("ACCOUNT FEE", "Bank Fees"),
    ("OVERDRAFT CHARGE", "Bank Fees"),
    ("INTEREST CHARGED", "Bank Fees"),

    ("TRANSFER TO SAVINGS", "Transfer"),
    ("TRANSFER FROM SAVINGS", "Transfer"),
    ("FASTER PAYMENT TRANSFER", "Transfer"),
    ("BANK TRANSFER", "Transfer"),

    ("SALARY ACME LTD", "Income"),
    ("PAYROLL ACME", "Income"),
    ("HMRC REFUND", "Income"),
    ("INTEREST PAYMENT", "Income"),
]


def train_model():
    texts = [clean_text(item[0]) for item in TRAIN_DATA]
    labels = [item[1] for item in TRAIN_DATA]

    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 3), min_df=1, sublinear_tf=True)),
        ("clf", LogisticRegression(max_iter=4000, class_weight="balanced")),
    ])

    pipeline.fit(texts, labels)
    joblib.dump(pipeline, MODEL_PATH)
    return pipeline


def load_model():
    if os.path.exists(MODEL_PATH):
        try:
            return joblib.load(MODEL_PATH)
        except Exception:
            return train_model()
    return train_model()


model = load_model()


def detect_income(description: str, amount: float) -> Optional[str]:
    cleaned = clean_text(description)

    if amount > 0:
        for word in INCOME_KEYWORDS:
            if word in cleaned:
                return "Income"

    return None


def detect_transfer(description: str) -> Optional[str]:
    cleaned = clean_text(description)

    for word in TRANSFER_KEYWORDS:
        if word in cleaned:
            return "Transfer"

    return None


def ml_predict(normalized_description: str) -> Optional[str]:
    cleaned = clean_text(normalized_description)
    if not cleaned:
        return None

    try:
        probs = model.predict_proba([cleaned])[0]
        confidence = float(max(probs))
        prediction = str(model.classes_[probs.argmax()])

        if confidence < 0.55:
            return None

        return prediction
    except Exception:
        return None


def predict_category(description: str, amount: float) -> str:
    try:
        normalized_description = normalize_merchant(description)

        income_category = detect_income(description, amount)
        if income_category:
            return income_category

        transfer_category = detect_transfer(normalized_description)
        if transfer_category and amount != 0:
            return transfer_category

        rule_category = rule_based_category(normalized_description)
        if rule_category:
            return rule_category

        predicted = ml_predict(normalized_description)
        if predicted:
            return predicted

        # LLM fallback
        llm_result = llm_categorize(normalized_description)
        if llm_result:
            return llm_result

        if amount > 0:
            return "Income"

        return "Other"

    except Exception:
        return "Other"

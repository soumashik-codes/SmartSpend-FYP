import os
import re
import joblib
from typing import Optional
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from .rule_engine import rule_based_category

MODEL_PATH = "app/ml/category_model.pkl"

# ===============================
# 🔹 RULE-BASED MERCHANT ENGINE
# ===============================

RULES = {
    "Groceries": [
        "TESCO", "ALDI", "SAINSBURY", "ASDA", "LIDL", "M&S", "MARKS AND SPENCER",
        "WHOLE FOODS", "COOP", "CO-OP"
    ],
    "Food": [
        "MCDONALD", "KFC", "BURGER KING", "NANDO", "STARBUCKS",
        "COSTA", "GREGGS", "PRET", "SUBWAY", "UBER EATS",
        "DELIVEROO", "JUST EAT"
    ],
    "Transport": [
        "TFL", "TRAINLINE", "UBER", "BOLT", "RAIL",
        "SOUTHERN", "NATIONAL EXPRESS"
    ],
    "Subscription": [
        "SPOTIFY", "NETFLIX", "AMAZON PRIME", "DISNEY",
        "APPLE MUSIC", "YOUTUBE PREMIUM"
    ],
    "Shopping": [
        "AMAZON", "ZARA", "H&M", "PRIMARK",
        "BOOTS", "EBAY", "VINTED"
    ],
    "Fitness": [
        "GYM", "PUREGYM", "JD GYM"
    ],
    "Utilities": [
        "BRITISH GAS", "THAMES WATER",
        "EE LIMITED", "VODAFONE", "O2"
    ]
}

INCOME_KEYWORDS = [
    "SALARY", "PAYROLL", "TRANSFER FROM",
    "PAYMENT FROM", "RECEIVED FROM"
]

# ===============================
# 🔹 TEXT CLEANING
# ===============================

def clean_text(text: str) -> str:
    text = text.upper()
    text = re.sub(r"\d+", "", text)
    text = re.sub(r"[^A-Z\s]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()

# ===============================
# 🔹 ML TRAINING DATA
# ===============================

TRAIN_DATA = [
    ("TESCO STORES", "Groceries"),
    ("ALDI STORE", "Groceries"),
    ("MCDONALDS", "Food"),
    ("KFC", "Food"),
    ("TFL TRAVEL", "Transport"),
    ("UBER TRIP", "Transport"),
    ("SPOTIFY", "Subscription"),
    ("NETFLIX", "Subscription"),
    ("AMAZON PURCHASE", "Shopping"),
    ("ZARA", "Shopping"),
    ("GYM GROUP", "Fitness"),
]

def train_model():
    texts = [clean_text(x[0]) for x in TRAIN_DATA]
    labels = [x[1] for x in TRAIN_DATA]

    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2))),
        ("clf", LogisticRegression(max_iter=2000)),
    ])

    pipeline.fit(texts, labels)
    joblib.dump(pipeline, MODEL_PATH)
    return pipeline

def load_model():
    if os.path.exists(MODEL_PATH):
        return joblib.load(MODEL_PATH)
    return train_model()

model = load_model()

# ===============================
# 🔹 HYBRID PREDICTOR
# ===============================

def rule_match(description: str) -> Optional[str]:
    for category, keywords in RULES.items():
        for word in keywords:
            if word in description:
                return category
    return None

def detect_income(description: str, amount: float) -> Optional[str]:
    if amount > 0:
        for word in INCOME_KEYWORDS:
            if word in description:
                return "Income"
    return None

def ml_predict(description: str) -> Optional[str]:
    cleaned = clean_text(description)
    probs = model.predict_proba([cleaned])[0]
    confidence = max(probs)
    prediction = model.classes_[probs.argmax()]

    if confidence < 0.35:
        return None
    return prediction

def predict_category(description: str, amount: float) -> str:
    try:
        # 1️⃣ Income detection (strong rule)
        if amount > 0:
            return "Income"

        # 2️⃣ Rule-based expense detection
        rule_category = rule_based_category(description)
        if rule_category:
            return rule_category

        # 3️⃣ ML fallback
        cleaned = clean_text(description)
        probs = model.predict_proba([cleaned])[0]
        confidence = max(probs)
        prediction = model.classes_[probs.argmax()]

        if confidence < 0.6:
            return "Uncategorised"

        return prediction

    except Exception:
        return "Uncategorised"



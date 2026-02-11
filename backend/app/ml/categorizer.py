import os
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

MODEL_PATH = "app/ml/category_model.pkl"

# Basic training dataset (will expand later)
TRAIN_DATA = [
    ("TESCO STORES", "Groceries"),
    ("ALDI STORE", "Groceries"),
    ("SAINSBURY", "Groceries"),
    ("ASDA", "Groceries"),
    ("LIDL", "Groceries"),
    ("MCDONALDS", "Food"),
    ("KFC", "Food"),
    ("UBER TRIP", "Transport"),
    ("TFL TRAVEL", "Transport"),
    ("TRAINLINE", "Transport"),
    ("SPOTIFY", "Subscription"),
    ("NETFLIX", "Subscription"),
    ("AMAZON PURCHASE", "Shopping"),
    ("ZARA", "Shopping"),
    ("H&M", "Shopping"),
    ("GYM GROUP", "Fitness"),
    ("PUREGYM", "Fitness"),
]


def train_model():
    texts = [x[0] for x in TRAIN_DATA]
    labels = [x[1] for x in TRAIN_DATA]

    pipeline = Pipeline(
        [("tfidf", TfidfVectorizer()), ("clf", LogisticRegression(max_iter=1000))]
    )

    pipeline.fit(texts, labels)

    joblib.dump(pipeline, MODEL_PATH)
    return pipeline


def load_model():
    if os.path.exists(MODEL_PATH):
        return joblib.load(MODEL_PATH)
    else:
        return train_model()


model = load_model()


def predict_category(description: str) -> str:
    try:
        prediction = model.predict([description.upper()])
        return prediction[0]
    except Exception:
        return "Uncategorised"

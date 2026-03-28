from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Iterable

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.feature_extraction import DictVectorizer

from .merchant_normalizer import normalize_merchant

MIN_EXPENSE_TRANSACTIONS = 20
MIN_ANOMALY_AMOUNT = 30.0


@dataclass
class AnomalyResult:
    transaction_id: int
    is_anomaly: bool
    anomaly_score: float | None
    reasons: list[str]


def _build_feature_rows(expense_transactions: Iterable) -> tuple[list[int], list[dict[str, float | str]]]:
    transactions = list(expense_transactions)
    normalized_merchants = [
        normalize_merchant(getattr(transaction, "description", "")) or "UNKNOWN"
        for transaction in transactions
    ]
    merchant_counts = Counter(normalized_merchants)

    transaction_ids: list[int] = []
    feature_rows: list[dict[str, float | str]] = []

    for transaction, merchant in zip(transactions, normalized_merchants):
        transaction_id = getattr(transaction, "id", None)
        if transaction_id is None:
            continue

        tx_date = getattr(transaction, "date", None)
        day_of_week = tx_date.weekday() if tx_date else 0
        amount = abs(float(getattr(transaction, "amount", 0.0)))
        category = getattr(transaction, "category", None) or "Other"

        transaction_ids.append(int(transaction_id))
        feature_rows.append(
            {
                "amount": amount,
                "merchant_frequency": float(merchant_counts[merchant]),
                "day_of_week": float(day_of_week),
                f"category={category}": 1.0,
            }
        )

    return transaction_ids, feature_rows


def detect_expense_anomalies(transactions: Iterable) -> dict[int, AnomalyResult]:
    expense_transactions = [
        transaction for transaction in transactions if float(getattr(transaction, "amount", 0.0)) < 0
    ]

    if len(expense_transactions) < MIN_EXPENSE_TRANSACTIONS:
        return {
            int(transaction.id): AnomalyResult(
                transaction_id=int(transaction.id),
                is_anomaly=False,
                anomaly_score=None,
                reasons=[],
            )
            for transaction in expense_transactions
            if getattr(transaction, "id", None) is not None
        }

    transaction_ids, feature_rows = _build_feature_rows(expense_transactions)
    if len(transaction_ids) < MIN_EXPENSE_TRANSACTIONS:
        return {}

    normalized_merchants = [
        normalize_merchant(getattr(transaction, "description", "")) or "UNKNOWN"
        for transaction in expense_transactions
    ]
    merchant_counts = Counter(normalized_merchants)
    all_amounts = [abs(float(getattr(transaction, "amount", 0.0))) for transaction in expense_transactions]
    overall_median = float(np.median(all_amounts)) if all_amounts else 0.0

    category_amounts: dict[str, list[float]] = {}
    for transaction in expense_transactions:
        category = getattr(transaction, "category", None) or "Other"
        category_amounts.setdefault(category, []).append(abs(float(getattr(transaction, "amount", 0.0))))

    vectorizer = DictVectorizer(sparse=False)
    feature_matrix = vectorizer.fit_transform(feature_rows)
    feature_matrix = np.asarray(feature_matrix, dtype=float)

    model = IsolationForest(
        n_estimators=200,
        contamination=0.08,
        random_state=42,
    )
    predictions = model.fit_predict(feature_matrix)
    raw_scores = model.score_samples(feature_matrix)

    results: dict[int, AnomalyResult] = {}
    for transaction_id, prediction, raw_score, transaction in zip(
        transaction_ids,
        predictions,
        raw_scores,
        expense_transactions,
    ):
        amount = abs(float(getattr(transaction, "amount", 0.0)))
        is_anomaly = bool(prediction == -1) and amount >= MIN_ANOMALY_AMOUNT
        category = getattr(transaction, "category", None) or "Other"
        merchant = normalize_merchant(getattr(transaction, "description", "")) or "UNKNOWN"
        category_values = category_amounts.get(category, [])
        category_median = float(np.median(category_values)) if category_values else 0.0

        reasons: list[str] = []
        if is_anomaly:
            if len(category_values) >= 3 and category_median > 0 and amount >= max(category_median * 1.6, category_median + 15):
                reasons.append(f"Higher than usual {category} spend")
            if merchant_counts.get(merchant, 0) <= 2:
                reasons.append("Rare merchant")
            if overall_median > 0 and amount >= max(overall_median * 2, overall_median + 20):
                reasons.append("Large transaction compared to your normal pattern")
            if not reasons:
                reasons.append("Large transaction compared to your normal pattern")

        results[transaction_id] = AnomalyResult(
            transaction_id=transaction_id,
            is_anomaly=is_anomaly,
            anomaly_score=round(float(-raw_score), 6),
            reasons=reasons,
        )

    return results

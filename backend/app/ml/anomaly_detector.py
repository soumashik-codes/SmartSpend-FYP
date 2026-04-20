from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import date
from typing import Iterable

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.feature_extraction import DictVectorizer

from .merchant_normalizer import normalize_merchant

MIN_EXPENSE_TRANSACTIONS = 20
MIN_ANOMALY_AMOUNT = 30.0
MIN_CONTAMINATION = 0.03
MAX_CONTAMINATION = 0.06
RECURRING_INTERVAL_MIN_DAYS = 21
RECURRING_INTERVAL_MAX_DAYS = 40
RECURRING_AMOUNT_TOLERANCE = 5.0


@dataclass
class AnomalyResult:
    transaction_id: int
    is_anomaly: bool
    anomaly_score: float | None
    reasons: list[str]


@dataclass
class RecurringPattern:
    merchant: str
    category: str
    median_amount: float
    transaction_ids: set[int]


def _resolve_contamination(sample_size: int) -> float:
    if sample_size <= 0:
        return MIN_CONTAMINATION

    # Keep Isolation Forest active, but avoid forcing too many anomalies in
    # small/clean personal-finance datasets.
    target = 2 / sample_size
    return float(min(MAX_CONTAMINATION, max(MIN_CONTAMINATION, target)))


def _is_amount_consistent(amounts: list[float]) -> bool:
    if len(amounts) < 3:
        return False

    median_amount = float(np.median(amounts))
    if median_amount <= 0:
        return False

    return all(abs(amount - median_amount) <= RECURRING_AMOUNT_TOLERANCE for amount in amounts)


def _is_monthly_like_pattern(dates: list[date]) -> bool:
    if len(dates) < 3:
        return False

    sorted_dates = sorted(dates)
    intervals = [
        (current - previous).days
        for previous, current in zip(sorted_dates, sorted_dates[1:])
    ]
    if len(intervals) < 2:
        return False

    median_interval = float(np.median(intervals))
    if not (RECURRING_INTERVAL_MIN_DAYS <= median_interval <= RECURRING_INTERVAL_MAX_DAYS):
        return False

    in_range_count = sum(
        RECURRING_INTERVAL_MIN_DAYS <= interval <= RECURRING_INTERVAL_MAX_DAYS
        for interval in intervals
    )
    return in_range_count >= max(2, int(np.ceil(len(intervals) * 0.75)))


def _build_recurring_patterns(expense_transactions: Iterable) -> dict[int, RecurringPattern]:
    grouped: dict[tuple[str, str], list] = {}
    for transaction in expense_transactions:
        transaction_id = getattr(transaction, "id", None)
        tx_date = getattr(transaction, "date", None)
        if transaction_id is None or tx_date is None:
            continue

        merchant = normalize_merchant(getattr(transaction, "description", "")) or "UNKNOWN"
        category = getattr(transaction, "category", None) or "Other"
        grouped.setdefault((merchant, category), []).append(transaction)

    patterns: dict[int, RecurringPattern] = {}
    for (merchant, category), transactions in grouped.items():
        if len(transactions) < 3:
            continue

        amounts = [abs(float(getattr(transaction, "amount", 0.0))) for transaction in transactions]
        dates = [getattr(transaction, "date") for transaction in transactions]
        if not _is_amount_consistent(amounts) or not _is_monthly_like_pattern(dates):
            continue

        median_amount = float(np.median(amounts))
        pattern = RecurringPattern(
            merchant=merchant,
            category=category,
            median_amount=median_amount,
            transaction_ids={int(getattr(transaction, "id")) for transaction in transactions},
        )
        for transaction in transactions:
            patterns[int(getattr(transaction, "id"))] = pattern

    return patterns


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
    recurring_patterns = _build_recurring_patterns(expense_transactions)
    all_amounts = [abs(float(getattr(transaction, "amount", 0.0))) for transaction in expense_transactions]
    overall_median = float(np.median(all_amounts)) if all_amounts else 0.0

    category_amounts: dict[str, list[float]] = {}
    merchant_amounts: dict[str, list[float]] = {}
    for transaction in expense_transactions:
        category = getattr(transaction, "category", None) or "Other"
        amount = abs(float(getattr(transaction, "amount", 0.0)))
        merchant = normalize_merchant(getattr(transaction, "description", "")) or "UNKNOWN"
        category_amounts.setdefault(category, []).append(amount)
        merchant_amounts.setdefault(merchant, []).append(amount)

    vectorizer = DictVectorizer(sparse=False)
    feature_matrix = vectorizer.fit_transform(feature_rows)
    feature_matrix = np.asarray(feature_matrix, dtype=float)

    model = IsolationForest(
        n_estimators=200,
        contamination=_resolve_contamination(len(feature_matrix)),
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
        merchant_values = merchant_amounts.get(merchant, [])
        merchant_median = float(np.median(merchant_values)) if merchant_values else 0.0
        recurring_pattern = recurring_patterns.get(transaction_id)

        if is_anomaly and recurring_pattern and amount <= recurring_pattern.median_amount + RECURRING_AMOUNT_TOLERANCE:
            is_anomaly = False

        reasons: list[str] = []
        if is_anomaly:
            if (
                len(merchant_values) >= 3
                and merchant_median > 0
                and amount >= max(merchant_median * 1.35, merchant_median + 10)
            ):
                reasons.append("Higher than your usual spend for this merchant")
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

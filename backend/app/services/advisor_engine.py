from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date
from statistics import mean

from .. import models
from ..ml.anomaly_detector import detect_expense_anomalies
from ..ml.merchant_normalizer import canonicalize_merchant
from .advisor_narrative import generate_advisor_narrative


LABEL_THRESHOLDS = [
    (85, "Excellent"),
    (70, "Good"),
    (55, "Fair"),
    (0, "Needs attention"),
]

INSIGHT_ORDER = {
    "warning": 0,
    "positive": 1,
    "info": 2,
}

DISCRETIONARY_CATEGORIES = {
    "Dining",
    "Entertainment",
    "Shopping",
    "Travel",
    "Transport",
    "Personal Care",
    "Fitness",
}

FOOD_CATEGORIES = {"Groceries", "Dining"}

RECURRING_FRIENDLY_CATEGORIES = {
    "Housing",
    "Utilities",
    "Entertainment",
    "Fitness",
    "Healthcare",
    "Personal Care",
    "Other",
}

RECURRING_EXCLUDED_CATEGORIES = {
    "Groceries",
    "Dining",
    "Shopping",
    "Transport",
    "Cash Withdrawal",
    "Transfer",
    "Income",
}

SUBSCRIPTION_HINT_KEYWORDS = (
    "RENT",
    "MORTGAGE",
    "COUNCIL",
    "ENERGY",
    "ELECTRIC",
    "WATER",
    "GAS",
    "VODAFONE",
    "VIRGIN",
    "NETFLIX",
    "SPOTIFY",
    "DISNEY",
    "PRIME",
    "APPLE",
    "GOOGLE",
    "GYM",
    "FITNESS",
    "INSURANCE",
    "BROADBAND",
    "PHONE",
    "MOBILE",
    "BT",
    "O2",
    "EE",
)


@dataclass
class RecurringCharge:
    merchant: str
    average_amount: float
    transaction_count: int
    latest_date: date
    category: str
    cadence_days: int
    cadence_label: str
    recent_total: float


def round_money(value: float) -> float:
    return round(float(value), 2)


def month_key(value: date) -> str:
    return value.strftime("%Y-%m")


def shift_month(key: str, offset: int) -> str:
    year, month = key.split("-")
    year_num = int(year)
    month_num = int(month)
    month_index = (year_num * 12 + (month_num - 1)) + offset
    shifted_year = month_index // 12
    shifted_month = (month_index % 12) + 1
    return f"{shifted_year:04d}-{shifted_month:02d}"


def iter_month_keys(start_key: str, end_key: str) -> list[str]:
    keys = []
    current = start_key
    while current <= end_key:
        keys.append(current)
        current = shift_month(current, 1)
    return keys


def average(values: list[float]) -> float:
    return round_money(mean(values)) if values else 0.0


def is_stable_essential_recurring(
    merchant: str,
    category: str,
    recurring_lookup: dict[str, RecurringCharge],
) -> bool:
    recurring = recurring_lookup.get(merchant)
    if not recurring:
        return False

    if recurring.category not in {"Housing", "Utilities"}:
        return False

    return recurring.transaction_count >= 3 and recurring.cadence_label == "monthly"


def build_monthly_series(
    transactions: list[models.Transaction],
) -> tuple[list[str], dict[str, float], dict[str, float], dict[str, dict[str, float]]]:
    if not transactions:
        return [], {}, {}, {}

    start_key = month_key(transactions[0].date)
    end_key = month_key(transactions[-1].date)
    months = iter_month_keys(start_key, end_key)

    income_by_month = {month: 0.0 for month in months}
    expense_by_month = {month: 0.0 for month in months}
    category_by_month: dict[str, dict[str, float]] = {
        month: defaultdict(float) for month in months
    }

    for transaction in transactions:
        key = month_key(transaction.date)
        amount = float(transaction.amount)
        if amount > 0:
            income_by_month[key] += amount
        elif amount < 0:
            expense_by_month[key] += abs(amount)
            category = transaction.category or "Other"
            category_by_month[key][category] += abs(amount)

    normalized_categories = {
        month: {
            category: round_money(total)
            for category, total in sorted(values.items(), key=lambda item: (-item[1], item[0]))
        }
        for month, values in category_by_month.items()
    }

    return (
        months,
        {month: round_money(total) for month, total in income_by_month.items()},
        {month: round_money(total) for month, total in expense_by_month.items()},
        normalized_categories,
    )


def get_recent_and_previous_months(months: list[str], period_months: int = 3) -> tuple[list[str], list[str]]:
    if not months:
        return [], []

    recent = months[-min(period_months, len(months)):]
    previous_end_index = max(0, len(months) - len(recent))
    previous = months[max(0, previous_end_index - len(recent)):previous_end_index]
    return recent, previous


def get_period_transactions(
    transactions: list[models.Transaction],
    months: set[str],
) -> list[models.Transaction]:
    return [transaction for transaction in transactions if month_key(transaction.date) in months]


def score_label(score: int) -> str:
    for threshold, label in LABEL_THRESHOLDS:
        if score >= threshold:
            return label
    return "Needs attention"


def build_score_message(label: str, component_scores: dict[str, int]) -> str:
    weakest_component = min(component_scores.items(), key=lambda item: item[1])[0]
    strongest_component = max(component_scores.items(), key=lambda item: item[1])[0]

    if label in {"Excellent", "Good"}:
        return (
            f"Your recent spending is being supported by strong {strongest_component.replace('_', ' ')}. "
            f"The biggest remaining opportunity is {weakest_component.replace('_', ' ')}."
        )

    return (
        f"The advisor sees pressure in {weakest_component.replace('_', ' ')}. "
        f"Improving that area should have the fastest impact on your overall financial health."
    )


def compute_component_scores(
    recent_months: list[str],
    income_by_month: dict[str, float],
    expense_by_month: dict[str, float],
    anomaly_count: int,
    recurring_monthly_total: float,
) -> dict[str, int]:
    if not recent_months:
        return {
            "cash_flow": 50,
            "stability": 50,
            "anomaly_control": 50,
            "commitments": 50,
        }

    incomes = [income_by_month.get(month, 0.0) for month in recent_months]
    expenses = [expense_by_month.get(month, 0.0) for month in recent_months]
    positive_months = sum(1 for income, expense in zip(incomes, expenses) if income - expense >= 0)
    average_income = average(incomes)
    average_expense = average(expenses)
    savings_margin = ((average_income - average_expense) / average_income) if average_income > 0 else 0.0
    cash_flow = int(max(0, min(100, round((positive_months / len(recent_months)) * 55 + max(0.0, savings_margin) * 45))))

    if average_expense > 0:
        normalized_changes = []
        previous_value = None
        for value in expenses:
            if previous_value is not None and previous_value > 0:
                normalized_changes.append(abs(value - previous_value) / previous_value)
            previous_value = value
        volatility = average(normalized_changes)
        stability = int(max(0, min(100, round(100 - min(1.0, volatility) * 100))))
    else:
        stability = 60

    recent_expense_transactions = max(1, sum(1 for income, expense in zip(incomes, expenses) if expense > 0) * 10)
    anomaly_rate = anomaly_count / recent_expense_transactions
    anomaly_control = int(max(0, min(100, round(100 - min(1.0, anomaly_rate * 5) * 100))))

    if average_income > 0:
        commitments_ratio = recurring_monthly_total / average_income
    elif average_expense > 0:
        commitments_ratio = recurring_monthly_total / average_expense
    else:
        commitments_ratio = 0.0
    commitments = int(max(0, min(100, round(100 - min(1.0, commitments_ratio) * 100))))

    return {
        "cash_flow": cash_flow,
        "stability": stability,
        "anomaly_control": anomaly_control,
        "commitments": commitments,
    }


def compute_health_score(
    recent_months: list[str],
    income_by_month: dict[str, float],
    expense_by_month: dict[str, float],
    anomaly_count: int,
    recurring_monthly_total: float,
) -> tuple[int, dict[str, int]]:
    components = compute_component_scores(
        recent_months=recent_months,
        income_by_month=income_by_month,
        expense_by_month=expense_by_month,
        anomaly_count=anomaly_count,
        recurring_monthly_total=recurring_monthly_total,
    )
    score = round(
        components["cash_flow"] * 0.4
        + components["stability"] * 0.2
        + components["anomaly_control"] * 0.2
        + components["commitments"] * 0.2
    )
    return int(max(0, min(100, score))), components


def build_score_reasons(
    recent_months: list[str],
    income_by_month: dict[str, float],
    expense_by_month: dict[str, float],
    anomaly_count: int,
    recurring_monthly_total: float,
    average_income_recent: float,
) -> list[str]:
    reasons: list[str] = []
    if recent_months:
        positive_months = sum(
            1
            for month in recent_months
            if income_by_month.get(month, 0.0) - expense_by_month.get(month, 0.0) >= 0
        )
        if positive_months:
            reasons.append(f"Positive cash flow in {positive_months} of your last {len(recent_months)} months.")

        latest_month = recent_months[-1]
        latest_income = income_by_month.get(latest_month, 0.0)
        latest_expense = expense_by_month.get(latest_month, 0.0)
        if latest_income > 0:
            savings_rate = ((latest_income - latest_expense) / latest_income) * 100
            if savings_rate >= 20:
                reasons.append(f"Savings rate reached {savings_rate:.0f}% in {latest_month}.")
            elif savings_rate <= 5:
                reasons.append(f"Savings rate is only {max(0.0, savings_rate):.0f}% in {latest_month}.")

    if anomaly_count:
        reasons.append(f"{anomaly_count} recent transactions were flagged as unusual.")

    if average_income_recent > 0 and recurring_monthly_total > 0:
        commitments_pct = (recurring_monthly_total / average_income_recent) * 100
        reasons.append(f"Recurring payments use about {commitments_pct:.0f}% of recent monthly income.")

    return reasons[:4] or ["More uploaded history will improve the accuracy of these signals."]


def detect_recurring_charges(transactions: list[models.Transaction]) -> list[RecurringCharge]:
    grouped: dict[str, list[models.Transaction]] = defaultdict(list)
    for transaction in transactions:
        if float(transaction.amount) >= 0:
            continue
        merchant = canonicalize_merchant(transaction.description)
        if not merchant:
            continue
        grouped[merchant].append(transaction)

    recurring: list[RecurringCharge] = []
    for merchant, rows in grouped.items():
        ordered = sorted(rows, key=lambda row: row.date)
        distinct_months = {month_key(row.date) for row in ordered}
        if len(ordered) < 2 or len(distinct_months) < 2:
            continue

        category_counts = Counter((row.category or "Other") for row in ordered)
        dominant_category, _ = category_counts.most_common(1)[0]
        merchant_has_hint = any(keyword in merchant for keyword in SUBSCRIPTION_HINT_KEYWORDS)

        if dominant_category in RECURRING_EXCLUDED_CATEGORIES and not merchant_has_hint:
            continue

        amounts = [abs(float(row.amount)) for row in ordered]
        average_amount = average(amounts)
        if average_amount < 5:
            continue

        min_amount = min(amounts)
        max_amount = max(amounts)
        amount_variation = ((max_amount - min_amount) / min_amount) if min_amount > 0 else 1.0
        gaps = [(ordered[index].date - ordered[index - 1].date).days for index in range(1, len(ordered))]
        monthly_like_gaps = [gap for gap in gaps if 24 <= gap <= 38]
        median_gap = sorted(gaps)[len(gaps) // 2] if gaps else 0
        cadence_label = "monthly" if 24 <= median_gap <= 38 else "recurring"

        if dominant_category not in RECURRING_FRIENDLY_CATEGORIES and not merchant_has_hint:
            if len(ordered) < 3 or len(monthly_like_gaps) < 2:
                continue

        if amount_variation > (0.18 if merchant_has_hint else 0.12):
            continue

        if not monthly_like_gaps and not merchant_has_hint:
            continue

        recurring.append(
            RecurringCharge(
                merchant=merchant,
                average_amount=average_amount,
                transaction_count=len(ordered),
                latest_date=ordered[-1].date,
                category=dominant_category,
                cadence_days=int(round(mean(monthly_like_gaps or gaps or [30]))),
                cadence_label=cadence_label,
                recent_total=round_money(sum(amounts[-min(3, len(amounts)):]))
            )
        )

    recurring.sort(key=lambda item: (item.average_amount, item.transaction_count), reverse=True)
    return recurring


def build_category_period_totals(
    category_by_month: dict[str, dict[str, float]],
    months: list[str],
) -> Counter[str]:
    totals: Counter[str] = Counter()
    for month in months:
        for category, total in category_by_month.get(month, {}).items():
            totals[category] += total
    return totals


def top_merchants_for_category(
    transactions: list[models.Transaction],
    category: str,
) -> list[dict]:
    merchant_totals: Counter[str] = Counter()
    merchant_counts: Counter[str] = Counter()
    for transaction in transactions:
        if float(transaction.amount) >= 0 or (transaction.category or "Other") != category:
            continue
        merchant = canonicalize_merchant(transaction.description) or transaction.description
        merchant_totals[merchant] += abs(float(transaction.amount))
        merchant_counts[merchant] += 1

    rows = []
    for merchant, total in merchant_totals.most_common(3):
        rows.append(
            {
                "merchant": merchant,
                "total": round_money(total),
                "transaction_count": int(merchant_counts[merchant]),
            }
        )
    return rows


def build_category_drilldowns(
    transactions: list[models.Transaction],
    category_by_month: dict[str, dict[str, float]],
    recent_months: list[str],
    previous_months: list[str],
) -> list[dict]:
    recent_totals = build_category_period_totals(category_by_month, recent_months)
    previous_totals = build_category_period_totals(category_by_month, previous_months)
    total_recent_spend = sum(recent_totals.values()) or 1.0

    recent_transactions = get_period_transactions(transactions, set(recent_months))
    rows = []
    for category, recent_total in recent_totals.most_common(5):
        recent_average = recent_total / max(1, len(recent_months))
        previous_average = previous_totals.get(category, 0.0) / max(1, len(previous_months)) if previous_months else 0.0
        if previous_average > 0:
            change_pct = ((recent_average - previous_average) / previous_average) * 100
        else:
            change_pct = 100.0 if recent_average > 0 else 0.0

        rows.append(
            {
                "category": category,
                "recent_average": round_money(recent_average),
                "previous_average": round_money(previous_average),
                "change_pct": round_money(change_pct),
                "recent_total": round_money(recent_total),
                "share_pct": round_money((recent_total / total_recent_spend) * 100),
                "top_merchants": top_merchants_for_category(recent_transactions, category),
            }
        )

    return rows


def build_recent_anomalies(
    transactions: list[models.Transaction],
    recent_months: list[str],
    recurring_lookup: dict[str, RecurringCharge],
) -> tuple[list[dict], int]:
    recent_months_set = set(recent_months)
    anomaly_results = detect_expense_anomalies(transactions)
    anomalies = []
    for transaction in transactions:
        if month_key(transaction.date) not in recent_months_set:
            continue
        result = anomaly_results.get(int(transaction.id))
        if not result or not result.is_anomaly:
            continue

        merchant = canonicalize_merchant(transaction.description)
        if is_stable_essential_recurring(
            merchant=merchant,
            category=transaction.category or "Other",
            recurring_lookup=recurring_lookup,
        ):
            continue

        anomalies.append(
            {
                "id": int(transaction.id),
                "date": transaction.date.isoformat(),
                "description": transaction.description,
                "amount": round_money(abs(float(transaction.amount))),
                "category": transaction.category or "Other",
                "reasons": result.reasons,
            }
        )

    anomalies.sort(key=lambda item: item["amount"], reverse=True)
    return anomalies[:5], len(anomalies)


def build_spending_spike_insight(category_drilldowns: list[dict]) -> dict | None:
    candidates = [
        row
        for row in category_drilldowns
        if row["previous_average"] > 0 and row["change_pct"] >= 18 and row["recent_average"] - row["previous_average"] >= 35
    ]
    if not candidates:
        return None

    row = max(candidates, key=lambda item: item["recent_average"] - item["previous_average"])
    merchant_text = ", ".join(merchant["merchant"] for merchant in row["top_merchants"][:2])
    detail = (
        f"{row['category']} spending is up {row['change_pct']:.0f}% versus the previous period, "
        f"averaging GBP {row['recent_average']:,.2f} a month."
    )
    if merchant_text:
        detail += f" Main drivers: {merchant_text}."

    return {
        "kind": "warning",
        "title": f"{row['category']} Spending Spike",
        "detail": detail,
        "metric_label": "Recent monthly average",
        "metric_value": f"GBP {row['recent_average']:,.0f}",
    }


def build_food_budget_insight(category_drilldowns: list[dict], recent_months: list[str]) -> dict | None:
    food_rows = [row for row in category_drilldowns if row["category"] in FOOD_CATEGORIES]
    if not food_rows:
        return None

    recent_average = sum(row["recent_average"] for row in food_rows)
    previous_average = sum(row["previous_average"] for row in food_rows)
    if previous_average <= 0:
        return None

    change_pct = ((recent_average - previous_average) / previous_average) * 100
    if abs(change_pct) > 8:
        return None

    return {
        "kind": "positive",
        "title": "Food Budget On Track",
        "detail": (
            f"Across your last {len(recent_months)} months, food spending is holding steady at "
            f"about GBP {recent_average:,.2f} a month, {abs(change_pct):.0f}% "
            f"{'below' if change_pct < 0 else 'above'} the previous period."
        ),
        "metric_label": "Food monthly average",
        "metric_value": f"GBP {recent_average:,.0f}",
    }


def build_recurring_insight(recurring: list[RecurringCharge], average_income_recent: float) -> dict | None:
    if not recurring:
        return None

    recurring_monthly_total = sum(item.average_amount for item in recurring[:5])
    ratio = (recurring_monthly_total / average_income_recent * 100) if average_income_recent > 0 else 0.0
    top_names = ", ".join(item.merchant for item in recurring[:2])

    return {
        "kind": "info" if ratio < 35 else "warning",
        "title": "Recurring Payment Review",
        "detail": (
            f"The advisor detected about GBP {recurring_monthly_total:,.2f} a month in recurring payment patterns. "
            f"Review items such as {top_names} to confirm they still belong in your regular budget."
        ),
        "metric_label": "Recurring monthly spend",
        "metric_value": f"GBP {recurring_monthly_total:,.0f}",
    }


def build_savings_opportunity(category_drilldowns: list[dict]) -> tuple[dict | None, str | None]:
    discretionary_rows = [row for row in category_drilldowns if row["category"] in DISCRETIONARY_CATEGORIES]
    if not discretionary_rows:
        return None, None

    row = max(discretionary_rows, key=lambda item: item["recent_average"])
    if row["previous_average"] > 0 and row["recent_average"] > row["previous_average"]:
        monthly_savings = row["recent_average"] - row["previous_average"]
    else:
        monthly_savings = row["recent_average"] * 0.08

    if monthly_savings < 10:
        return None, None

    six_month_savings = monthly_savings * 6
    return (
        {
            "kind": "info",
            "title": "Savings Opportunity",
            "detail": (
                f"{row['category']} is currently averaging GBP {row['recent_average']:,.2f} per month. "
                f"Bringing it down by about GBP {monthly_savings:,.2f} a month could free up "
                f"roughly GBP {six_month_savings:,.2f} over the next 6 months."
            ),
            "metric_label": "Potential 6-month savings",
            "metric_value": f"GBP {six_month_savings:,.0f}",
        },
        row["category"],
    )


def build_anomaly_insight(recent_anomalies: list[dict]) -> dict | None:
    if not recent_anomalies:
        return None

    top = recent_anomalies[0]
    reason_text = ", ".join(top["reasons"][:2])
    detail = (
        f"The largest unusual recent transaction was {top['description']} for GBP {top['amount']:,.2f}."
    )
    if reason_text:
        detail += f" It was flagged because of {reason_text.lower()}."

    return {
        "kind": "warning",
        "title": "Unusual Spending To Review",
        "detail": detail,
        "metric_label": "Largest flagged expense",
        "metric_value": f"GBP {top['amount']:,.0f}",
    }


def build_recommendations(
    category_drilldowns: list[dict],
    recent_anomalies: list[dict],
    recurring: list[RecurringCharge],
    savings_category: str | None,
    score: int,
) -> list[str]:
    recommendations: list[str] = []

    spike_row = next(
        (
            row for row in category_drilldowns
            if row["previous_average"] > 0 and row["change_pct"] >= 18
        ),
        None,
    )
    if spike_row:
        recommendations.append(
            f"Set a watch target for {spike_row['category'].lower()} at or below GBP {spike_row['previous_average']:,.0f} per month until the recent spike settles."
        )

    if recent_anomalies:
        top = recent_anomalies[0]
        reasons = ", ".join(top["reasons"][:2]).lower()
        recommendations.append(
            f"Review {top['description']} from {top['date']} because it was flagged for {reasons or 'unusual spending behaviour'}."
        )

    if recurring:
        top_recurring = recurring[0]
        recommendations.append(
            f"Verify the recurring {top_recurring.category.lower()} payment to {top_recurring.merchant} still belongs in your monthly budget."
        )

    if savings_category:
        savings_row = next(
            (row for row in category_drilldowns if row["category"] == savings_category),
            None,
        )
        savings_amount = savings_row["recent_average"] if savings_row else 0.0
        recommendations.append(
            f"If you reduce {savings_category.lower()} from its recent average of GBP {savings_amount:,.0f} a month, move the difference into savings as income arrives."
        )

    if score >= 75 and not spike_row and not recent_anomalies:
        recommendations.append(
            "Keep your strongest months repeatable by checking your balance and category trends once a week."
        )
    elif not recent_anomalies and not spike_row:
        recommendations.append(
            "Focus on one spending category first, then reassess the advisor after another month of uploaded transactions."
        )

    deduped: list[str] = []
    for item in recommendations:
        if item not in deduped:
            deduped.append(item)
    return deduped[:4]


def build_top_categories(category_drilldowns: list[dict]) -> list[dict]:
    return [
        {
            "category": row["category"],
            "total": row["recent_total"],
            "change_pct": row["change_pct"],
            "recent_average": row["recent_average"],
        }
        for row in category_drilldowns[:4]
    ]


def build_advisor_summary(account: models.Account, transactions: list[models.Transaction]) -> dict:
    ordered_transactions = sorted(transactions, key=lambda row: (row.date, row.id))
    months, income_by_month, expense_by_month, category_by_month = build_monthly_series(ordered_transactions)
    recent_months, previous_months = get_recent_and_previous_months(months, period_months=3)
    recurring = detect_recurring_charges(ordered_transactions)
    recurring_lookup = {item.merchant: item for item in recurring}
    recent_anomalies, anomaly_count = build_recent_anomalies(
        ordered_transactions,
        recent_months,
        recurring_lookup,
    )

    recurring_monthly_total = round_money(sum(item.average_amount for item in recurring[:5]))
    average_income_recent = average([income_by_month.get(month, 0.0) for month in recent_months])
    score, component_scores = compute_health_score(
        recent_months=recent_months,
        income_by_month=income_by_month,
        expense_by_month=expense_by_month,
        anomaly_count=anomaly_count,
        recurring_monthly_total=recurring_monthly_total,
    )
    label = score_label(score)
    score_reasons = build_score_reasons(
        recent_months=recent_months,
        income_by_month=income_by_month,
        expense_by_month=expense_by_month,
        anomaly_count=anomaly_count,
        recurring_monthly_total=recurring_monthly_total,
        average_income_recent=average_income_recent,
    )

    category_drilldowns = build_category_drilldowns(
        transactions=ordered_transactions,
        category_by_month=category_by_month,
        recent_months=recent_months,
        previous_months=previous_months,
    )
    savings_opportunity, savings_category = build_savings_opportunity(category_drilldowns)

    highlights = [
        build_anomaly_insight(recent_anomalies),
        build_spending_spike_insight(category_drilldowns),
        build_food_budget_insight(category_drilldowns, recent_months),
        build_recurring_insight(recurring, average_income_recent),
        savings_opportunity,
    ]
    highlights = [item for item in highlights if item is not None]
    highlights.sort(key=lambda item: (INSIGHT_ORDER.get(item["kind"], 99), item["title"]))
    if not highlights:
        highlights.append(
            {
                "kind": "info",
                "title": "Advisor Needs More History",
                "detail": "Keep uploading transaction files so the advisor can compare recent months against a stronger baseline.",
                "metric_label": "Transactions analyzed",
                "metric_value": str(len(ordered_transactions)),
            }
        )

    latest_month = months[-1] if months else None
    current_month_expenses = expense_by_month.get(latest_month, 0.0) if latest_month else 0.0
    trailing_months = months[-min(6, len(months)):] if months else []
    average_monthly_expenses = average([expense_by_month.get(month, 0.0) for month in trailing_months])
    savings_rate_month = next((month for month in reversed(months) if income_by_month.get(month, 0.0) > 0), None)
    savings_rate_income = income_by_month.get(savings_rate_month, 0.0) if savings_rate_month else 0.0
    savings_rate_expense = expense_by_month.get(savings_rate_month, 0.0) if savings_rate_month else 0.0
    savings_rate = ((savings_rate_income - savings_rate_expense) / savings_rate_income * 100) if savings_rate_income > 0 else 0.0

    recommendations = build_recommendations(
        category_drilldowns=category_drilldowns,
        recent_anomalies=recent_anomalies,
        recurring=recurring,
        savings_category=savings_category,
        score=score,
    )

    top_categories = build_top_categories(category_drilldowns)
    narrative = generate_advisor_narrative(
        account_name=account.name,
        score=score,
        label=label,
        recent_months=recent_months,
        current_month=latest_month,
        current_month_expenses=current_month_expenses,
        savings_rate=savings_rate,
        highlights=highlights,
        recommendations=recommendations,
        top_categories=top_categories,
        anomaly_count=anomaly_count,
    )

    return {
        "account_id": account.id,
        "account_name": account.name,
        "score": {
            "value": score,
            "label": label,
            "message": build_score_message(label, component_scores),
            "reasons": score_reasons,
        },
        "narrative": narrative,
        "highlights": highlights[:4],
        "recommendations": recommendations,
        "stats": {
            "current_month": latest_month,
            "current_month_expenses": round_money(current_month_expenses),
            "average_monthly_expenses": round_money(average_monthly_expenses),
            "savings_rate_pct": round_money(savings_rate),
            "savings_rate_month": savings_rate_month,
            "unusual_transaction_count": anomaly_count,
            "recurring_monthly_total": recurring_monthly_total,
            "recurring_charge_count": len(recurring),
            "analysis_months": len(months),
            "recent_period_months": len(recent_months),
        },
        "top_categories": top_categories,
        "recurring_charges": [
            {
                "merchant": item.merchant,
                "average_amount": round_money(item.average_amount),
                "transaction_count": item.transaction_count,
                "latest_date": item.latest_date.isoformat(),
                "category": item.category,
                "cadence_label": item.cadence_label,
            }
            for item in recurring[:5]
        ],
        "category_drilldowns": category_drilldowns,
        "recent_anomalies": recent_anomalies,
    }

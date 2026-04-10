from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any
from urllib import error, request

from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
ENABLE_ADVISOR_NARRATIVE = os.getenv("ENABLE_ADVISOR_NARRATIVE", "true").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}
GROQ_MODEL = os.getenv("ADVISOR_LLM_MODEL", "openai/gpt-oss-20b").strip() or "openai/gpt-oss-20b"
CACHE_PATH = Path(__file__).resolve().parents[2] / ".advisor_narrative_cache.json"


def _load_cache() -> dict[str, Any]:
    try:
        if CACHE_PATH.exists():
            return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return {}


def _save_cache(cache: dict[str, Any]) -> None:
    try:
        CACHE_PATH.write_text(json.dumps(cache, indent=2), encoding="utf-8")
    except Exception:
        return


def _fallback_narrative(
    label: str,
    score: int,
    current_month: str | None,
    current_month_expenses: float,
    savings_rate: float,
    highlights: list[dict],
    top_categories: list[dict],
) -> dict[str, str]:
    top_category = top_categories[0]["category"] if top_categories else "spending"
    highlight = highlights[0]["title"] if highlights else "cash flow"
    current_month_label = current_month or "your latest month"
    summary = (
        f"Financial health is currently rated {label.lower()} with a score of {score}. "
        f"In {current_month_label}, spending was GBP {current_month_expenses:,.2f} and the estimated savings rate was "
        f"{max(0.0, savings_rate):.0f}%. The biggest focus area right now is {highlight.lower()}, "
        f"while {top_category.lower()} remains the largest spending category."
    )
    return {
        "summary": summary,
        "source": "rules",
    }


def _cache_key(payload: dict[str, Any]) -> str:
    serialized = json.dumps(payload, sort_keys=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _call_groq(prompt: str) -> str | None:
    if not ENABLE_ADVISOR_NARRATIVE or not GROQ_API_KEY:
        return None

    body = json.dumps(
        {
            "model": GROQ_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
        }
    ).encode("utf-8")

    groq_request = request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(groq_request, timeout=12) as response:
            payload = json.loads(response.read().decode("utf-8"))
        content = payload["choices"][0]["message"]["content"].strip()
        return content or None
    except (error.URLError, error.HTTPError, KeyError, json.JSONDecodeError, TimeoutError):
        return None


def generate_advisor_narrative(
    *,
    account_name: str,
    score: int,
    label: str,
    recent_months: list[str],
    current_month: str | None,
    current_month_expenses: float,
    savings_rate: float,
    highlights: list[dict],
    recommendations: list[str],
    top_categories: list[dict],
    anomaly_count: int,
) -> dict[str, str]:
    fallback = _fallback_narrative(
        label=label,
        score=score,
        current_month=current_month,
        current_month_expenses=current_month_expenses,
        savings_rate=savings_rate,
        highlights=highlights,
        top_categories=top_categories,
    )

    payload = {
        "account_name": account_name,
        "score": score,
        "label": label,
        "recent_months": recent_months,
        "current_month": current_month,
        "current_month_expenses": round(current_month_expenses, 2),
        "savings_rate": round(savings_rate, 2),
        "highlight_titles": [item.get("title") for item in highlights[:3]],
        "recommendations": recommendations[:2],
        "top_categories": top_categories[:3],
        "anomaly_count": anomaly_count,
    }
    key = _cache_key(payload)
    cache = _load_cache()
    cached = cache.get(key)
    if isinstance(cached, dict) and cached.get("summary"):
        return cached

    prompt = f"""
You are writing one short financial advisor summary for a budgeting web app.

Use only the facts provided below. Do not invent transactions, merchants, or percentages.
Write 2 concise sentences in plain English. Keep it under 70 words total.
Tone: practical, confident, supportive, not hype.

Facts:
{json.dumps(payload, ensure_ascii=True)}
"""

    summary = _call_groq(prompt)
    if not summary:
        return fallback

    narrative = {
        "summary": " ".join(summary.split())[:500],
        "source": "llm",
    }
    cache[key] = narrative
    _save_cache(cache)
    return narrative

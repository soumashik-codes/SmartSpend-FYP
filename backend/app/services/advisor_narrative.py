from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any
from urllib import error, request

from dotenv import load_dotenv

load_dotenv()

ADVISOR_GROQ_API_KEY = os.getenv("ADVISOR_GROQ_API_KEY", "").strip()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
EFFECTIVE_GROQ_API_KEY = ADVISOR_GROQ_API_KEY or GROQ_API_KEY
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


def _normalize_text(value: str | None) -> str:
    return " ".join(str(value or "").split()).strip()


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
    if savings_rate < 0:
        savings_text = f"spending exceeded income by about {abs(savings_rate):.0f}%"
    else:
        savings_text = f"the estimated savings rate was {savings_rate:.0f}%"
    opening_text = f'Financial health is currently rated "{label}" with a score of {score}.'
    summary = (
        f"{opening_text} "
        f"In {current_month_label}, spending was GBP {current_month_expenses:,.2f} and {savings_text}. "
        f"The biggest focus area right now is {highlight.lower()}, "
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
    if not ENABLE_ADVISOR_NARRATIVE or not EFFECTIVE_GROQ_API_KEY:
        return None

    body = json.dumps(
        {
            "model": GROQ_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        }
    ).encode("utf-8")

    groq_request = request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {EFFECTIVE_GROQ_API_KEY}",
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


def _extract_json_object(raw: str) -> dict[str, Any] | None:
    cleaned = _normalize_text(raw)
    if not cleaned:
        return None

    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

    try:
        parsed = json.loads(cleaned)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return None
        try:
            parsed = json.loads(cleaned[start : end + 1])
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None


def _sanitize_recommendations(items: Any, fallback: list[str]) -> list[str]:
    if not isinstance(items, list):
        return fallback

    cleaned: list[str] = []
    for item in items:
        text = _normalize_text(item)
        if not text:
            continue
        cleaned.append(text[:220])

    deduped: list[str] = []
    for item in cleaned:
        if item not in deduped:
            deduped.append(item)

    return deduped[:4] or fallback


def generate_advisor_language_pack(
    *,
    account_name: str,
    score: int,
    label: str,
    score_message: str,
    score_reasons: list[str],
    recent_months: list[str],
    current_month: str | None,
    current_month_expenses: float,
    savings_rate: float,
    highlights: list[dict],
    recommendations: list[str],
    top_categories: list[dict],
    anomaly_count: int,
) -> dict[str, Any]:
    fallback_narrative = _fallback_narrative(
        label=label,
        score=score,
        current_month=current_month,
        current_month_expenses=current_month_expenses,
        savings_rate=savings_rate,
        highlights=highlights,
        top_categories=top_categories,
    )
    fallback = {
        "narrative": fallback_narrative,
        "score_message": score_message,
        "recommendations": recommendations,
    }

    payload = {
        "account_name": account_name,
        "score": score,
        "label": label,
        "score_message": score_message,
        "score_reasons": score_reasons[:4],
        "recent_months": recent_months,
        "current_month": current_month,
        "current_month_expenses": round(current_month_expenses, 2),
        "savings_rate": round(savings_rate, 2),
        "highlight_titles": [item.get("title") for item in highlights[:3]],
        "highlight_details": [_normalize_text(item.get("detail"))[:180] for item in highlights[:2]],
        "recommendations": recommendations[:4],
        "top_categories": top_categories[:3],
        "anomaly_count": anomaly_count,
    }
    key = _cache_key(payload)
    cache = _load_cache()
    cached = cache.get(key)
    if isinstance(cached, dict):
        summary = _normalize_text(cached.get("summary"))
        score_message_override = _normalize_text(cached.get("score_message"))
        cached_recommendations = _sanitize_recommendations(
            cached.get("recommendations"),
            recommendations,
        )
        if summary:
            return {
                "narrative": {
                    "summary": summary[:500],
                    "source": cached.get("source") or "llm",
                },
                "score_message": score_message_override or score_message,
                "recommendations": cached_recommendations,
            }

    prompt = f"""
You are writing language for a budgeting advisor in a transaction-analysis web app.

Use only the facts provided below. Do not invent transactions, merchants, dates, percentages, risks, or claims.
Keep the tone practical, confident, and supportive. Avoid regulated-advice wording.

Return valid JSON with exactly these keys:
- "summary": 2 concise sentences, under 85 words total
- "score_message": 1 or 2 concise sentences, under 28 words total
- "recommendations": an array of 2 to 4 short action sentences

Rules:
- Keep all numbers and merchant names aligned with the provided facts.
- Recommendations must stay grounded in the existing evidence. Rephrase and prioritize them, but do not introduce new actions unsupported by the facts.
- Do not mention the model, JSON, prompts, or uncertainty unless the facts clearly require it.

Facts:
{json.dumps(payload, ensure_ascii=True)}
"""

    raw_response = _call_groq(prompt)
    if not raw_response:
        return fallback

    parsed = _extract_json_object(raw_response)
    if not parsed:
        return fallback

    summary = _normalize_text(parsed.get("summary"))
    score_message_override = _normalize_text(parsed.get("score_message"))
    recommendation_overrides = _sanitize_recommendations(
        parsed.get("recommendations"),
        recommendations,
    )

    if not summary:
        return fallback

    language_pack = {
        "narrative": {
            "summary": summary[:500],
            "source": "llm",
        },
        "score_message": (score_message_override or score_message)[:220],
        "recommendations": recommendation_overrides,
    }

    cache[key] = {
        "summary": language_pack["narrative"]["summary"],
        "source": "llm",
        "score_message": language_pack["score_message"],
        "recommendations": language_pack["recommendations"],
    }
    _save_cache(cache)
    return language_pack

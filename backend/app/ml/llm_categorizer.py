import os
import requests
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
ENABLE_LLM_CATEGORIZER = os.getenv("ENABLE_LLM_CATEGORIZER", "true").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}

CATEGORIES = [
    "Groceries",
    "Dining",
    "Transport",
    "Entertainment",
    "Travel",
    "Shopping",
    "Utilities",
    "Housing",
    "Healthcare",
    "Personal Care",
    "Fitness",
    "Cash Withdrawal",
    "Bank Fees",
    "Transfer",
    "Income",
    "Other",
]


def llm_categorize(description: str):
    if not ENABLE_LLM_CATEGORIZER:
        return None

    if not GROQ_API_KEY:
        print("LLM ERROR: GROQ_API_KEY not found")
        return None

    prompt = f"""
You are a financial transaction classifier.

Classify this bank transaction into EXACTLY ONE category from this list:

{", ".join(CATEGORIES)}

Transaction description: "{description}"

Rules:
- Choose the closest matching category
- Do not explain
- Do not add punctuation
- Return only the category name exactly as written

Examples:
KFC -> Dining
TESCO STORES -> Groceries
UBER TRIP -> Transport
HOLIDAY BOOKING -> Travel
SAMS BARBER SHOP -> Personal Care
MAHMOUD SHISHA -> Dining
"""

    try:
        response = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "openai/gpt-oss-20b",
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0
            },
            timeout=10
        )

        response.raise_for_status()
        data = response.json()

        raw_output = data["choices"][0]["message"]["content"].strip().upper()

        print("LLM INPUT:", description)
        print("LLM OUTPUT:", raw_output)

        for category in CATEGORIES:
            if category.upper() in raw_output:
                return category

        return None

    except Exception as e:
        print("LLM ERROR:", e)
        return None

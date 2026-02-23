import re
from typing import Dict, List, Optional
from PIL import Image, ImageOps
import pytesseract


DATE_PATTERNS = [
    r"\b(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})\b",     # 03/12/2025, 03-12-25
    r"\b(\d{4}[\/\-]\d{2}[\/\-]\d{2})\b",       # 2025-12-03
]

TOTAL_PATTERNS = [
    r"\bTOTAL\b\s*[:\-]?\s*£?\s*(\d+\.\d{2})",
    r"\bAMOUNT\s+DUE\b\s*[:\-]?\s*£?\s*(\d+\.\d{2})",
    r"\bBALANCE\s+DUE\b\s*[:\-]?\s*£?\s*(\d+\.\d{2})",
]

PRICE_LINE = re.compile(r"(.*?)(£?\s*\d+\.\d{2})\s*$")
MONEY = re.compile(r"£?\s*(\d+\.\d{2})")



def _preprocess_basic(img: Image.Image) -> Image.Image:
    img = img.convert("L")
    img = ImageOps.autocontrast(img)
    return img


def _preprocess_threshold(img: Image.Image) -> Image.Image:
    img = img.convert("L")
    img = ImageOps.autocontrast(img)
    threshold = 140
    img = img.point(lambda x: 255 if x > threshold else 0)
    return img


def ocr_image_to_text(image: Image.Image) -> str:
    img_basic = _preprocess_basic(image)
    text_basic = pytesseract.image_to_string(img_basic)

    img_thresh = _preprocess_threshold(image)
    text_thresh = pytesseract.image_to_string(img_thresh)

    basic_prices = len(re.findall(r"\d+\.\d{2}", text_basic))
    thresh_prices = len(re.findall(r"\d+\.\d{2}", text_thresh))

    return text_thresh if thresh_prices > basic_prices else text_basic


def extract_merchant(lines: List[str]) -> Optional[str]:
    for ln in lines:
        clean = ln.strip()
        if len(clean) >= 3 and not MONEY.search(clean):
            return clean.title()
    return None


def extract_date(text: str) -> Optional[str]:
    for pat in DATE_PATTERNS:
        m = re.search(pat, text)
        if m:
            return m.group(1)
    return None


def extract_total(text: str) -> Optional[float]:
    lines = text.upper().splitlines()

    for line in lines:
        if "TOTAL" in line:
            # Try normal decimal format first
            match = re.search(r"(\d+\.\d{2})", line)
            if match:
                return float(match.group(1))

            # Try space-separated decimal like 28 34
            match_space = re.search(r"(\d+)\s+(\d{2})", line)
            if match_space:
                whole = match_space.group(1)
                decimal = match_space.group(2)
                return float(f"{whole}.{decimal}")

    return None


def extract_items(lines: List[str]) -> List[Dict]:
    items = []

    SKIP_KEYWORDS = [
        "SUBTOTAL",
        "AMOUNT DUE",
        "BALANCE DUE",
        "CHANGE",
        "CASH",
        "CARD",
        "VISA",
        "MASTERCARD",
        "CLUBCARD",
        "POINTS",
        "VAT",
        "STORE",
        "VISIT",
        "DOWNLOAD",
    ]

    for ln in lines:
        s = ln.strip()
        if not s:
            continue

        up = s.upper()

        # Skip headers/footers/payment lines
        if any(k in up for k in SKIP_KEYWORDS):
            continue

        # Don't treat TOTAL as item
        if "TOTAL" in up:
            continue

        m = PRICE_LINE.match(s)
        if not m:
            continue

        name_part = m.group(1).strip(" -:\t")
        price_part = m.group(2)

        m2 = MONEY.search(price_part)
        if not m2:
            continue

        try:
            line_total = float(m2.group(1))
        except:
            continue

        qty = 1.0
        unit_price = None

        qty_m = re.search(r"\b(\d+(?:\.\d+)?)\s*[xX]\s*(\d+\.\d{2})\b", s)
        if qty_m:
            qty = float(qty_m.group(1))
            unit_price = float(qty_m.group(2))

        if len(name_part) < 2:
            continue

        items.append({
            "name": name_part.title(),
            "qty": qty,
            "unit_price": unit_price,
            "line_total": line_total
        })

    return items


def extract_receipt(image: Image.Image) -> Dict:
    raw = ocr_image_to_text(image)
    lines = [l.strip() for l in raw.splitlines() if l.strip()]

    merchant = extract_merchant(lines)
    receipt_date = extract_date(raw)
    total = extract_total(raw)
    items = extract_items(lines)

    # NEW: Calculate total from items
    calculated_total = round(sum(item["line_total"] for item in items), 2) if items else 0.0

    difference = None
    verified = None

    if total is not None:
        difference = round(total - calculated_total, 2)
        verified = abs(difference) < 0.01

    return {
        "merchant": merchant,
        "receipt_date": receipt_date,
        "total": total,
        "calculated_total": calculated_total,
        "difference": difference,
        "verified": verified,
        "items": items,
        "raw_text": raw
    }
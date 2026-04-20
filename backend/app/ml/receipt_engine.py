import re
from collections import OrderedDict
from typing import Dict, List, Optional

from PIL import Image, ImageOps
import pytesseract
from pytesseract import TesseractNotFoundError


DATE_PATTERNS = [
    r"\b(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})\b",
    r"\b(\d{4}[\/\-]\d{2}[\/\-]\d{2})\b",
]

MONEY_PATTERN = re.compile(r"[£Ł]?\s*(\d+\.\d{2})")
QTY_PREFIX_PATTERN = re.compile(
    r"^(?P<qty>\d+(?:\.\d+)?)\s*[xX]\s*(?P<name>.+?)\s+[£Ł]?\s*(?P<price>\d+\.\d{2})$"
)
QTY_INLINE_PATTERN = re.compile(
    r"^(?P<name>.+?)\s+(?P<qty>\d+(?:\.\d+)?)\s*[xX]\s*[£Ł]?\s*(?P<price>\d+\.\d{2})(?:\s+[£Ł]?\s*(?P<total>\d+\.\d{2}))?$"
)
PRICE_LINE_PATTERN = re.compile(r"^(?P<name>.+?)\s+[£Ł]?\s*(?P<price>\d+\.\d{2})$")

ITEM_BREAK_KEYWORDS = [
    "TOTAL",
    "SUBTOTAL",
    "AMOUNT DUE",
    "BALANCE DUE",
    "CHANGE",
    "CASH",
    "CARD",
]

ITEM_SKIP_KEYWORDS = [
    "VAT",
    "STORE",
    "VISIT",
    "DOWNLOAD",
    "CLUBCARD",
    "POINTS",
    "LOCATOR",
]


def _normalize_ocr_text(text: str) -> str:
    replacements = {
        "Â£": "£",
        "Ã‚Â£": "£",
        "Ł": "£",
        "â€˜": "'",
        "â€™": "'",
        "‘": "'",
        "’": "'",
        "—": "-",
        "–": "-",
        "•": " ",
    }

    for source, target in replacements.items():
        text = text.replace(source, target)

    return text


def _clean_item_name(name: str) -> str:
    name = _normalize_ocr_text(name).upper()
    name = re.sub(r"\s+", " ", name).strip()
    name = re.sub(r"\s+[=*xX]+$", "", name).strip()
    name = re.sub(r"^[^A-Z0-9]+|[^A-Z0-9]+$", "", name).strip()
    return name.title()


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
    try:
        text_basic = pytesseract.image_to_string(img_basic, config="--psm 6")
    except TesseractNotFoundError as exc:
        raise RuntimeError("Receipt OCR is not available on this server.") from exc

    img_thresh = _preprocess_threshold(image)
    try:
        text_thresh = pytesseract.image_to_string(img_thresh, config="--psm 6")
    except TesseractNotFoundError as exc:
        raise RuntimeError("Receipt OCR is not available on this server.") from exc

    basic_prices = len(re.findall(r"\d+\.\d{2}", text_basic))
    thresh_prices = len(re.findall(r"\d+\.\d{2}", text_thresh))

    return _normalize_ocr_text(text_thresh if thresh_prices > basic_prices else text_basic)


def extract_merchant(lines: List[str]) -> Optional[str]:
    for line in lines:
        clean = line.strip()
        if not clean or MONEY_PATTERN.search(clean):
            continue

        upper = clean.upper()
        if any(keyword in upper for keyword in ITEM_SKIP_KEYWORDS):
            continue
        if len(clean) < 3:
            continue

        return clean.title()

    return None


def extract_date(text: str) -> Optional[str]:
    for pattern in DATE_PATTERNS:
        match = re.search(pattern, text)
        if match:
            return match.group(1)
    return None


def extract_total(text: str) -> Optional[float]:
    total_candidate = None
    cash_candidate = None
    cash_candidate_trimmed = None
    change_candidate = None

    for line in _normalize_ocr_text(text).upper().splitlines():
        stripped = line.strip()
        matches = MONEY_PATTERN.findall(stripped)
        if not matches:
            continue

        amount = float(matches[-1])
        if "TOTAL" in stripped:
            total_candidate = amount
        elif "CASH" in stripped:
            cash_candidate = amount
            raw_amount = matches[-1]
            if len(raw_amount.split(".")[0]) >= 3:
                trimmed_amount = raw_amount[1:]
                try:
                    cash_candidate_trimmed = float(trimmed_amount)
                except ValueError:
                    cash_candidate_trimmed = None
        elif "CHANGE" in stripped:
            change_candidate = amount

    derived_total = None
    if cash_candidate is not None and change_candidate is not None:
        derived_total = round(cash_candidate - change_candidate, 2)
    trimmed_derived_total = None
    if cash_candidate_trimmed is not None and change_candidate is not None:
        trimmed_derived_total = round(cash_candidate_trimmed - change_candidate, 2)

    if total_candidate is None:
        if trimmed_derived_total is not None and trimmed_derived_total > 0:
            return trimmed_derived_total
        return derived_total

    if (
        trimmed_derived_total is not None
        and trimmed_derived_total > 0
        and abs(total_candidate - trimmed_derived_total) > 10.0
    ):
        return trimmed_derived_total

    if (
        derived_total is not None
        and derived_total > 0
        and abs(total_candidate - derived_total) > 1.0
    ):
        return derived_total

    return total_candidate


def _build_line_item(name: str, qty: float, unit_price: Optional[float], line_total: float):
    cleaned_name = _clean_item_name(name)
    if len(cleaned_name) < 2:
        return None

    return {
        "name": cleaned_name,
        "qty": qty,
        "unit_price": unit_price if unit_price is not None else line_total,
        "line_total": line_total,
    }


def _append_item(bucket: OrderedDict[str, Dict], item: Dict):
    existing = bucket.get(item["name"])
    if existing:
        existing["qty"] += item["qty"]
        existing["line_total"] += item["line_total"]
        if item["unit_price"] is not None:
            existing["unit_price"] = item["unit_price"]
    else:
        bucket[item["name"]] = dict(item)


def extract_items(lines: List[str], total: Optional[float] = None) -> List[Dict]:
    line_items: List[Dict] = []
    saw_priced_item = False

    for raw_line in lines:
        line = _normalize_ocr_text(raw_line).strip()
        if not line:
            continue

        upper = line.upper()
        if any(keyword in upper for keyword in ITEM_BREAK_KEYWORDS):
            if "TOTAL" in upper:
                break
            continue

        if any(keyword in upper for keyword in ITEM_SKIP_KEYWORDS):
            continue

        if not MONEY_PATTERN.search(line):
            continue

        saw_priced_item = True

        qty_prefix_match = QTY_PREFIX_PATTERN.match(line)
        if qty_prefix_match:
            qty = float(qty_prefix_match.group("qty"))
            unit_price = float(qty_prefix_match.group("price"))
            item = _build_line_item(
                qty_prefix_match.group("name"), qty, unit_price, round(qty * unit_price, 2)
            )
            if item:
                line_items.append(item)
            continue

        qty_inline_match = QTY_INLINE_PATTERN.match(line)
        if qty_inline_match:
            qty = float(qty_inline_match.group("qty"))
            unit_price = float(qty_inline_match.group("price"))
            total_text = qty_inline_match.group("total")
            line_total = float(total_text) if total_text else round(qty * unit_price, 2)
            item = _build_line_item(qty_inline_match.group("name"), qty, unit_price, line_total)
            if item:
                line_items.append(item)
            continue

        price_match = PRICE_LINE_PATTERN.match(line)
        if not price_match:
            continue

        line_total = float(price_match.group("price"))
        item = _build_line_item(price_match.group("name"), 1.0, line_total, line_total)
        if item:
            line_items.append(item)

    aggregated: OrderedDict[str, Dict] = OrderedDict()
    for item in line_items:
        _append_item(aggregated, item)

    items = list(aggregated.values())
    for item in items:
        if item["qty"] > 0:
            item["unit_price"] = round(float(item["line_total"]) / float(item["qty"]), 2)
        item["line_total"] = round(float(item["line_total"]), 2)
        item["qty"] = int(item["qty"]) if float(item["qty"]).is_integer() else round(float(item["qty"]), 2)

    if not items and saw_priced_item:
        return []

    return items


def extract_receipt(image: Image.Image) -> Dict:
    raw = ocr_image_to_text(image)
    lines = [line.strip() for line in raw.splitlines() if line.strip()]

    merchant = extract_merchant(lines)
    receipt_date = extract_date(raw)
    total = extract_total(raw)
    items = extract_items(lines, total)

    calculated_total = (
        round(sum(float(item["line_total"]) for item in items), 2) if items else 0.0
    )

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
        "raw_text": raw,
    }

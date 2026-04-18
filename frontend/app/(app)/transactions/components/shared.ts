export type Transaction = {
  id?: number;
  date: string;
  description: string;
  amount: number;
  balance?: number;
  category?: string | null;
  transaction_type?: string;
  balance_after?: number;
  is_anomaly?: boolean;
  anomaly_score?: number | null;
  anomaly_reasons?: string[];
};

export type ImportSummary = {
  imported: number;
  categorized: number;
  needsReview: number;
  rowsReceived?: number;
  duplicatesSkipped?: number;
  openingBalanceUsed?: number;
  closingBalance?: number;
  fileName?: string;
  importId?: number;
  importStatus?: string;
};

export type CsvParseResult = {
  rows: Transaction[];
  totalRows: number;
  skippedRows: number;
};

export type ConfidenceTone = "high" | "medium" | "low";

export type AiInsight = {
  category: string;
  confidence: number;
  tone: ConfidenceTone;
  needsReview: boolean;
  reasons: string[];
};

export type DecoratedTransaction = Transaction & {
  ai: AiInsight;
};

export const CATEGORY_OPTIONS = [
  "Income",
  "Housing",
  "Utilities",
  "Groceries",
  "Shopping",
  "Dining",
  "Transport",
  "Entertainment",
  "Travel",
  "Healthcare",
  "Personal Care",
  "Fitness",
  "Transfer",
  "Bank Fees",
  "Cash Withdrawal",
  "Other",
];

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Income: [
    "salary",
    "payroll",
    "interest",
    "refund",
    "bonus",
    "payment from",
    "hmrc",
    "pension",
    "dividend",
    "benefit",
    "universal credit",
    "child benefit",
  ],
  Housing: [
    "rent",
    "mortgage",
    "landlord",
    "lettings",
    "homes",
    "foxtons",
    "rightmove",
    "zoopla",
    "service charge",
    "ground rent",
  ],
  Utilities: [
    "octopus",
    "british gas",
    "eon",
    "edf",
    "scottish power",
    "ovo",
    "thames water",
    "severn trent",
    "yorkshire water",
    "anglian water",
    "energy",
    "water",
    "gas",
    "electric",
    "vodafone",
    "three",
    "giffgaff",
    "lebara",
    "ee",
    "o2",
    "virgin media",
    "bt",
    "sky",
    "talktalk",
    "council tax",
    "broadband",
  ],
  Groceries: [
    "tesco",
    "tesco extra",
    "tesco express",
    "aldi",
    "asda",
    "sainsbury",
    "sainsburys",
    "sainsbury's",
    "lidl",
    "waitrose",
    "ocado",
    "morrisons",
    "co op",
    "coop",
    "iceland",
    "farmfoods",
    "marks and spencer food",
    "m&s food",
  ],
  Shopping: [
    "amazon",
    "amazon marketplace",
    "ebay",
    "etsy",
    "vinted",
    "zara",
    "asos",
    "shein",
    "primark",
    "h&m",
    "hm",
    "new look",
    "uniqlo",
    "argos",
    "currys",
    "john lewis",
    "next",
    "ikea",
    "b&q",
    "wilko",
    "tk maxx",
  ],
  Dining: [
    "nandos",
    "uber eats",
    "deliveroo",
    "just eat",
    "mcdonald",
    "kfc",
    "burger king",
    "subway",
    "dominos",
    "pizza hut",
    "greggs",
    "pret",
    "pret a manger",
    "caffe nero",
    "cafe nero",
    "starbucks",
    "costa",
    "restaurant",
    "takeaway",
    "dining out",
    "pub",
    "wetherspoon",
    "five guys",
    "itsu",
    "wagamama",
  ],
  Transport: [
    "uber",
    "bolt",
    "trainline",
    "national rail",
    "rail",
    "railway",
    "tfl",
    "bus",
    "underground",
    "thameslink",
    "northern rail",
    "avanti",
    "southern",
    "parking",
    "ringgo",
    "justpark",
    "shell",
    "bp",
    "esso",
    "texaco",
    "petrol",
    "fuel",
  ],
  Entertainment: [
    "spotify",
    "netflix",
    "disney",
    "youtube",
    "prime video",
    "amazon prime",
    "apple tv",
    "sky cinema",
    "now tv",
    "cineworld",
    "odeon",
    "steam",
    "playstation",
    "xbox",
  ],
  Travel: [
    "holiday",
    "booking",
    "booking.com",
    "airbnb",
    "expedia",
    "easyjet",
    "ryanair",
    "jet2",
    "ba",
    "british airways",
    "hotel",
    "travelodge",
    "premier inn",
    "hostelworld",
  ],
  Healthcare: [
    "nhs",
    "pharmacy",
    "boots",
    "superdrug",
    "lloyds pharmacy",
    "specsavers",
    "dental",
    "dentist",
    "clinic",
    "hospital",
    "optician",
  ],
  "Personal Care": [
    "barber",
    "hair salon",
    "beauty",
    "nail",
    "spa",
    "sephora",
    "skincare",
    "makeup",
    "supercuts",
    "toni and guy",
  ],
  Fitness: ["gym", "puregym", "jd gym", "the gym group", "fitness", "yoga", "pilates", "david lloyd"],
  Transfer: ["transfer", "faster payment", "standing order", "bank transfer", "to savings", "from savings"],
  "Bank Fees": ["fee", "charge", "overdraft", "interest charged", "late payment fee", "monthly fee"],
  "Cash Withdrawal": ["atm", "cash withdrawal", "cash machine", "cash wd", "withdrawal"],
};

const CATEGORY_CONTEXT_PATTERNS: Record<string, string[]> = {
  Groceries: ["supermarket", "food hall", "grocery"],
  Dining: ["dining out", "eat out", "food order", "coffee shop", "restaurant bill", "meal"],
  Transport: ["train ticket", "bus ticket", "travel charge", "fuel station", "tube fare"],
  Utilities: ["utility bill", "energy bill", "electric bill", "gas bill", "water bill", "phone bill"],
  Shopping: ["online order", "retail purchase", "clothing store", "homeware"],
  Healthcare: ["medical", "prescription", "dental care"],
  Housing: ["rent payment", "mortgage payment", "housing payment"],
};

const GENERIC_REVIEW_PATTERNS = [
  "card payment",
  "contactless",
  "debit card",
  "visa purchase",
  "purchase",
  "payment",
  "pos",
  "transaction",
];

function normalize(header: string) {
  return header.toLowerCase().replace(/\s+/g, "").replace(/[^a-z]/g, "");
}

function detectSchema(headers: string[]) {
  const find = (possibilities: string[]) =>
    headers.find((header) => possibilities.includes(normalize(header))) || null;

  return {
    dateKey: find([
      "date",
      "transactiondate",
      "bookingdate",
      "posteddate",
      "valuedate",
      "transactiondateandtime",
    ]),
    descriptionKey: find([
      "description",
      "details",
      "narrative",
      "merchant",
      "reference",
      "payee",
      "transactiondescription",
      "transactiondetails",
      "memo",
      "particulars",
    ]),
    amountKey: find(["amount", "value", "transactionamount", "debitamount", "creditamount"]),
    balanceKey: find(["balance", "runningbalance", "closingbalance", "accountbalance"]),
    debitKey: find(["debit", "withdrawal", "debitamount"]),
    creditKey: find(["credit", "deposit", "creditamount"]),
    moneyInKey: find(["moneyin", "paidin"]),
    moneyOutKey: find(["moneyout", "paidout"]),
  };
}

function cleanNumber(value: unknown) {
  return Number(String(value ?? "").replace(/[^\d.-]/g, "").replace(/\s+/g, ""));
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function toIsoDate(year: number, month: number, day: number) {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
}

export function parseCsvDateValue(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }

  const isoMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    return toIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const dayFirstMatch = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (dayFirstMatch) {
    const yearPart = Number(dayFirstMatch[3]);
    const year = yearPart < 100 ? 2000 + yearPart : yearPart;
    return toIsoDate(year, Number(dayFirstMatch[2]), Number(dayFirstMatch[1]));
  }

  const monthLookup: Record<string, number> = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  };

  const namedMonthMatch = raw.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})$/);
  if (namedMonthMatch) {
    const day = Number(namedMonthMatch[1]);
    const month = monthLookup[namedMonthMatch[2].toLowerCase()];
    const yearPart = Number(namedMonthMatch[3]);
    const year = yearPart < 100 ? 2000 + yearPart : yearPart;

    if (month) {
      return toIsoDate(year, month, day);
    }
  }

  return null;
}

function resolveAmount(row: Record<string, unknown>, schema: ReturnType<typeof detectSchema>) {
  if (schema.amountKey) {
    const value = cleanNumber(row[schema.amountKey]);
    if (!Number.isNaN(value)) {
      return value;
    }
  }

  if (schema.creditKey || schema.debitKey) {
    const credit = schema.creditKey ? cleanNumber(row[schema.creditKey]) : Number.NaN;
    const debit = schema.debitKey ? cleanNumber(row[schema.debitKey]) : Number.NaN;

    if (!Number.isNaN(credit) && credit > 0) {
      return credit;
    }
    if (!Number.isNaN(debit) && debit > 0) {
      return -debit;
    }
  }

  if (schema.moneyInKey || schema.moneyOutKey) {
    const moneyIn = schema.moneyInKey ? cleanNumber(row[schema.moneyInKey]) : Number.NaN;
    const moneyOut = schema.moneyOutKey ? cleanNumber(row[schema.moneyOutKey]) : Number.NaN;

    if (!Number.isNaN(moneyIn) && moneyIn > 0) {
      return moneyIn;
    }
    if (!Number.isNaN(moneyOut) && moneyOut > 0) {
      return -moneyOut;
    }
  }

  return null;
}

export function parseTransactionsCsv(data: Record<string, unknown>[]) {
  if (!data.length) {
    throw new Error("This CSV appears to be empty or contains no readable transaction rows.");
  }

  const headers = Object.keys(data[0]);
  const schema = detectSchema(headers);

  const hasAmountSource = Boolean(
    schema.amountKey ||
    schema.creditKey ||
    schema.debitKey ||
    schema.moneyInKey ||
    schema.moneyOutKey,
  );

  if (!schema.dateKey || !schema.descriptionKey || !hasAmountSource) {
    throw new Error(
      "This CSV format is not supported. SmartSpend could not detect the required columns: date, description, and amount.",
    );
  }

  const parsed: Transaction[] = [];
  let skippedRows = 0;
  const dateKey = schema.dateKey;
  const descriptionKey = schema.descriptionKey;

  data.forEach((row) => {
    const amount = resolveAmount(row, schema);
    const balance = schema.balanceKey ? cleanNumber(row[schema.balanceKey]) : Number.NaN;
    const parsedDate = parseCsvDateValue(row[dateKey]);

    if (
      !parsedDate ||
      !row[descriptionKey] ||
      amount === null ||
      Number.isNaN(amount)
    ) {
      skippedRows += 1;
      return;
    }

    parsed.push({
      date: parsedDate,
      description: String(row[descriptionKey]).trim(),
      amount,
      balance: !Number.isNaN(balance) ? balance : undefined,
    });
  });

  if (!parsed.length) {
    throw new Error(
      "This CSV was read, but no valid transaction rows were found. Check that it includes usable date, description, and amount values.",
    );
  }

  return {
    rows: parsed,
    totalRows: data.length,
    skippedRows,
  } satisfies CsvParseResult;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

export function formatDate(value: string) {
  const isoValue = parseCsvDateValue(value);
  if (!isoValue) {
    return value;
  }

  const [year, month, day] = isoValue.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function displayCategory(category?: string | null) {
  if (!category || category === "Uncategorised") {
    return "Other";
  }
  return category;
}

function findMatchedKeyword(description: string, category: string) {
  const normalized = description.toLowerCase();
  const keyword = (CATEGORY_KEYWORDS[category] || []).find((item) =>
    normalized.includes(item),
  );
  return keyword || null;
}

function findMatchedContextPattern(description: string, category: string) {
  const normalized = description.toLowerCase();
  const pattern = (CATEGORY_CONTEXT_PATTERNS[category] || []).find((item) =>
    normalized.includes(item),
  );
  return pattern || null;
}

function isGenericDescription(description: string) {
  const normalized = description.toLowerCase().trim();
  if (!normalized) {
    return true;
  }

  if (GENERIC_REVIEW_PATTERNS.some((pattern) => normalized === pattern)) {
    return true;
  }

  return normalized.split(/\s+/).length <= 2 && GENERIC_REVIEW_PATTERNS.some((pattern) =>
    normalized.includes(pattern),
  );
}

export function getAiInsight(transaction: Transaction): AiInsight {
  const category = displayCategory(transaction.category);
  const description = String(transaction.description || "");
  const normalized = description.toLowerCase();
  const matchedKeyword = findMatchedKeyword(description, category);
  const matchedContextPattern = findMatchedContextPattern(description, category);

  if (category === "Other") {
    return {
      category,
      confidence: 58,
      tone: "low",
      needsReview: true,
      reasons: [
        "No strong merchant pattern matched this description.",
        "AI could not place it confidently into a specific fintech category.",
      ],
    };
  }

  if (category === "Income" && transaction.amount > 0) {
    return {
      category,
      confidence: 98,
      tone: "high",
      needsReview: false,
      reasons: [
        "Positive transaction amount strongly matches an income pattern.",
        "Merchant wording is consistent with salary, interest, or refund activity.",
      ],
    };
  }

  if (matchedKeyword) {
    return {
      category,
      confidence: 95,
      tone: "high",
      needsReview: false,
      reasons: [
        `Merchant pattern matched "${matchedKeyword}".`,
        `Description is highly consistent with the ${category} category.`,
      ],
    };
  }

  if (matchedContextPattern) {
    return {
      category,
      confidence: 86,
      tone: "high",
      needsReview: false,
      reasons: [
        `Description matched the ${category} pattern "${matchedContextPattern}".`,
        "The transaction wording is clear enough to classify confidently without a specific merchant hit.",
      ],
    };
  }

  if (normalized.includes("transfer") && category === "Transfer") {
    return {
      category,
      confidence: 89,
      tone: "medium",
      needsReview: false,
      reasons: [
        "Transaction text includes transfer-related wording.",
        "Historical banking data often maps this pattern to internal transfers.",
      ],
    };
  }

  return {
    category,
    confidence: isGenericDescription(normalized) ? 62 : 76,
    tone: "medium",
    needsReview: isGenericDescription(normalized),
    reasons: [
      `AI matched the description to the ${category} category.`,
      isGenericDescription(normalized)
        ? "The category is plausible, but the transaction text is generic and may need manual review."
        : "Confidence is moderate because the merchant pattern is less explicit.",
    ],
  };
}

export function getConfidenceClasses(tone: ConfidenceTone) {
  if (tone === "high") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  }
  if (tone === "medium") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }
  return "border-rose-500/30 bg-rose-500/10 text-rose-300";
}

export function getConfidenceLevel(
  confidence: number,
): { label: string; tone: ConfidenceTone } {
  if (confidence >= 80) {
    return { label: "High", tone: "high" };
  }

  if (confidence >= 50) {
    return { label: "Medium", tone: "medium" };
  }

  return { label: "Low", tone: "low" };
}

export function getAnomalyClasses(isAnomaly?: boolean) {
  if (!isAnomaly) {
    return "border-slate-500/30 bg-slate-500/10 text-slate-300";
  }

  return "border-rose-500/30 bg-rose-500/10 text-rose-300";
}

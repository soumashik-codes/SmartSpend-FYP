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
  Income: ["salary", "payroll", "interest", "refund", "bonus", "payment from"],
  Housing: ["rent", "mortgage", "landlord", "lettings", "homes"],
  Utilities: ["octopus", "energy", "water", "gas", "electric", "vodafone", "ee", "o2"],
  Groceries: ["tesco", "aldi", "asda", "sainsbury", "lidl", "waitrose", "ocado"],
  Shopping: ["amazon", "ebay", "zara", "asos", "primark", "argos", "currys"],
  Dining: ["nandos", "uber eats", "deliveroo", "just eat", "mcdonald", "starbucks", "costa", "restaurant"],
  Transport: ["uber", "bolt", "train", "rail", "tfl", "shell", "petrol", "esso"],
  Entertainment: ["spotify", "netflix", "disney", "youtube", "prime", "steam"],
  Travel: ["holiday", "booking", "airbnb", "expedia", "easyjet", "ryanair", "hotel"],
  Healthcare: ["nhs", "pharmacy", "boots", "superdrug", "dental", "clinic"],
  "Personal Care": ["barber", "hair salon", "beauty", "nail", "spa", "sephora", "skincare", "makeup"],
  Fitness: ["gym", "puregym", "jd gym", "fitness", "yoga"],
  Transfer: ["transfer", "faster payment", "standing order", "bank transfer"],
  "Bank Fees": ["fee", "charge", "overdraft", "interest charged"],
  "Cash Withdrawal": ["atm", "cash withdrawal", "cash machine"],
};

function normalize(header: string) {
  return header.toLowerCase().replace(/\s+/g, "").replace(/[^a-z]/g, "");
}

function detectSchema(headers: string[]) {
  const find = (possibilities: string[]) =>
    headers.find((header) => possibilities.includes(normalize(header))) || null;

  return {
    dateKey: find(["date", "transactiondate", "bookingdate", "posteddate", "valuedate"]),
    descriptionKey: find([
      "description",
      "details",
      "narrative",
      "merchant",
      "reference",
      "payee",
    ]),
    amountKey: find(["amount", "value", "transactionamount"]),
    balanceKey: find(["balance", "runningbalance", "closingbalance", "accountbalance"]),
    debitKey: find(["debit"]),
    creditKey: find(["credit"]),
    moneyInKey: find(["moneyin", "paidin"]),
    moneyOutKey: find(["moneyout", "paidout"]),
  };
}

function cleanNumber(value: unknown) {
  return Number(String(value ?? "").replace(/[^\d.-]/g, "").replace(/\s+/g, ""));
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
    return [];
  }

  const headers = Object.keys(data[0]);
  const schema = detectSchema(headers);

  if (!schema.dateKey || !schema.descriptionKey) {
    throw new Error("Could not detect required columns.");
  }

  const parsed: Transaction[] = [];

  data.forEach((row) => {
    const amount = resolveAmount(row, schema);
    const balance = schema.balanceKey ? cleanNumber(row[schema.balanceKey]) : Number.NaN;

    if (
      !row[schema.dateKey] ||
      !row[schema.descriptionKey] ||
      amount === null ||
      Number.isNaN(amount)
    ) {
      return;
    }

    parsed.push({
      date: String(row[schema.dateKey]).trim(),
      description: String(row[schema.descriptionKey]).trim(),
      amount,
      balance: !Number.isNaN(balance) ? balance : undefined,
    });
  });

  return parsed;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(value);
}

export function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

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

export function getAiInsight(transaction: Transaction): AiInsight {
  const category = displayCategory(transaction.category);
  const description = String(transaction.description || "");
  const normalized = description.toLowerCase();
  const matchedKeyword = findMatchedKeyword(description, category);

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
      confidence: 94,
      tone: "high",
      needsReview: false,
      reasons: [
        `Merchant pattern matched "${matchedKeyword}".`,
        `Description is highly consistent with the ${category} category.`,
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
    confidence: 76,
    tone: "medium",
    needsReview: false,
    reasons: [
      `AI matched the description to the ${category} category.`,
      "Confidence is moderate because the merchant pattern is less explicit.",
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

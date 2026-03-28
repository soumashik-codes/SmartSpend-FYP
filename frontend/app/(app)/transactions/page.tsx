"use client";

import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { getDefaultAccountId } from "@/lib/api";
import { ImportSummary } from "./components/ImportSummary";
import { TransactionReviewPanel } from "./components/TransactionReviewPanel";
import { TransactionsFilters } from "./components/TransactionsFilters";
import { TransactionsStats } from "./components/TransactionsStats";
import { TransactionsTable } from "./components/TransactionsTable";
import { UploadCard } from "./components/UploadCard";
import {
  displayCategory,
  getAiInsight,
  type DecoratedTransaction,
  type ImportSummary as ImportSummaryData,
  type Transaction,
} from "./components/shared";

export default function TransactionsPage() {
  const [previewRows, setPreviewRows] = useState<Transaction[]>([]);
  const [savedRows, setSavedRows] = useState<Transaction[]>([]);
  const [subscriptionMonthly, setSubscriptionMonthly] = useState(0);
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummaryData | null>(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedTransaction, setSelectedTransaction] = useState<DecoratedTransaction | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("Other");
  const [isUpdatingCategory, setIsUpdatingCategory] = useState(false);
  const tableRef = useRef<HTMLDivElement | null>(null);

  async function getRequestContext() {
    const token = localStorage.getItem("access_token");
    const accountId = await getDefaultAccountId();

    if (!accountId) {
      alert("No account selected.");
      return null;
    }

    return { token, accountId };
  }

  async function requestTransactions(context?: { token: string | null; accountId: number }) {
    const requestContext = context ?? (await getRequestContext());
    if (!requestContext) {
      return [];
    }

    const response = await fetch(
      `http://127.0.0.1:8000/transactions/?account_id=${requestContext.accountId}`,
      {
        headers: {
          Authorization: `Bearer ${requestContext.token}`,
        },
      },
    );

    return (await response.json()) as Transaction[];
  }

  async function requestSubscriptions(context?: { token: string | null; accountId: number }) {
    const requestContext = context ?? (await getRequestContext());
    if (!requestContext) {
      return 0;
    }

    const response = await fetch(
      `http://127.0.0.1:8000/transactions/subscriptions?account_id=${requestContext.accountId}`,
      {
        headers: {
          Authorization: `Bearer ${requestContext.token}`,
        },
      },
    );

    if (!response.ok) {
      return 0;
    }

    const data = (await response.json()) as { total_monthly?: number };
    return Number(data.total_monthly ?? 0);
  }

  const loadInitialTransactions = useEffectEvent(async () => {
    const context = await getRequestContext();
    if (!context) {
      return { transactions: [], subscriptionsTotal: 0 };
    }

    const [transactions, subscriptionsTotal] = await Promise.all([
      requestTransactions(context),
      requestSubscriptions(context),
    ]);

    return { transactions, subscriptionsTotal };
  });

  useEffect(() => {
    let isCancelled = false;

    async function loadTransactions() {
      const { transactions, subscriptionsTotal } = await loadInitialTransactions();

      if (!isCancelled) {
        startTransition(() => {
          setSavedRows(transactions);
          setSubscriptionMonthly(subscriptionsTotal);
        });
      }
    }

    void loadTransactions();

    return () => {
      isCancelled = true;
    };
  }, []);

  async function saveAndAnalyse() {
    setIsSaving(true);

    const context = await getRequestContext();
    if (!context) {
      setIsSaving(false);
      return;
    }

    const previousIds = new Set(savedRows.map((row) => row.id).filter(Boolean));

    const response = await fetch("http://127.0.0.1:8000/transactions/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${context.token}`,
      },
      body: JSON.stringify({
        account_id: context.accountId,
        transactions: previewRows,
      }),
    });

    const result = await response.json();
    const [refreshedRows, subscriptionsTotal] = await Promise.all([
      requestTransactions(context),
      requestSubscriptions(context),
    ]);
    setSavedRows(refreshedRows);
    setSubscriptionMonthly(subscriptionsTotal);
    const importedRows = refreshedRows.filter((row) => row.id && !previousIds.has(row.id));
    const importedDecorated = importedRows.map((row) => ({
      ...row,
      ai: getAiInsight(row),
    }));
    const needsReview = importedDecorated.filter((row) => row.ai.needsReview).length;

    setImportSummary({
      imported: result.imported ?? importedRows.length,
      categorized: Math.max((result.imported ?? importedRows.length) - needsReview, 0),
      needsReview,
    });

    setPreviewRows([]);
    setIsSaving(false);
  }

  const decoratedRows = useMemo(
    () =>
      savedRows.map((row) => ({
        ...row,
        ai: getAiInsight(row),
      })),
    [savedRows],
  );

  const availableCategoryFilters = useMemo(
    () => [
      "all",
      "needs_review",
      ...new Set(decoratedRows.map((row) => row.ai.category)),
    ],
    [decoratedRows],
  );

  const filteredRows = useMemo(() => {
    return decoratedRows.filter((row) => {
      const matchesSearch =
        row.description.toLowerCase().includes(search.toLowerCase()) ||
        row.ai.category.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) {
        return false;
      }

      if (activeFilter === "all") {
        return true;
      }

      if (activeFilter === "needs_review") {
        return row.ai.needsReview;
      }

      return row.ai.category === activeFilter;
    });
  }, [activeFilter, decoratedRows, search]);

  const totalSpent = useMemo(
    () =>
      filteredRows
        .filter((row) => row.amount < 0)
        .reduce((sum, row) => sum + Math.abs(row.amount), 0),
    [filteredRows],
  );

  const topCategory = useMemo(() => {
    const totals = new Map<string, number>();

    filteredRows.forEach((row) => {
      if (row.amount >= 0) {
        return;
      }
      totals.set(row.ai.category, (totals.get(row.ai.category) || 0) + Math.abs(row.amount));
    });

    const top = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : "None";
  }, [filteredRows]);

  async function updateCategory() {
    if (!selectedTransaction?.id) {
      return;
    }

    setIsUpdatingCategory(true);
    const token = localStorage.getItem("access_token");

    const response = await fetch(
      `http://127.0.0.1:8000/transactions/${selectedTransaction.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category: categoryDraft,
        }),
      },
    );

    if (!response.ok) {
      alert("Unable to update category.");
      setIsUpdatingCategory(false);
      return;
    }

    const updated = await response.json();
    setSavedRows((current) => current.map((row) => (row.id === updated.id ? updated : row)));

    const decorated = {
      ...updated,
      ai: getAiInsight(updated),
    };

    setSelectedTransaction(decorated);
    setCategoryDraft(displayCategory(updated.category));
    setIsUpdatingCategory(false);
  }

  function openReviewPanel(transaction: DecoratedTransaction) {
    setSelectedTransaction(transaction);
    setCategoryDraft(transaction.ai.category);
  }

  function reviewImportedTransactions() {
    setActiveFilter("needs_review");
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="p-8 text-white">
      <h1 className="text-3xl font-semibold">Transactions</h1>

      <UploadCard
        previewRows={previewRows}
        onPreviewReady={setPreviewRows}
        onSave={saveAndAnalyse}
        isSaving={isSaving}
      />

      {importSummary ? (
        <ImportSummary
          summary={importSummary}
          onReviewTransactions={reviewImportedTransactions}
        />
      ) : null}

      {savedRows.length > 0 ? (
        <div ref={tableRef} className="mt-10 space-y-6">
          <TransactionsStats
            totalSpent={totalSpent}
            topCategory={topCategory}
            subscriptionMonthly={subscriptionMonthly}
          />

          <div className="rounded-xl border border-[#1f2c4d] bg-[#0f1b33] p-6">
            <TransactionsFilters
              search={search}
              onSearchChange={setSearch}
              filters={availableCategoryFilters}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
            />
            <TransactionsTable rows={filteredRows} onSelectTransaction={openReviewPanel} />
          </div>
        </div>
      ) : null}

      <TransactionReviewPanel
        transaction={selectedTransaction}
        categoryDraft={categoryDraft}
        onCategoryDraftChange={setCategoryDraft}
        onClose={() => setSelectedTransaction(null)}
        onSave={updateCategory}
        isUpdatingCategory={isUpdatingCategory}
      />
    </div>
  );
}

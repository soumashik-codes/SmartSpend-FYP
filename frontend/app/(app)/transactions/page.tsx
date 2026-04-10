"use client";

import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildApiUrl,
  getAccessToken,
  getDefaultAccountId,
  setStoredAccountId,
} from "@/lib/api";
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
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummaryData | null>(null);
  const [activeFilter, setActiveFilter] = useState("all");
  const [selectedTransaction, setSelectedTransaction] = useState<DecoratedTransaction | null>(null);
  const [categoryDraft, setCategoryDraft] = useState("Other");
  const [applyToFutureMerchant, setApplyToFutureMerchant] = useState(false);
  const [applyToAllMerchant, setApplyToAllMerchant] = useState(false);
  const [isUpdatingCategory, setIsUpdatingCategory] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState("");
  const [pageError, setPageError] = useState("");
  const [uploadInfo, setUploadInfo] = useState("");
  const [uploadFileName, setUploadFileName] = useState("");
  const [uploadRawCsv, setUploadRawCsv] = useState("");
  const [isResettingAccount, setIsResettingAccount] = useState(false);
  const tableRef = useRef<HTMLDivElement | null>(null);

  async function getRequestContext() {
    const token = getAccessToken();
    const accountId = await getDefaultAccountId();

    if (!accountId) {
      setPageError("No account is available for this session.");
      return null;
    }

    setStoredAccountId(accountId);

    return { token, accountId };
  }

  async function requestTransactions(context?: { token: string | null; accountId: number }) {
    const requestContext = context ?? (await getRequestContext());
    if (!requestContext) {
      return [];
    }

    const response = await fetch(
      buildApiUrl(`/transactions/?account_id=${requestContext.accountId}`),
      {
        headers: {
          Authorization: `Bearer ${requestContext.token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Unable to load transactions for this account.");
    }

    return (await response.json()) as Transaction[];
  }

  const loadInitialTransactions = useEffectEvent(async () => {
    const context = await getRequestContext();
    if (!context) {
      return { transactions: [] };
    }

    const transactions = await requestTransactions(context);

    return { transactions };
  });

  useEffect(() => {
    let isCancelled = false;

    async function loadTransactions() {
      try {
        const { transactions } = await loadInitialTransactions();

        if (!isCancelled) {
          startTransition(() => {
            setSavedRows(transactions);
            setPageError("");
          });
        }
      } catch (error) {
        if (!isCancelled) {
          setPageError(
            error instanceof Error
              ? error.message
              : "Unable to load your transactions right now.",
          );
        }
      }
    }

    void loadTransactions();

    return () => {
      isCancelled = true;
    };
  }, []);

  async function saveAndAnalyse() {
    setIsSaving(true);
    setPageError("");

    const context = await getRequestContext();
    if (!context) {
      setIsSaving(false);
      return;
    }

    if (!previewRows.length) {
      setPageError("Upload a valid CSV preview before saving.");
      setIsSaving(false);
      return;
    }

    const previousIds = new Set(savedRows.map((row) => row.id).filter(Boolean));
    try {
      const response = await fetch(buildApiUrl("/transactions/upload"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${context.token}`,
        },
        body: JSON.stringify({
          account_id: context.accountId,
          file_name: uploadFileName || undefined,
          raw_csv: uploadRawCsv || undefined,
          transactions: previewRows,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.detail || "Unable to import this CSV file.");
      }

      const refreshedRows = await requestTransactions(context);
      setSavedRows(refreshedRows);
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
        rowsReceived: result.rows_received ?? previewRows.length,
        duplicatesSkipped: result.duplicates_skipped ?? 0,
        openingBalanceUsed: result.opening_balance_used,
        closingBalance: result.closing_balance,
        fileName: result.file_name ?? uploadFileName,
        importId: result.import_id,
        importStatus: result.import_status ?? "completed",
      });

      setUploadInfo(
        [
          "File uploaded successfully.",
          "Import recorded.",
          `${result.rows_received ?? previewRows.length} rows received.`,
          `${result.imported ?? importedRows.length} new transactions added.`,
          `${result.duplicates_skipped ?? 0} duplicates skipped.`,
        ].join(" "),
      );
      setPreviewRows([]);
      setUploadRawCsv("");
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Unable to import transactions right now.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function clearAllTransactionsForAccount() {
    const context = await getRequestContext();
    if (!context) {
      return;
    }

    const confirmed = window.confirm(
      "This will permanently delete all transactions and import history for this account, and reset the account balance to its opening balance. Do you want to continue?",
    );
    if (!confirmed) {
      return;
    }

    setIsResettingAccount(true);
    setPageError("");

    try {
      const response = await fetch(
        buildApiUrl(`/transactions/reset-account?account_id=${context.accountId}`),
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${context.token}`,
          },
        },
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.detail || "Unable to clear this account right now.");
      }

      setSavedRows([]);
      setPreviewRows([]);
      setImportSummary(null);
      setSelectedTransaction(null);
      setCategoryDraft("Other");
      setApplyToFutureMerchant(false);
      setApplyToAllMerchant(false);
      setSearch("");
      setActiveFilter("all");
      setUploadFileName("");
      setUploadRawCsv("");
      setSaveFeedback("");
      setUploadInfo(
        `Account reset complete. ${result.deleted_transactions ?? 0} transactions removed and ${result.deleted_imports ?? 0} import records deleted.`,
      );
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Unable to clear this account right now.",
      );
    } finally {
      setIsResettingAccount(false);
    }
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

  const largestExpense = useMemo(() => {
    const expenses = filteredRows.filter((row) => row.amount < 0);
    const largest = expenses.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))[0];

    if (!largest) {
      return {
        amount: 0,
        category: "No expenses",
      };
    }

    return {
      amount: Math.abs(largest.amount),
      category: largest.ai.category,
    };
  }, [filteredRows]);

  async function updateCategory() {
    if (!selectedTransaction?.id) {
      return;
    }

    const hasCategoryChanged = categoryDraft !== selectedTransaction.ai.category;
    if (!hasCategoryChanged && !applyToFutureMerchant && !applyToAllMerchant) {
      return;
    }

    setIsUpdatingCategory(true);
    setSaveFeedback("");
    const token = getAccessToken();
    const context = await getRequestContext();

    if (!context) {
      setIsUpdatingCategory(false);
      return;
    }

    const response = await fetch(
      buildApiUrl(`/transactions/${selectedTransaction.id}`),
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category: categoryDraft,
          apply_to_future_merchant: applyToFutureMerchant,
          apply_to_all_merchant: applyToAllMerchant,
        }),
      },
    );

    if (!response.ok) {
      setPageError("Unable to update the category right now.");
      setIsUpdatingCategory(false);
      return;
    }

    const updated = await response.json();
    const refreshedRows = await requestTransactions(context);

    setSavedRows(refreshedRows);

    const decorated = {
      ...(refreshedRows.find((row) => row.id === updated.id) ?? updated),
      ai: getAiInsight(refreshedRows.find((row) => row.id === updated.id) ?? updated),
    };

    setSelectedTransaction(decorated);
    setCategoryDraft(displayCategory(updated.category));
    setApplyToFutureMerchant(false);
    setApplyToAllMerchant(false);
    setSaveFeedback("Category updated successfully.");
    setIsUpdatingCategory(false);
  }

  function openReviewPanel(transaction: DecoratedTransaction) {
    setSelectedTransaction(transaction);
    setCategoryDraft(transaction.ai.category);
    setApplyToFutureMerchant(false);
    setApplyToAllMerchant(false);
    setSaveFeedback("");
    setPageError("");
  }

  function closeReviewPanel() {
    setSelectedTransaction(null);
    setCategoryDraft("Other");
    setApplyToFutureMerchant(false);
    setApplyToAllMerchant(false);
    setSaveFeedback("");
  }

  function reviewImportedTransactions() {
    setActiveFilter("needs_review");
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="p-8 text-white">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-semibold">Transactions</h1>
        <button
          type="button"
          onClick={clearAllTransactionsForAccount}
          disabled={isResettingAccount}
          className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isResettingAccount ? "Clearing..." : "Clear All Transactions For This Account"}
        </button>
      </div>

      <UploadCard
        previewRows={previewRows}
        onPreviewReady={(rows) => {
          setPreviewRows(rows);
          setImportSummary(null);
          setPageError("");
          setUploadInfo(
            rows.length
              ? `${rows.length} valid transactions are ready to import for the current account.`
              : "",
          );
        }}
        onFileMetaReady={({ fileName, rawCsv }) => {
          setUploadFileName(fileName);
          setUploadRawCsv(rawCsv);
        }}
        onSave={saveAndAnalyse}
        isSaving={isSaving}
        errorMessage={pageError}
        infoMessage={uploadInfo}
        onError={(message) => {
          setPageError(message);
          setUploadInfo("");
          setImportSummary(null);
        }}
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
            transactionCount={filteredRows.length}
            totalSpent={totalSpent}
            topCategory={topCategory}
            largestExpenseAmount={largestExpense.amount}
            largestExpenseCategory={largestExpense.category}
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
        applyToFutureMerchant={applyToFutureMerchant}
        onApplyToFutureMerchantChange={setApplyToFutureMerchant}
        applyToAllMerchant={applyToAllMerchant}
        onApplyToAllMerchantChange={setApplyToAllMerchant}
        onClose={closeReviewPanel}
        onSave={updateCategory}
        isUpdatingCategory={isUpdatingCategory}
        saveFeedback={saveFeedback}
      />
    </div>
  );
}

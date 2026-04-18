const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";
const ACCOUNT_STORAGE_KEY = "selected_account_id";
const LEGACY_ACCOUNT_STORAGE_KEY = "account_id";
const GREETING_SESSION_KEY = "smartspend_greeting_mode";
const SEEN_USER_PREFIX = "smartspend_seen_user:";

export function getApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, "");
}

export async function getErrorMessageFromResponse(
  response: Response,
  fallbackMessage: string,
) {
  try {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const data = await response.json();
      if (typeof data?.detail === "string" && data.detail.trim()) {
        return data.detail;
      }
      if (typeof data?.message === "string" && data.message.trim()) {
        return data.message;
      }
    } else {
      const text = (await response.text()).trim();
      if (text) {
        return text;
      }
    }
  } catch {
    return fallbackMessage;
  }

  return fallbackMessage;
}

export function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

export function getAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem("access_token");
}

export function clearAuthSession() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem("access_token");
  clearStoredAccountId();
  document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Lax";
}

export function getStoredAccountId() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw =
    localStorage.getItem(ACCOUNT_STORAGE_KEY) ??
    localStorage.getItem(LEGACY_ACCOUNT_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function setStoredAccountId(accountId: number) {
  if (typeof window === "undefined") {
    return;
  }

  const value = String(accountId);
  localStorage.setItem(ACCOUNT_STORAGE_KEY, value);
  localStorage.setItem(LEGACY_ACCOUNT_STORAGE_KEY, value);
}

export function clearStoredAccountId() {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.removeItem(ACCOUNT_STORAGE_KEY);
  localStorage.removeItem(LEGACY_ACCOUNT_STORAGE_KEY);
}

export async function getAccounts() {
  const token = getAccessToken();
  if (!token) {
    return [];
  }

  const res = await fetch(buildApiUrl("/accounts/"), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    return [];
  }

  return await res.json();
}

export async function getDefaultAccountId() {
  const accounts = await getAccounts();
  if (!accounts.length) {
    return null;
  }

  const storedAccountId = getStoredAccountId();
  if (storedAccountId && accounts.some((account: { id: number }) => account.id === storedAccountId)) {
    return storedAccountId;
  }

  const fallbackAccountId = Number(accounts[0].id);
  if (Number.isFinite(fallbackAccountId)) {
    setStoredAccountId(fallbackAccountId);
    return fallbackAccountId;
  }

  return null;
}

export async function getAccountTransactionCount(accountId: number) {
  const token = getAccessToken();
  if (!token) {
    return 0;
  }

  const res = await fetch(buildApiUrl(`/transactions/summary?account_id=${accountId}`), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    return 0;
  }

  const data = await res.json();
  return Number(data?.transaction_count ?? 0);
}

export async function accountHasTransactions(accountId: number) {
  return (await getAccountTransactionCount(accountId)) > 0;
}

export function setGreetingModeForLogin(email: string) {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    sessionStorage.setItem(GREETING_SESSION_KEY, "returning");
    return;
  }

  const seenKey = `${SEEN_USER_PREFIX}${normalizedEmail}`;
  const hasSeenUserBefore = localStorage.getItem(seenKey) === "true";

  sessionStorage.setItem(
    GREETING_SESSION_KEY,
    hasSeenUserBefore ? "returning" : "first_time",
  );
  localStorage.setItem(seenKey, "true");
}

export function isFirstTimeGreetingSession() {
  if (typeof window === "undefined") {
    return false;
  }

  return sessionStorage.getItem(GREETING_SESSION_KEY) === "first_time";
}

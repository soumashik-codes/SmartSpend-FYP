const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";
const ACCOUNT_STORAGE_KEY = "selected_account_id";
const LEGACY_ACCOUNT_STORAGE_KEY = "account_id";

export function getApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, "");
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

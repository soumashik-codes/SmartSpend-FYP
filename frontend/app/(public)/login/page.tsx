"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Wallet } from "lucide-react";
import Link from "next/link";
import {
  accountHasTransactions,
  buildApiUrl,
  clearStoredAccountId,
  setGreetingModeForLogin,
  setStoredAccountId,
} from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  function validateEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function validateForm() {
    const nextErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      nextErrors.email = "Enter your email address.";
    } else if (!validateEmail(email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (!password) {
      nextErrors.password = "Enter your password.";
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    const formData = new URLSearchParams();
    formData.append("username", email.trim());
    formData.append("password", password);

    try {
      const res = await fetch(buildApiUrl("/auth/login"), {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const data = await res.json();

      if (!res.ok) {
        const detail =
          typeof data?.detail === "string" ? data.detail : "Unable to sign in right now.";
        throw new Error(
          detail === "Invalid credentials"
            ? "Incorrect email or password."
            : detail,
        );
      }

      document.cookie = `token=${data.access_token}; path=/; SameSite=Lax`;
      localStorage.setItem("access_token", data.access_token);
      setGreetingModeForLogin(email.trim());

      const accountRes = await fetch(buildApiUrl("/accounts/"), {
        headers: {
          Authorization: `Bearer ${data.access_token}`,
        },
      });

      if (!accountRes.ok) {
        throw new Error("We signed you in, but could not load your account.");
      }

      const accounts = await accountRes.json();

      if (accounts.length > 0) {
        clearStoredAccountId();
        setStoredAccountId(Number(accounts[0].id));
      } else {
        throw new Error("No account was found for this user.");
      }

      const accountId = Number(accounts[0].id);
      const hasTransactions = await accountHasTransactions(accountId);

      router.push(hasTransactions ? "/dashboard" : "/transactions");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to sign in right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#050816] via-[#0a1124] to-[#050816] text-white">
      <div className="w-full max-w-md rounded-2xl border border-[#1f2c4d] bg-[#0f1b33] p-8 shadow-xl">
        <div className="mb-8 flex flex-col items-center">
          <div className="rounded-xl bg-green-500/20 p-4">
            <Wallet className="text-green-400" size={28} />
          </div>
          <h1 className="mt-4 text-2xl font-bold">
            Smart<span className="text-green-400">Spend</span>
          </h1>
          <p className="mt-2 text-sm text-gray-400">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          ) : null}

          <div>
            <label className="text-sm text-gray-400">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldErrors((current) => ({ ...current, email: undefined }));
              }}
              className={`mt-2 w-full rounded-lg border bg-[#0a1428] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-400 ${
                fieldErrors.email ? "border-red-500/60" : "border-[#1f2c4d]"
              }`}
            />
            {fieldErrors.email ? (
              <p className="mt-2 text-sm text-red-300">{fieldErrors.email}</p>
            ) : null}
          </div>

          <div>
            <label className="text-sm text-gray-400">Password</label>
            <div className="relative mt-2">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFieldErrors((current) => ({ ...current, password: undefined }));
                }}
                className={`w-full rounded-lg border bg-[#0a1428] px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-green-400 ${
                  fieldErrors.password ? "border-red-500/60" : "border-[#1f2c4d]"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute inset-y-0 right-0 flex items-center px-4 text-gray-400 transition hover:text-white"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fieldErrors.password ? (
              <p className="mt-2 text-sm text-red-300">{fieldErrors.password}</p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-green-500 py-3 font-semibold transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-green-400 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

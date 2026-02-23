"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

 async function handleLogin(e: React.FormEvent) {
  e.preventDefault();
  setLoading(true);
  setError("");

  const formData = new URLSearchParams();
  formData.append("username", email);
  formData.append("password", password);

  try {
    const res = await fetch("http://127.0.0.1:8000/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!res.ok) {
      throw new Error("Invalid email or password");
    }

    const data = await res.json();

    // Store token in cookie (middleware)
    document.cookie = `token=${data.access_token}; path=/; SameSite=Lax`;

    // Store token for API usage
    localStorage.setItem("token", data.access_token);

    // NEW: Fetch user's account automatically
    const accountRes = await fetch("http://127.0.0.1:8000/accounts/", {
      headers: {
        Authorization: `Bearer ${data.access_token}`,
      },
    });

    if (!accountRes.ok) {
      throw new Error("Failed to fetch account");
    }

    const accounts = await accountRes.json();

    if (accounts.length > 0) {
      localStorage.setItem("account_id", accounts[0].id);
    } else {
      throw new Error("No account found for user");
    }

    router.push("/dashboard");

  } catch (err: any) {
    setError(err.message || "Login failed");
  } finally {
    setLoading(false);
  }
}


  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#050816] via-[#0a1124] to-[#050816] text-white">

      <div className="w-full max-w-md bg-[#0f1b33] border border-[#1f2c4d] rounded-2xl p-8 shadow-xl">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-green-500/20 p-4 rounded-xl">
            <Wallet className="text-green-400" size={28} />
          </div>
          <h1 className="text-2xl font-bold mt-4">
            Smart<span className="text-green-400">Spend</span>
          </h1>
          <p className="text-gray-400 mt-2 text-sm">
            Sign in to your account
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <div>
            <label className="text-sm text-gray-400">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full bg-[#0a1428] border border-[#1f2c4d] rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full bg-[#0a1428] border border-[#1f2c4d] rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-600 transition py-3 rounded-lg font-semibold"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-sm text-gray-400 mt-6 text-center">
          Don't have an account?{" "}
          <Link href="/signup" className="text-green-400 hover:underline">
            Sign up
          </Link>
        </p>

      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  LayoutDashboard,
  ArrowLeftRight,
  TrendingUp,
  SlidersHorizontal,
  Receipt,
  Lightbulb,
  LogOut,
  Wallet,
  CalculatorIcon,
  Settings,
  UserCircle2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Transactions", href: "/transactions", icon: ArrowLeftRight },
  { name: "Forecast", href: "/forecast", icon: TrendingUp },
  { name: "What-If", href: "/what-if", icon: SlidersHorizontal },
  { name: "Receipts", href: "/receipts", icon: Receipt },
  { name: "Advisor", href: "/advisor", icon: Lightbulb },
  { name: "Tax Estimator", href: "/tax-estimator", icon: CalculatorIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

  // ===============================
  // Fetch Logged-In User
  // ===============================
  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      router.push("/login");
      return;
    }

    async function fetchUser() {
      try {
        const res = await fetch("http://127.0.0.1:8000/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          localStorage.removeItem("access_token");
          router.push("/login");
          return;
        }

        const data = await res.json();
        setUser(data);
      } catch (err) {
        console.error("Failed to fetch user:", err);
      }
    }

    fetchUser();
  }, [router]);

  useEffect(() => {
    setIsAccountMenuOpen(false);
  }, [pathname, collapsed]);

  // ===============================
  // Generate Initials
  // ===============================
  function getInitials() {
    if (!user?.full_name) return "";

    const names = user.full_name.trim().split(" ");
    const first = names[0]?.[0] || "";
    const last =
      names.length > 1 ? names[names.length - 1][0] : "";

    return `${first}${last}`.toUpperCase();
  }

  // ===============================
  // Logout
  // ===============================
  function handleLogout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("account_id");
    router.push("/login");
  }

  return (
    <>
      <div className={`h-screen shrink-0 transition-all duration-300 ${collapsed ? "w-20" : "w-64"}`} />
      <aside
        className={`fixed inset-y-0 left-0 z-30 ${
          collapsed ? "w-20" : "w-64"
        } border-r border-[var(--border-color)] bg-[var(--app-bg)] flex flex-col justify-between transition-all duration-300`}
      >
        {/* ===============================
            TOP SECTION
        =============================== */}
        <div>
          {/* Logo + Collapse Toggle */}
          <div className="flex items-center justify-between px-6 py-6">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500/15 p-2 rounded-lg">
                <Wallet className="text-emerald-400" size={20} />
              </div>

              {!collapsed && (
                <h1 className="text-lg font-semibold text-white tracking-tight">
                  Smart
                  <span className="text-emerald-400">
                    Spend
                  </span>
                </h1>
              )}
            </div>

            <button
              onClick={() => setCollapsed(!collapsed)}
              className="text-gray-400 hover:text-white transition"
            >
              {collapsed ? (
                <ChevronRight size={18} />
              ) : (
                <ChevronLeft size={18} />
              )}
            </button>
          </div>

          {/* Navigation */}
          <nav className="mt-4 flex flex-col gap-2 px-4">
            {navItems.map((item) => {
              const isActive =
                pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200
                    ${
                      isActive
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }
                  `}
                >
                  <Icon size={18} />
                  {!collapsed && item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* ===============================
            USER CARD
        =============================== */}
        <div className="relative border-t border-[var(--border-color)] p-5">
          {!collapsed && isAccountMenuOpen ? (
            <div className="absolute bottom-full left-5 right-5 mb-3 space-y-2 rounded-xl border border-[var(--border-color)] bg-[#151f38] p-2 shadow-2xl">
              <Link
                href="/settings#profile"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-300 transition hover:bg-white/5 hover:text-white"
              >
                <UserCircle2 size={16} />
                Profile
              </Link>
              <Link
                href="/settings"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-300 transition hover:bg-white/5 hover:text-white"
              >
                <Settings size={16} />
                Settings
              </Link>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-300 transition hover:bg-red-500/10 hover:text-red-300"
              >
                <LogOut size={16} />
                Log out
              </button>
            </div>
          ) : null}

          <button
            onClick={() => !collapsed && setIsAccountMenuOpen((current) => !current)}
            className={`flex w-full items-center gap-3 rounded-xl text-left transition ${
              collapsed
                ? "justify-center"
                : "bg-[#111831] px-3 py-2 hover:bg-white/5"
            }`}
          >
            <div className="h-9 w-9 flex items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 font-semibold">
              {user ? getInitials() : ""}
            </div>

            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {user?.full_name || "Loading..."}
                  </p>
                  <p className="truncate text-xs text-gray-400">
                    {user?.email || "Fetching account..."}
                  </p>
                </div>
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-gray-500 transition ${
                    isAccountMenuOpen ? "rotate-180 text-white" : ""
                  }`}
                />
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

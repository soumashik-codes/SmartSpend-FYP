"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  TrendingUp,
  SlidersHorizontal,
  Receipt,
  Lightbulb,
  LogOut,
  Wallet,
  CalculatorIcon
} from "lucide-react";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Transactions", href: "/transactions", icon: ArrowLeftRight },
  { name: "Forecast", href: "/forecast", icon: TrendingUp },
  { name: "What-If", href: "/what-if", icon: SlidersHorizontal },
  { name: "Receipts", href: "/receipts", icon: Receipt },
  { name: "Advisor", href: "/advisor", icon: Lightbulb },
  {name: "Tax Estimator",href: "/tax-estimator",icon: CalculatorIcon}
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="h-screen w-64 bg-[#0b1220] border-r border-[#1a2236] flex flex-col justify-between">

      {/* Top Section */}
      <div>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="bg-emerald-500/15 p-2 rounded-lg">
            <Wallet className="text-emerald-400" size={20} />
          </div>
          <h1 className="text-lg font-semibold text-white tracking-tight">
            Smart<span className="text-emerald-400">Spend</span>
          </h1>
        </div>

        {/* Navigation */}
        <nav className="mt-4 flex flex-col gap-2 px-4">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
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
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom User Card */}
      <div className="border-t border-[#1a2236] p-5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 flex items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 font-semibold">
            RG
          </div>
          <div>
            <p className="text-sm text-white font-medium">Rupert Griffin</p>
            <p className="text-xs text-gray-400">test@gmail.com</p>
          </div>
        </div>

        <button className="mt-5 flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 transition">
          <LogOut size={16} />
          Log out
        </button>
      </div>

    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  Receipt,
  LineChart,
  Lightbulb,
  Settings,
  LogOut,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Upload Transactions", href: "/upload", icon: Upload },
  { label: "Receipts", href: "/receipts", icon: Receipt },
  { label: "Forecast", href: "/forecast", icon: LineChart },
  { label: "Advisor", href: "/insights", icon: Lightbulb },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    document.cookie =
      "smartspend-auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.push("/login");
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col justify-between min-h-screen">
      
      {/* Top section */}
      <div>
        {/* Logo */}
        <div className="px-6 py-5 border-b">
          <h1 className="text-xl font-semibold">SmartSpend</h1>
        </div>

        {/* User (placeholder – replaced later with auth data) */}
        <div className="flex items-center gap-3 px-6 py-4">
          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center font-semibold text-blue-600">
            A
          </div>
          <div>
            <p className="text-sm font-medium">Alex Doe</p>
            <p className="text-xs text-gray-500">alex@email.com</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mt-2 px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition
                  ${
                    isActive
                      ? "bg-blue-50 text-blue-600 font-medium"
                      : "text-gray-700 hover:bg-gray-100"
                  }
                `}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom section */}
      <div className="px-2 py-4 border-t">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          Log Out
        </button>
      </div>
    </aside>
  );
}

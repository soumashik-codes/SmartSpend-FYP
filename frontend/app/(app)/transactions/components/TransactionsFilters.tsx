"use client";

import { Filter } from "lucide-react";

type TransactionsFiltersProps = {
  search: string;
  onSearchChange: (value: string) => void;
  filters: string[];
  activeFilter: string;
  onFilterChange: (value: string) => void;
};

export function TransactionsFilters({
  search,
  onSearchChange,
  filters,
  activeFilter,
  onFilterChange,
}: TransactionsFiltersProps) {
  return (
    <>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold">All Transactions</h2>
          <p className="mt-1 text-sm text-slate-400">
            AI confidence, review workflow, and manual category override
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <input
              type="text"
              placeholder="Search transactions..."
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              className="rounded-lg border border-[#1f2c4d] bg-[#0a1428] px-4 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Filter size={16} />
            <span>Filters</span>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {filters.map((filterValue) => {
          const label =
            filterValue === "all"
              ? "All"
              : filterValue === "needs_review"
                ? "Needs Review"
                : filterValue;

          return (
            <button
              key={filterValue}
              onClick={() => onFilterChange(filterValue)}
              className={`rounded-full px-4 py-2 text-sm transition ${
                activeFilter === filterValue
                  ? "bg-emerald-500 text-slate-950"
                  : "border border-[#1f2c4d] bg-[#0a1428] text-slate-300 hover:border-emerald-400/40"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </>
  );
}

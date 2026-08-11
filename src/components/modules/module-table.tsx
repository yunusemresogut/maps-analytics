"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { SortDirection } from "@/hooks/use-table-state";

const STATUS_STYLES: Record<string, string> = {
  open: "bg-sky-500/15 text-sky-300 ring-sky-500/25",
  in_progress: "bg-amber-500/15 text-amber-300 ring-amber-500/25",
  waiting: "bg-violet-500/15 text-violet-300 ring-violet-500/25",
  resolved: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25",
  closed: "bg-zinc-500/15 text-zinc-400 ring-zinc-500/25",
  draft: "bg-zinc-500/15 text-zinc-400 ring-zinc-500/25",
  active: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25",
  pending_signature: "bg-amber-500/15 text-amber-300 ring-amber-500/25",
  expired: "bg-orange-500/15 text-orange-300 ring-orange-500/25",
  cancelled: "bg-red-500/15 text-red-300 ring-red-500/25",
  submitted: "bg-sky-500/15 text-sky-300 ring-sky-500/25",
  under_review: "bg-violet-500/15 text-violet-300 ring-violet-500/25",
  approved: "bg-cyan-500/15 text-cyan-300 ring-cyan-500/25",
  paid: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/25",
  rejected: "bg-red-500/15 text-red-300 ring-red-500/25",
  issued: "bg-sky-500/15 text-sky-300 ring-sky-500/25",
  partially_paid: "bg-amber-500/15 text-amber-300 ring-amber-500/25",
  overdue: "bg-red-500/15 text-red-300 ring-red-500/25",
  low: "bg-zinc-500/15 text-zinc-400 ring-zinc-500/25",
  medium: "bg-sky-500/15 text-sky-300 ring-sky-500/25",
  high: "bg-amber-500/15 text-amber-300 ring-amber-500/25",
  critical: "bg-red-500/15 text-red-300 ring-red-500/25",
};

export function StatusBadge({
  value,
  label,
}: {
  value: string;
  label?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        STATUS_STYLES[value] ?? "bg-zinc-500/15 text-zinc-400 ring-zinc-500/25"
      )}
    >
      {label ?? value}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-zinc-100">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-zinc-600">{hint}</p>}
    </div>
  );
}

export function ModuleTableShell({
  title,
  description,
  stats,
  toolbar,
  footer,
  demoNote = true,
  children,
}: {
  title: string;
  description: string;
  stats?: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
  demoNote?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="scrollbar-themed h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-zinc-100">{title}</h1>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>
      {stats && (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats}
        </div>
      )}
      {toolbar && <div className="mb-4 flex flex-wrap gap-2">{toolbar}</div>}
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/40">
        <div className="overflow-x-auto">{children}</div>
        {footer}
      </div>
      {demoNote && (
        <p className="mt-3 text-[11px] text-zinc-600">
          Demo veri — backend bağlantısı yok
        </p>
      )}
    </div>
  );
}

export type DataTableColumn<K extends string = string> = {
  key: K;
  label: string;
  sortable?: boolean;
  className?: string;
};

export function SortableTh<K extends string>({
  columnKey,
  label,
  sortable = true,
  activeKey,
  direction,
  onToggle,
  className,
}: {
  columnKey: K;
  label: string;
  sortable?: boolean;
  activeKey: K;
  direction: SortDirection;
  onToggle: (key: K) => void;
  className?: string;
}) {
  if (!sortable) {
    return (
      <th
        className={cn(
          "whitespace-nowrap px-4 py-3 font-medium",
          className
        )}
      >
        {label}
      </th>
    );
  }

  const active = activeKey === columnKey;
  const Icon = !active
    ? ArrowUpDown
    : direction === "asc"
      ? ArrowUp
      : ArrowDown;

  return (
    <th className={cn("whitespace-nowrap px-4 py-3 font-medium", className)}>
      <button
        type="button"
        onClick={() => onToggle(columnKey)}
        className={cn(
          "inline-flex items-center gap-1.5 transition-colors hover:text-zinc-200",
          active ? "text-zinc-200" : "text-zinc-500"
        )}
      >
        {label}
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
      </button>
    </th>
  );
}

export function DataTable<K extends string>({
  columns,
  sortKey,
  sortDirection,
  onSort,
  children,
  minWidthClassName = "min-w-[760px]",
}: {
  columns: DataTableColumn<K>[];
  sortKey: K;
  sortDirection: SortDirection;
  onSort: (key: K) => void;
  children: ReactNode;
  minWidthClassName?: string;
}) {
  return (
    <table className={cn("w-full text-left text-sm", minWidthClassName)}>
      <thead className="bg-zinc-900/90 text-[11px] uppercase tracking-wider text-zinc-500">
        <tr>
          {columns.map((col) => (
            <SortableTh
              key={col.key}
              columnKey={col.key}
              label={col.label}
              sortable={col.sortable !== false}
              activeKey={sortKey}
              direction={sortDirection}
              onToggle={onSort}
              className={col.className}
            />
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-800/80">{children}</tbody>
    </table>
  );
}

export function TablePagination({
  page,
  totalPages,
  totalItems,
  rangeStart,
  rangeEnd,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  rangeStart: number;
  rangeEnd: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-zinc-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-zinc-500">
        {totalItems === 0
          ? "Kayıt yok"
          : `${rangeStart}–${rangeEnd} / ${totalItems}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {onPageSizeChange && pageSize != null && (
          <Select
            value={String(pageSize)}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 w-auto min-w-[88px] py-1 text-xs"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n} / sayfa
              </option>
            ))}
          </Select>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Önceki sayfa"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[72px] text-center text-xs tabular-nums text-zinc-400">
          {page} / {totalPages}
        </span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Sonraki sayfa"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

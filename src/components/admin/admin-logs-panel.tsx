"use client";

import { useCallback, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Filter, Trash2 } from "lucide-react";
import { useActivityLogs } from "@/hooks/use-activity-logs";
import { useI18n } from "@/contexts/i18n-context";
import { localizedRecord } from "@/i18n/runtime";
import { useTableState } from "@/hooks/use-table-state";
import { clearActivityLogs } from "@/lib/activity-log";
import { Button } from "@/components/ui/button";
import {
  SortableTh,
  TablePagination,
} from "@/components/modules/module-table";
import type { ActivityCategory, ActivityLogEntry } from "@/types";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { Select } from "@/components/ui/select";

const CATEGORY_LABELS: Record<ActivityCategory, string> = localizedRecord({
  auth: "admin.logs.categories.auth",
  user: "admin.logs.categories.user",
  permission: "admin.logs.categories.permission",
  region: "admin.logs.categories.region",
  store: "admin.logs.categories.store",
  system: "admin.logs.categories.system",
  ticket: "admin.logs.categories.ticket",
  contract: "admin.logs.categories.contract",
  payment: "admin.logs.categories.payment",
  invoice: "admin.logs.categories.invoice",
  approval: "admin.logs.categories.approval",
  organization: "admin.logs.categories.organization",
  profile: "admin.logs.categories.profile",
  budget: "admin.logs.categories.budget",
  note: "admin.logs.categories.note",
  file: "admin.logs.categories.file",
  material: "admin.logs.categories.material",
  workplan: "admin.logs.categories.workplan",
  inventory: "admin.logs.categories.inventory",
  hr: "admin.logs.categories.hr",
});

const CATEGORY_COLORS: Record<ActivityCategory, string> = {
  auth: "text-cyan-400 bg-cyan-500/10",
  user: "text-violet-400 bg-violet-500/10",
  permission: "text-amber-400 bg-amber-500/10",
  region: "text-emerald-400 bg-emerald-500/10",
  store: "text-pink-400 bg-pink-500/10",
  system: "text-zinc-400 bg-zinc-500/10",
  ticket: "text-sky-400 bg-sky-500/10",
  contract: "text-indigo-400 bg-indigo-500/10",
  payment: "text-orange-400 bg-orange-500/10",
  invoice: "text-lime-400 bg-lime-500/10",
  approval: "text-fuchsia-400 bg-fuchsia-500/10",
  organization: "text-teal-400 bg-teal-500/10",
  profile: "text-blue-400 bg-blue-500/10",
  budget: "text-yellow-400 bg-yellow-500/10",
  note: "text-stone-300 bg-stone-500/10",
  file: "text-rose-400 bg-rose-500/10",
  material: "text-cyan-300 bg-cyan-500/10",
  workplan: "text-emerald-300 bg-emerald-500/10",
  inventory: "text-sky-300 bg-sky-500/10",
  hr: "text-teal-300 bg-teal-500/10",
};

type SortKey =
  | "createdAt"
  | "category"
  | "action"
  | "message"
  | "actorName";

export function AdminLogsPanel() {
  const logs = useActivityLogs();
  const { t, dateLocale } = useI18n();
  const [category, setCategory] = usePersistentState<ActivityCategory | "all">("admin-logs", "category", "all");

  const filtered = useMemo(() => {
    if (category === "all") return logs;
    return logs.filter((l) => l.category === category);
  }, [logs, category]);

  const getSortValue = useCallback((item: ActivityLogEntry, key: SortKey) => {
    return item[key];
  }, []);

  const table = useTableState<ActivityLogEntry, SortKey>({
    memoryKey: "admin-logs",
    items: filtered,
    initialSort: { key: "createdAt", direction: "desc" },
    getSortValue,
    resetKey: category,
  });

  const handleClear = () => {
    if (confirm(t("admin.logs.confirmClear"))) {
      clearActivityLogs();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-zinc-500" />
          <Select
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as ActivityCategory | "all")
            }
            aria-label={t("admin.logs.category")}
            className="h-9 w-auto min-w-[180px]"
          >
            <option value="all">{t("admin.logs.allCategories")}</option>
            {(Object.keys(CATEGORY_LABELS) as ActivityCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
          <span className="text-xs text-zinc-600">{t(filtered.length === 1 ? "admin.logs.recordsOne" : "admin.logs.recordsOther", { count: filtered.length })}</span>
        </div>
        {logs.length > 0 && (
          <Button size="sm" variant="ghost" onClick={handleClear}>
            <Trash2 className="h-3.5 w-3.5" />
            {t("admin.logs.clear")}
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50">
        <div className="scrollbar-themed max-h-[calc(100vh-18rem)] overflow-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="sticky top-0 bg-zinc-950/95 text-left text-xs text-zinc-500">
              <tr>
                <SortableTh
                  columnKey="createdAt"
                  label={t("admin.logs.columns.date")}
                  activeKey={table.sort.key}
                  direction={table.sort.direction}
                  onToggle={table.toggleSort}
                />
                <SortableTh
                  columnKey="category"
                  label={t("admin.logs.category")}
                  activeKey={table.sort.key}
                  direction={table.sort.direction}
                  onToggle={table.toggleSort}
                />
                <SortableTh
                  columnKey="action"
                  label={t("admin.logs.columns.action")}
                  activeKey={table.sort.key}
                  direction={table.sort.direction}
                  onToggle={table.toggleSort}
                />
                <SortableTh
                  columnKey="message"
                  label={t("admin.logs.columns.detail")}
                  activeKey={table.sort.key}
                  direction={table.sort.direction}
                  onToggle={table.toggleSort}
                />
                <SortableTh
                  columnKey="actorName"
                  label={t("admin.logs.columns.user")}
                  activeKey={table.sort.key}
                  direction={table.sort.direction}
                  onToggle={table.toggleSort}
                />
              </tr>
            </thead>
            <tbody>
              {table.totalItems === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-zinc-600"
                  >
                    {t("admin.logs.empty")}
                  </td>
                </tr>
              )}
              {table.pageItems.map((log) => (
                <tr
                  key={log.id}
                  className="border-t border-zinc-800/80 hover:bg-zinc-900/50"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500">
                    {format(parseISO(log.createdAt), "d MMM yyyy, HH:mm", {
                      locale: dateLocale,
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${CATEGORY_COLORS[log.category]}`}
                    >
                      {CATEGORY_LABELS[log.category]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{log.action}</td>
                  <td className="px-4 py-3 text-zinc-300">{log.message}</td>
                  <td className="px-4 py-3 text-zinc-500">{log.actorName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={table.page}
          totalPages={table.totalPages}
          totalItems={table.totalItems}
          rangeStart={table.rangeStart}
          rangeEnd={table.rangeEnd}
          onPageChange={table.setPage}
          pageSize={table.pageSize}
          onPageSizeChange={table.setPageSize}
        />
      </div>
    </div>
  );
}

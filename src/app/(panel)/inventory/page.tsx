"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  CalendarClock,
  History,
  MapPin,
  Package,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  UserRoundPlus,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { TablePagination } from "@/components/modules/module-table";
import {
  AssignModal,
  HistoryModal,
  InventoryItemModal,
  ReturnModal,
  formatDay,
} from "@/components/inventory/inventory-modals";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/contexts/i18n-context";
import type { TranslationKey } from "@/i18n";
import { usePermissions } from "@/hooks/use-permissions";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { useServerTable } from "@/hooks/use-server-table";
import { logActivity } from "@/lib/activity-log";
import {
  CATEGORY_LABELS,
  INVENTORY_SEARCH_COLUMNS,
  INVENTORY_SOURCE,
  STATE_LABELS,
  STATE_STYLES,
  assignInventoryItem,
  createInventoryItem,
  deleteInventoryItem,
  fetchInventoryCounts,
  inventoryErrorMessage,
  mapInventoryRow,
  nearestVehicleDocument,
  returnInventoryItem,
  updateAssignment,
  updateInventoryItem,
  type InventoryItem,
  type InventoryState,
} from "@/lib/inventory";
import { cn } from "@/lib/utils";
import { differenceInCalendarDays, parseISO } from "date-fns";

type SortKey = "name" | "code" | "category" | "state" | "assignee";

const SORT_OPTIONS: { key: SortKey; labelKey: TranslationKey; column: string }[] = [
  { key: "name", labelKey: "inventory.page.sortByName", column: "name" },
  { key: "code", labelKey: "inventory.page.sortByCode", column: "code" },
  { key: "category", labelKey: "inventory.page.sortByCategory", column: "category" },
  { key: "state", labelKey: "inventory.page.sortByState", column: "state" },
  { key: "assignee", labelKey: "inventory.page.sortByAssignee", column: "assignee_name" },
];
const SORT_COLUMNS = Object.fromEntries(SORT_OPTIONS.map((option) => [option.key, option.column])) as Record<SortKey, string>;

type Dialog =
  | { kind: "item"; item: InventoryItem | null }
  | { kind: "assign"; item: InventoryItem }
  | { kind: "return"; item: InventoryItem }
  | { kind: "history"; item: InventoryItem };

const STAT_ORDER: InventoryState[] = ["assigned", "available", "maintenance", "retired"];

function isOverdue(item: InventoryItem) {
  const expected = item.assignment?.expectedReturn;
  return !!expected && expected < new Date().toISOString().slice(0, 10);
}

function InventoryRow({
  item,
  canEdit,
  canDelete,
  canView,
  onAction,
}: {
  item: InventoryItem;
  canEdit: boolean;
  canDelete: boolean;
  canView: boolean;
  onAction: (dialog: Dialog | { kind: "delete"; item: InventoryItem }) => void;
}) {
  const t = useT();
  const assignment = item.assignment;
  const overdue = isOverdue(item);
  const details = [CATEGORY_LABELS[item.category], item.brand, item.serialNo].filter(Boolean).join(" · ");
  const vehicleDoc = item.category === "vehicle" && item.state !== "retired" ? nearestVehicleDocument(item) : null;
  const vehicleDays = vehicleDoc ? differenceInCalendarDays(parseISO(vehicleDoc.date), new Date()) : null;

  return (
    <li className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-4 transition-colors hover:border-zinc-700 lg:flex-row lg:items-center lg:gap-8">
      {/* Eşya */}
      <div className="flex min-w-0 items-center gap-4 lg:w-[32%] lg:shrink-0">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-zinc-800/70 text-zinc-400">
          <Package className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-2">
            {item.code && <span className="shrink-0 font-mono text-xs text-zinc-500">{item.code}</span>}
            <span className="truncate text-base font-semibold text-zinc-100">{item.name}</span>
          </p>
          <p className="mt-1 truncate text-sm text-zinc-500">{details}</p>
          {vehicleDoc && vehicleDays !== null && vehicleDays <= 30 && (
            <span
              className={cn(
                "mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
                vehicleDays < 0
                  ? "border-red-500/25 bg-red-500/10 text-red-400"
                  : "border-amber-500/25 bg-amber-500/10 text-amber-400"
              )}
            >
              {vehicleDoc.label}:{" "}
              {vehicleDays < 0
                ? t(vehicleDays === -1 ? "inventory.row.daysOverdueOne" : "inventory.row.daysOverdueOther", { count: -vehicleDays })
                : vehicleDays === 0
                  ? t("inventory.row.expiresToday")
                  : t(vehicleDays === 1 ? "inventory.row.daysLeftOne" : "inventory.row.daysLeftOther", { count: vehicleDays })}
            </span>
          )}
        </div>
      </div>

      {/* Zimmet */}
      <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{t("inventory.row.status")}</p>
          <span className={cn("mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", STATE_STYLES[item.state])}>
            {STATE_LABELS[item.state]}
          </span>
        </div>
        <div className="flex min-w-0 items-start gap-2.5">
          <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{t("inventory.row.assignee")}</p>
            <p className={cn("mt-0.5 truncate text-sm", assignment ? "text-zinc-200" : "text-zinc-600")}>
              {assignment ? assignment.assigneeName : "—"}
            </p>
            {assignment?.storeName && (
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-zinc-500">
                <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                {assignment.storeName}
              </p>
            )}
          </div>
        </div>
        <div className="flex min-w-0 items-start gap-2.5">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{t("inventory.row.assignmentDates")}</p>
            {assignment ? (
              <p className="mt-0.5 truncate text-sm text-zinc-300">
                {formatDay(assignment.assignedAt)}
                {assignment.expectedReturn && (
                  <span className={cn("block text-xs", overdue ? "font-medium text-red-400" : "text-zinc-500")}>
                    {overdue ? t("inventory.row.returnOverdue") : t("inventory.row.returnDue")}
                    {formatDay(assignment.expectedReturn)}
                  </span>
                )}
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-zinc-600">—</p>
            )}
          </div>
        </div>
      </div>

      {/* İşlemler */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 lg:justify-end">
        {canEdit && item.state !== "retired" && (
          assignment ? (
            <Button size="sm" variant="outline" onClick={() => onAction({ kind: "return", item })}>
              <ArrowDownToLine className="h-3.5 w-3.5" />
              {t("inventory.row.return")}
            </Button>
          ) : (
            <Button size="sm" onClick={() => onAction({ kind: "assign", item })} disabled={item.state === "maintenance"} title={item.state === "maintenance" ? t("inventory.row.maintenanceCantAssign") : undefined}>
              <UserRoundPlus className="h-3.5 w-3.5" />
              {t("inventory.row.assign")}
            </Button>
          )
        )}
        {canEdit && assignment && (
          <IconButton label={t("inventory.row.editAssignment")} onClick={() => onAction({ kind: "assign", item })}>
            <UserRound className="h-4 w-4" />
          </IconButton>
        )}
        {canView && (
          <IconButton label={t("inventory.row.history")} onClick={() => onAction({ kind: "history", item })}>
            <History className="h-4 w-4" />
          </IconButton>
        )}
        {canEdit && (
          <IconButton label={t("inventory.row.edit")} onClick={() => onAction({ kind: "item", item })}>
            <Pencil className="h-4 w-4" />
          </IconButton>
        )}
        {canDelete && (
          <IconButton label={t("inventory.row.delete")} danger onClick={() => onAction({ kind: "delete", item })}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        )}
      </div>
    </li>
  );
}

function IconButton({
  label,
  danger,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors",
        danger ? "hover:bg-red-500/10 hover:text-red-400" : "hover:bg-zinc-800/60 hover:text-zinc-100"
      )}
    >
      {children}
    </button>
  );
}

function InventoryContent() {
  const t = useT();
  const { user } = useAuth();
  const { canView, canAdd, canEdit, canDelete } = usePermissions("inventory");
  const [query, setQuery] = usePersistentState("inventory", "query", "");
  const [stateFilter, setStateFilter] = usePersistentState("inventory", "state", "all");
  const [category, setCategory] = usePersistentState("inventory", "category", "all");
  const [version, setVersion] = useState(0);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [submit, setSubmit] = useState({ saving: false, error: "" });
  const [notice, setNotice] = useState("");
  const [counts, setCounts] = useState<Record<InventoryState, number> | null>(null);

  const filters = useMemo(() => ({ state: stateFilter, category }), [stateFilter, category]);
  const table = useServerTable<InventoryItem, SortKey>({
    memoryKey: "inventory",
    source: INVENTORY_SOURCE,
    mapRow: mapInventoryRow,
    searchColumns: INVENTORY_SEARCH_COLUMNS,
    search: query,
    filters,
    sortColumns: SORT_COLUMNS,
    initialSort: { key: "name", direction: "asc" },
    refreshKey: version,
  });

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    fetchInventoryCounts()
      .then((next) => !cancelled && setCounts(next))
      .catch((err) => console.error("Envanter özeti yüklenemedi:", err));
    return () => {
      cancelled = true;
    };
  }, [canView, version]);

  const log = useCallback(
    (action: string, message: string, item: InventoryItem | null) => {
      if (!user) return;
      logActivity({
        category: "inventory",
        action,
        message,
        actorId: user.id,
        actorName: user.name,
        targetId: item?.id,
        targetLabel: item?.name,
      });
    },
    [user]
  );

  const open = (next: Dialog) => {
    setSubmit({ saving: false, error: "" });
    setDialog(next);
  };

  /** Modal işlemi: başarıda listeyi tazeler ve kısa bir bildirim gösterir */
  const run = async (task: () => Promise<void>, success: string, fallback: string) => {
    setSubmit({ saving: true, error: "" });
    try {
      await task();
      setDialog(null);
      setVersion((current) => current + 1);
      setNotice(success);
      window.setTimeout(() => setNotice(""), 3000);
    } catch (err) {
      console.error(fallback, err);
      setSubmit({ saving: false, error: inventoryErrorMessage(err, fallback) });
    }
  };

  const remove = async (item: InventoryItem) => {
    if (!confirm(t("inventory.page.deleteConfirm", { name: item.name }))) return;
    try {
      await deleteInventoryItem(item.id);
      log("delete", `Envanter silindi: ${item.name}`, item);
      setVersion((current) => current + 1);
    } catch (err) {
      console.error("Envanter silinemedi:", err);
      setNotice(inventoryErrorMessage(err, t("inventory.page.deleteFailed")));
    }
  };

  const filtered = query || stateFilter !== "all" || category !== "all";

  return (
    <div className="scrollbar-themed h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">{canView ? t("inventory.page.title") : t("inventory.page.myTitle")}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {canView
              ? t("inventory.page.description")
              : t("inventory.page.myDescription")}
          </p>
        </div>
        {canAdd && (
          <Button onClick={() => open({ kind: "item", item: null })}>
            <Plus className="h-4 w-4" />
            {t("inventory.page.add")}
          </Button>
        )}
      </div>

      {canView && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {STAT_ORDER.map((state) => (
            <button
              key={state}
              type="button"
              onClick={() => setStateFilter(stateFilter === state ? "all" : state)}
              aria-pressed={stateFilter === state}
              className={cn(
                "rounded-xl border bg-zinc-900/40 px-4 py-3 text-left transition-colors",
                stateFilter === state ? "border-cyan-500/50" : "border-zinc-800 hover:border-zinc-700"
              )}
            >
              <p className="text-xs text-zinc-500">{STATE_LABELS[state]}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-100">{counts ? counts[state] : "–"}</p>
            </button>
          ))}
        </div>
      )}

      {notice && (
        <p role="status" className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
          {notice}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("inventory.page.searchPlaceholder")}
          aria-label={t("inventory.page.searchLabel")}
          containerClassName="flex-1 sm:max-w-sm"
        />
        <Select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="w-auto min-w-[150px]" aria-label={t("inventory.page.statusFilter")}>
          <option value="all">{t("inventory.page.allStatuses")}</option>
          {STAT_ORDER.map((state) => (
            <option key={state} value={state}>
              {STATE_LABELS[state]}
            </option>
          ))}
        </Select>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-auto min-w-[160px]" aria-label={t("inventory.page.categoryFilter")}>
          <option value="all">{t("inventory.page.allCategories")}</option>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          value={table.sort.key}
          onChange={(e) => table.setSort({ key: e.target.value as SortKey, direction: "asc" })}
          className="w-auto min-w-[180px]"
          aria-label={t("inventory.page.sortLabel")}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {t(option.labelKey)}
            </option>
          ))}
        </Select>
      </div>

      {table.isLoading && table.pageItems.length === 0 ? (
        <ul className="flex flex-col gap-3" aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="h-[84px] animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40" />
          ))}
        </ul>
      ) : table.totalItems === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-12 text-center text-sm text-zinc-500">
          {filtered
            ? t("inventory.page.emptyFiltered")
            : canView
              ? canAdd
                ? t("inventory.page.emptyCanAdd")
                : t("inventory.page.empty")
              : t("inventory.page.emptyMine")}
        </div>
      ) : (
        <ul className={cn("flex flex-col gap-3", table.isLoading && "opacity-60")}>
          {table.pageItems.map((item) => (
            <InventoryRow
              key={item.id}
              item={item}
              canView={canView}
              canEdit={canEdit}
              canDelete={canDelete}
              onAction={(action) => (action.kind === "delete" ? void remove(action.item) : open(action))}
            />
          ))}
        </ul>
      )}

      {table.totalItems > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/40">
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
      )}

      {dialog?.kind === "item" && (
        <InventoryItemModal
          item={dialog.item}
          state={submit}
          onClose={() => setDialog(null)}
          onSubmit={(input) =>
            void run(
              async () => {
                if (dialog.item) await updateInventoryItem(dialog.item.id, input);
                else await createInventoryItem(input);
                log(dialog.item ? "update" : "create", `Envanter ${dialog.item ? "güncellendi" : "eklendi"}: ${input.name}`, dialog.item);
              },
              dialog.item ? t("inventory.page.updated") : t("inventory.page.created"),
              t("inventory.page.saveFailed")
            )
          }
        />
      )}
      {dialog?.kind === "assign" && (
        <AssignModal
          item={dialog.item}
          state={submit}
          onClose={() => setDialog(null)}
          onSubmit={(input) =>
            void run(
              async () => {
                const existing = dialog.item.assignment;
                if (existing) await updateAssignment(existing.id, input);
                else await assignInventoryItem(dialog.item.id, input);
                log(
                  existing ? "assignment_update" : "assign",
                  existing
                    ? `Zimmet güncellendi: ${dialog.item.name} → ${input.assigneeName}`
                    : `Zimmetlendi: ${dialog.item.name} → ${input.assigneeName}`,
                  dialog.item
                );
              },
              dialog.item.assignment
                ? t("inventory.page.assignmentUpdated")
                : t("inventory.page.assigned", { name: dialog.item.name }),
              t("inventory.page.assignmentFailed")
            )
          }
        />
      )}
      {dialog?.kind === "return" && dialog.item.assignment && (
        <ReturnModal
          item={dialog.item}
          state={submit}
          onClose={() => setDialog(null)}
          onSubmit={(input, markMaintenance) =>
            void run(
              async () => {
                await returnInventoryItem(dialog.item.assignment!.id, input, {
                  itemId: dialog.item.id,
                  markMaintenance,
                });
                log("return", `Teslim alındı: ${dialog.item.name} ← ${dialog.item.assignment!.assigneeName}`, dialog.item);
              },
              t("inventory.page.returned", { name: dialog.item.name }),
              t("inventory.page.returnFailed")
            )
          }
        />
      )}
      {dialog?.kind === "history" && <HistoryModal item={dialog.item} onClose={() => setDialog(null)} />}
    </div>
  );
}

export default function InventoryPage() {
  return (
    <AuthGuard routeKey="inventory">
      <InventoryContent />
    </AuthGuard>
  );
}

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ApprovalSwitches } from "@/components/projects/approval-switches";
import {
  DataTable,
  TablePagination,
  type DataTableColumn,
} from "@/components/modules/module-table";
import { useStores } from "@/contexts/stores-context";
import { useT } from "@/contexts/i18n-context";
import { useTableState } from "@/hooks/use-table-state";
import { usePermissions } from "@/hooks/use-permissions";
import { getProjectStatusLabel } from "@/lib/project-status";
import { cn } from "@/lib/utils";
import { emptyApprovals, type Store } from "@/types";

type Tab = "all" | "pending";
type SortKey = "name" | "city" | "status" | "approvals" | "actions";

const COLUMNS: DataTableColumn<SortKey>[] = [
  { key: "name", label: "Ad" },
  { key: "city", label: "Şehir" },
  { key: "status", label: "Durum" },
  { key: "approvals", label: "Onaylar" },
  { key: "actions", label: "" },
];

function approvalCount(store: Store) {
  const a = store.approvals ?? emptyApprovals();
  return [
    a.architectural.approved,
    a.mechanical.approved,
    a.electrical.approved,
  ].filter(Boolean).length;
}

function isPendingApproval(store: Store) {
  const a = store.approvals ?? emptyApprovals();
  return (
    !a.architectural.approved ||
    !a.mechanical.approved ||
    !a.electrical.approved ||
    !a.projectOpened
  );
}

function StoresList() {
  const searchParams = useSearchParams();
  const initialTab =
    searchParams.get("tab") === "pending" ? "pending" : "all";
  const [tab, setTab] = useState<Tab>(initialTab);
  const { stores } = useStores();
  const { canEdit } = usePermissions("stores");
  const t = useT();

  const filtered = useMemo(() => {
    if (tab === "pending") return stores.filter(isPendingApproval);
    return stores;
  }, [stores, tab]);

  const getSortValue = useCallback((store: Store, key: SortKey) => {
    if (key === "actions") return "";
    if (key === "status") return store.projectStatus;
    if (key === "approvals") return approvalCount(store);
    return store[key];
  }, []);

  const table = useTableState<Store, SortKey>({
    items: filtered,
    initialSort: { key: "name", direction: "asc" },
    getSortValue,
    resetKey: `${tab}|${filtered.length}`,
  });

  const pendingCount = useMemo(
    () => stores.filter(isPendingApproval).length,
    [stores]
  );

  return (
    <div className="scrollbar-themed h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            {t("modules.storesTitle")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t("modules.storesDescription")}
          </p>
        </div>
        <Link
          href="/map"
          className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-300 hover:bg-cyan-500/20"
        >
          {t("nav.map")}
        </Link>
      </div>

      <div className="mb-4 flex gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 p-1">
        <button
          type="button"
          onClick={() => setTab("all")}
          className={cn(
            "rounded-md px-4 py-2 text-sm transition-colors",
            tab === "all"
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          Tümü ({stores.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("pending")}
          className={cn(
            "rounded-md px-4 py-2 text-sm transition-colors",
            tab === "pending"
              ? "bg-amber-500/20 text-amber-200"
              : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          Onay Bekleyenler ({pendingCount})
        </button>
      </div>

      {tab === "pending" && table.totalItems > 0 && (
        <div className="mb-4 hidden gap-3 lg:grid">
          {table.pageItems.map((store) => (
            <div
              key={store.id}
              className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"
            >
              <Link
                href={`/stores/${store.id}`}
                className="text-sm font-medium text-cyan-300 hover:underline"
              >
                {store.name}
              </Link>
              <p className="mb-3 text-xs text-zinc-500">{store.city}</p>
              <ApprovalSwitches store={store} compact />
            </div>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/40">
        <div className="overflow-x-auto">
          <DataTable
            columns={COLUMNS.map((col) =>
              col.key === "status"
                ? { ...col, label: t("common.status") }
                : col.key === "approvals"
                  ? { ...col, label: t("approvals.title") }
                  : col
            )}
            sortKey={table.sort.key}
            sortDirection={table.sort.direction}
            onSort={table.toggleSort}
            minWidthClassName="min-w-[520px]"
          >
            {table.totalItems === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-600">
                  {t("common.noData")}
                </td>
              </tr>
            )}
            {table.pageItems.map((store) => {
              const done = approvalCount(store);
              return (
                <tr
                  key={store.id}
                  className="border-t border-zinc-800/80 text-zinc-300 hover:bg-zinc-900/40"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/stores/${store.id}`}
                      className="font-medium text-cyan-300 hover:underline"
                    >
                      {store.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{store.city}</td>
                  <td className="px-4 py-3 text-zinc-300">
                    {getProjectStatusLabel(store.projectStatus, t)}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{done}/3</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {canEdit && (
                      <Link
                        href={`/stores/${store.id}/edit`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800/20 hover:text-zinc-100"
                        aria-label="Düzenle"
                        title="Düzenle"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </DataTable>
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

export default function StoresPage() {
  return (
    <AuthGuard routeKey="stores">
      <StoresList />
    </AuthGuard>
  );
}

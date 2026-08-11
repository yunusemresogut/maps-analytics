"use client";

import Link from "next/link";
import { useCallback } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import {
  DataTable,
  TablePagination,
  type DataTableColumn,
} from "@/components/modules/module-table";
import { useStores } from "@/contexts/stores-context";
import { useT } from "@/contexts/i18n-context";
import { useTableState } from "@/hooks/use-table-state";
import { getProjectStatusLabel } from "@/lib/project-status";
import { emptyApprovals, type Store } from "@/types";

type SortKey = "name" | "city" | "status" | "approvals";

const COLUMNS: DataTableColumn<SortKey>[] = [
  { key: "name", label: "Ad" },
  { key: "city", label: "Şehir" },
  { key: "status", label: "Durum" },
  { key: "approvals", label: "Onaylar" },
];

function approvalCount(store: Store) {
  const a = store.approvals ?? emptyApprovals();
  return [
    a.architectural.approved,
    a.mechanical.approved,
    a.electrical.approved,
  ].filter(Boolean).length;
}

function StoresList() {
  const { stores } = useStores();
  const t = useT();

  const getSortValue = useCallback((store: Store, key: SortKey) => {
    if (key === "status") return store.projectStatus;
    if (key === "approvals") return approvalCount(store);
    return store[key];
  }, []);

  const table = useTableState<Store, SortKey>({
    items: stores,
    initialSort: { key: "name", direction: "asc" },
    getSortValue,
  });

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
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-600">
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

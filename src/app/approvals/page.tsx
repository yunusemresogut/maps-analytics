"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { TablePagination } from "@/components/modules/module-table";
import { useStores } from "@/contexts/stores-context";
import { useT } from "@/contexts/i18n-context";
import { ApprovalSwitches } from "@/components/projects/approval-switches";
import { Select } from "@/components/ui/select";
import { useTableState } from "@/hooks/use-table-state";
import { emptyApprovals, type Store } from "@/types";

type SortKey = "name" | "city" | "approvals";

function approvalCount(store: Store) {
  const a = store.approvals ?? emptyApprovals();
  return [
    a.architectural.approved,
    a.mechanical.approved,
    a.electrical.approved,
  ].filter(Boolean).length;
}

function ApprovalsContent() {
  const { stores } = useStores();
  const t = useT();

  const pending = useMemo(
    () =>
      stores.filter((s) => {
        const a = s.approvals ?? emptyApprovals();
        return (
          !a.architectural.approved ||
          !a.mechanical.approved ||
          !a.electrical.approved ||
          !a.projectOpened
        );
      }),
    [stores]
  );

  const getSortValue = useCallback((store: Store, key: SortKey) => {
    if (key === "approvals") return approvalCount(store);
    return store[key];
  }, []);

  const table = useTableState<Store, SortKey>({
    items: pending,
    initialSort: { key: "name", direction: "asc" },
    getSortValue,
    resetKey: String(pending.length),
  });

  const onSortKeyChange = (key: SortKey) => {
    if (table.sort.key !== key) {
      table.toggleSort(key);
    }
  };

  return (
    <div className="scrollbar-themed h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            {t("approvals.pendingTitle")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t("approvals.pendingDescription")}
          </p>
        </div>
        <Select
          value={table.sort.key}
          onChange={(e) => onSortKeyChange(e.target.value as SortKey)}
          className="h-10 w-auto min-w-[160px]"
        >
          <option value="name">Ada göre</option>
          <option value="city">Şehre göre</option>
          <option value="approvals">Onay sayısına göre</option>
        </Select>
      </div>

      <div className="grid gap-4">
        {table.totalItems === 0 && (
          <p className="text-sm text-zinc-600">{t("common.noData")}</p>
        )}
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
    </div>
  );
}

export default function ApprovalsPage() {
  return (
    <AuthGuard routeKey="approvals">
      <ApprovalsContent />
    </AuthGuard>
  );
}

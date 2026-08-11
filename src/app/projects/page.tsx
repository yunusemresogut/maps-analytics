"use client";

import Link from "next/link";
import { useCallback } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { TablePagination } from "@/components/modules/module-table";
import { useStores } from "@/contexts/stores-context";
import { useT } from "@/contexts/i18n-context";
import { ApprovalSwitches } from "@/components/projects/approval-switches";
import { Select } from "@/components/ui/select";
import { useTableState } from "@/hooks/use-table-state";
import { getProjectStatusLabel } from "@/lib/project-status";
import { emptyApprovals, type Store } from "@/types";

type SortKey = "name" | "city" | "status" | "approvals";

function approvalCount(store: Store) {
  const a = store.approvals ?? emptyApprovals();
  return [
    a.architectural.approved,
    a.mechanical.approved,
    a.electrical.approved,
  ].filter(Boolean).length;
}

function ProjectsContent() {
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
            {t("modules.projectsTitle")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t("modules.projectsDescription")}
          </p>
        </div>
        <Select
          value={table.sort.key}
          onChange={(e) => onSortKeyChange(e.target.value as SortKey)}
          className="h-10 w-auto min-w-[160px]"
        >
          <option value="name">Ada göre</option>
          <option value="city">Şehre göre</option>
          <option value="status">Duruma göre</option>
          <option value="approvals">Onay sayısına göre</option>
        </Select>
      </div>

      <div className="grid gap-4">
        {table.totalItems === 0 && (
          <p className="text-sm text-zinc-600">{t("common.noData")}</p>
        )}
        {table.pageItems.map((store) => {
          const a = store.approvals ?? emptyApprovals();
          return (
            <div
              key={store.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4"
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link
                    href={`/stores/${store.id}`}
                    className="text-sm font-medium text-cyan-300 hover:underline"
                  >
                    {store.name}
                  </Link>
                  <p className="text-xs text-zinc-500">
                    {store.city} ·{" "}
                    {getProjectStatusLabel(store.projectStatus, t)}
                  </p>
                </div>
                <span className="text-xs text-zinc-500">
                  {[
                    a.architectural.approved,
                    a.mechanical.approved,
                    a.electrical.approved,
                  ].filter(Boolean).length}
                  /3
                </span>
              </div>
              <ApprovalSwitches store={store} compact />
            </div>
          );
        })}
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

export default function ProjectsPage() {
  return (
    <AuthGuard routeKey="projects">
      <ProjectsContent />
    </AuthGuard>
  );
}

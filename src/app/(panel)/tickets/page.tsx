"use client";


import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import {
  DataTable,
  ModuleTableShell,
  StatusBadge,
  TablePagination,
  type DataTableColumn,
} from "@/components/modules/module-table";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useModules } from "@/contexts/modules-context";
import { mapTicket } from "@/contexts/db-context";
import { useT } from "@/contexts/i18n-context";
import { TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS } from "@/lib/module-finance";
import { usePermissions } from "@/hooks/use-permissions";
import { useServerTable } from "@/hooks/use-server-table";
import type { Ticket } from "@/types";
import { usePersistentState } from "@/hooks/use-persistent-state";

type SortKey = "code" | "title" | "storeName" | "priority" | "status" | "assignee" | "actions";

function getColumns(t: ReturnType<typeof useT>): DataTableColumn<SortKey>[] {
  return [
    { key: "code", label: t("finance.shared.code") },
    { key: "title", label: t("finance.shared.title") },
    { key: "storeName", label: t("finance.shared.store") },
    { key: "priority", label: t("finance.shared.priority") },
    { key: "status", label: t("finance.shared.status") },
    { key: "assignee", label: t("finance.shared.assignee") },
    { key: "actions", label: "" },
  ];
}

type TicketRow = Ticket & { storeName: string; assignee: string };

function mapTicketRow(row: Record<string, unknown>): TicketRow {
  const ticket = mapTicket(row);
  return {
    ...ticket,
    storeName: typeof row.store_name === "string" ? row.store_name : "—",
    assignee: ticket.assigneeName ?? "—",
  };
}

const SORT_COLUMNS: Partial<Record<SortKey, string>> = {
  code: "code",
  title: "title",
  storeName: "store_name",
  priority: "priority",
  status: "status",
  assignee: "assignee_name",
};
const SEARCH_COLUMNS = ["code", "title", "store_name", "assignee_name"];

function TicketsContent() {
  const t = useT();
  const router = useRouter();
  const { tickets, deleteTicket } = useModules();
  const { canAdd, canEdit, canDelete } = usePermissions("tickets");
  const [query, setQuery] = usePersistentState("tickets", "query", "");
  const [status, setStatus] = usePersistentState("tickets", "status", "all");
  const [priority, setPriority] = usePersistentState("tickets", "priority", "all");

  const table = useServerTable<TicketRow, SortKey>({
    memoryKey: "tickets",
    source: "tickets_list",
    mapRow: mapTicketRow,
    searchColumns: SEARCH_COLUMNS,
    search: query,
    filters: { status, priority },
    sortColumns: SORT_COLUMNS,
    initialSort: { key: "code", direction: "asc" },
    // Ekleme/düzenleme/silme sonrası listeyi tazele
    refreshKey: tickets,
  });

  const handleDelete = async (id: string, title: string) => {
    if (!canDelete || !confirm(t("finance.shared.deleteNamedConfirm", { name: title }))) return;
    await deleteTicket(id);
  };

  return (
    <ModuleTableShell
      title={t("finance.tickets.title")}
      description={t("finance.tickets.description")}
      headerAction={
        canAdd ? (
          <Button size="sm" onClick={() => router.push("/tickets/new")}>
            <Plus className="h-3.5 w-3.5" />
            {t("finance.shared.new")}
          </Button>
        ) : undefined
      }
      toolbar={
        <>
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("finance.tickets.searchPlaceholder")}
            aria-label={t("finance.tickets.searchLabel")}
            containerClassName="w-full max-w-sm"
            className="h-10"
          />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 w-auto min-w-[160px]">
            <option value="all">{t("finance.shared.allStatuses")}</option>
            {Object.entries(TICKET_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-10 w-auto min-w-[160px]">
            <option value="all">{t("finance.tickets.allPriorities")}</option>
            {Object.entries(TICKET_PRIORITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </>
      }
      footer={
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
      }
    >
      <DataTable columns={getColumns(t)} sortKey={table.sort.key} sortDirection={table.sort.direction} onSort={table.toggleSort}>
        {table.pageItems.map((item) => (
          <tr key={item.id} className="text-zinc-300 hover:bg-zinc-900/50">
            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-cyan-400/90">{item.code ?? "—"}</td>
            <td className="max-w-[280px] px-4 py-3 font-medium text-zinc-100">
              <Link href={`/tickets/${item.id}`} className="hover:text-cyan-300 hover:underline">
                {item.title}
              </Link>
            </td>
            <td className="whitespace-nowrap px-4 py-3">{item.storeName}</td>
            <td className="px-4 py-3"><StatusBadge value={item.priority} label={TICKET_PRIORITY_LABELS[item.priority]} /></td>
            <td className="px-4 py-3"><StatusBadge value={item.status} label={TICKET_STATUS_LABELS[item.status]} /></td>
            <td className="whitespace-nowrap px-4 py-3 text-zinc-400">{item.assignee}</td>
            <td className="whitespace-nowrap px-4 py-3">
              <div className="flex gap-1">
                {canEdit && (
                  <Link
                    href={`/tickets/${item.id}/edit`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800/20 hover:text-zinc-100"
                    aria-label={t("common.edit")}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                )}
                {canDelete && (
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id, item.title)} aria-label={t("common.delete")}>
                    <Trash2 className="h-3.5 w-3.5 text-red-400/80" />
                  </Button>
                )}
              </div>
            </td>
          </tr>
        ))}
        {!table.isLoading && table.totalItems === 0 && (
          <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-zinc-600">{t("finance.shared.noRecords")}</td></tr>
        )}
      </DataTable>
    </ModuleTableShell>
  );
}

export default function TicketsPage() {
  return (
    <AuthGuard routeKey="tickets">
      <TicketsContent />
    </AuthGuard>
  );
}

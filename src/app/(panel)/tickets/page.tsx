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
import { usePermissions } from "@/hooks/use-permissions";
import { useServerTable } from "@/hooks/use-server-table";
import type { Ticket } from "@/types";
import { usePersistentState } from "@/hooks/use-persistent-state";

const PRIORITY_TR: Record<string, string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
};

const STATUS_TR: Record<string, string> = {
  open: "Açık",
  in_progress: "Devam ediyor",
  resolved: "Çözüldü",
  closed: "Kapalı",
};

type SortKey = "code" | "title" | "storeName" | "priority" | "status" | "assignee" | "actions";

const COLUMNS: DataTableColumn<SortKey>[] = [
  { key: "code", label: "Kod" },
  { key: "title", label: "Başlık" },
  { key: "storeName", label: "Saha" },
  { key: "priority", label: "Öncelik" },
  { key: "status", label: "Durum" },
  { key: "assignee", label: "Atanan" },
  { key: "actions", label: "" },
];

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
    if (!canDelete || !confirm(`"${title}" silinsin mi?`)) return;
    await deleteTicket(id);
  };

  return (
    <ModuleTableShell
      title="Tadilat Talepleri"
      description="Saha tadilat ve bakım talepleri."
      headerAction={
        canAdd ? (
          <Button size="sm" onClick={() => router.push("/tickets/new")}>
            <Plus className="h-3.5 w-3.5" />
            Yeni
          </Button>
        ) : undefined
      }
      toolbar={
        <>
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kod, saha, başlık veya atanandan ara…"
            aria-label="Tadilat taleplerinde ara"
            containerClassName="w-full max-w-sm"
            className="h-10"
          />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 w-auto min-w-[160px]">
            <option value="all">Tüm durumlar</option>
            {Object.entries(STATUS_TR).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="h-10 w-auto min-w-[160px]">
            <option value="all">Tüm öncelikler</option>
            {Object.entries(PRIORITY_TR).map(([k, v]) => (
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
      <DataTable columns={COLUMNS} sortKey={table.sort.key} sortDirection={table.sort.direction} onSort={table.toggleSort}>
        {table.pageItems.map((item) => (
          <tr key={item.id} className="text-zinc-300 hover:bg-zinc-900/50">
            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-cyan-400/90">{item.code ?? "—"}</td>
            <td className="max-w-[280px] px-4 py-3 font-medium text-zinc-100">
              <Link href={`/tickets/${item.id}`} className="hover:text-cyan-300 hover:underline">
                {item.title}
              </Link>
            </td>
            <td className="whitespace-nowrap px-4 py-3">{item.storeName}</td>
            <td className="px-4 py-3"><StatusBadge value={item.priority} label={PRIORITY_TR[item.priority]} /></td>
            <td className="px-4 py-3"><StatusBadge value={item.status} label={STATUS_TR[item.status]} /></td>
            <td className="whitespace-nowrap px-4 py-3 text-zinc-400">{item.assignee}</td>
            <td className="whitespace-nowrap px-4 py-3">
              <div className="flex gap-1">
                {canEdit && (
                  <Link
                    href={`/tickets/${item.id}/edit`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800/20 hover:text-zinc-100"
                    aria-label="Düzenle"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                )}
                {canDelete && (
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id, item.title)} aria-label="Sil">
                    <Trash2 className="h-3.5 w-3.5 text-red-400/80" />
                  </Button>
                )}
              </div>
            </td>
          </tr>
        ))}
        {!table.isLoading && table.totalItems === 0 && (
          <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-zinc-600">Kayıt bulunamadı.</td></tr>
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

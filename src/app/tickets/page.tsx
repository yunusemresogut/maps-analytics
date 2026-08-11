"use client";

import { useCallback, useMemo, useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import {
  DataTable,
  ModuleTableShell,
  StatCard,
  StatusBadge,
  TablePagination,
  type DataTableColumn,
} from "@/components/modules/module-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DEMO_TICKETS, type DemoTicket } from "@/data/demo-modules";
import { useT } from "@/contexts/i18n-context";
import { useTableState } from "@/hooks/use-table-state";

const PRIORITY_TR: Record<string, string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
  critical: "Kritik",
};

const STATUS_TR: Record<string, string> = {
  open: "Açık",
  in_progress: "Devam ediyor",
  waiting: "Beklemede",
  resolved: "Çözüldü",
  closed: "Kapalı",
};

const PRIORITY_ORDER: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

type SortKey =
  | "code"
  | "title"
  | "storeName"
  | "category"
  | "priority"
  | "status"
  | "assignee"
  | "dueDate";

const COLUMNS: DataTableColumn<SortKey>[] = [
  { key: "code", label: "Kod" },
  { key: "title", label: "Başlık" },
  { key: "storeName", label: "Mağaza" },
  { key: "category", label: "Kategori" },
  { key: "priority", label: "Öncelik" },
  { key: "status", label: "Durum" },
  { key: "assignee", label: "Atanan" },
  { key: "dueDate", label: "Termin" },
];

function TicketsContent() {
  const t = useT();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    return DEMO_TICKETS.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (priority !== "all" && item.priority !== priority) return false;
      if (!q) return true;
      return [
        item.code,
        item.title,
        item.storeName,
        item.city,
        item.assignee,
        item.category,
      ]
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(q);
    });
  }, [query, status, priority]);

  const getSortValue = useCallback((item: DemoTicket, key: SortKey) => {
    if (key === "priority") return PRIORITY_ORDER[item.priority] ?? 0;
    if (key === "storeName") return `${item.storeName} ${item.city}`;
    return item[key];
  }, []);

  const table = useTableState<DemoTicket, SortKey>({
    items: filtered,
    initialSort: { key: "dueDate", direction: "asc" },
    getSortValue,
    resetKey: `${query}|${status}|${priority}`,
  });

  const openCount = DEMO_TICKETS.filter((x) =>
    ["open", "in_progress", "waiting"].includes(x.status)
  ).length;
  const criticalCount = DEMO_TICKETS.filter(
    (x) => x.priority === "critical" || x.priority === "high"
  ).length;
  const waitingCount = DEMO_TICKETS.filter((x) => x.status === "waiting").length;

  return (
    <ModuleTableShell
      title={t("modules.ticketsTitle")}
      description="Mağaza şantiyeleri ve proje ekipleri için talep / arıza / onay takibi. Statik demo kayıtlar."
      stats={
        <>
          <StatCard label="Toplam ticket" value={DEMO_TICKETS.length} />
          <StatCard label="Aktif" value={openCount} hint="Açık + devam + beklemede" />
          <StatCard label="Yüksek öncelik" value={criticalCount} />
          <StatCard label="Onay bekleyen" value={waitingCount} />
        </>
      }
      toolbar={
        <>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kod, mağaza, başlık veya atanandan ara…"
            className="h-10 max-w-sm border-zinc-700/80 bg-zinc-900/80"
          />
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-10 w-auto min-w-[160px]"
          >
            <option value="all">Tüm durumlar</option>
            {Object.entries(STATUS_TR).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <Select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="h-10 w-auto min-w-[160px]"
          >
            <option value="all">Tüm öncelikler</option>
            {Object.entries(PRIORITY_TR).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
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
      <DataTable
        columns={COLUMNS}
        sortKey={table.sort.key}
        sortDirection={table.sort.direction}
        onSort={table.toggleSort}
      >
        {table.pageItems.map((item) => (
          <tr
            key={item.id}
            className="text-zinc-300 transition-colors hover:bg-zinc-900/50"
          >
            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-cyan-400/90">
              {item.code}
            </td>
            <td className="max-w-[280px] px-4 py-3">
              <p className="font-medium text-zinc-100">{item.title}</p>
              <p className="mt-0.5 text-xs text-zinc-600">
                {item.createdBy} · {item.createdAt}
              </p>
            </td>
            <td className="whitespace-nowrap px-4 py-3">
              <p>{item.storeName}</p>
              <p className="text-xs text-zinc-600">{item.city}</p>
            </td>
            <td className="whitespace-nowrap px-4 py-3 capitalize text-zinc-400">
              {item.category}
            </td>
            <td className="px-4 py-3">
              <StatusBadge
                value={item.priority}
                label={PRIORITY_TR[item.priority]}
              />
            </td>
            <td className="px-4 py-3">
              <StatusBadge value={item.status} label={STATUS_TR[item.status]} />
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-zinc-400">
              {item.assignee}
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
              {item.dueDate}
            </td>
          </tr>
        ))}
        {table.totalItems === 0 && (
          <tr>
            <td
              colSpan={8}
              className="px-4 py-10 text-center text-sm text-zinc-600"
            >
              Filtreye uyan ticket bulunamadı.
            </td>
          </tr>
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

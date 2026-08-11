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
import {
  DEMO_CONTRACTS,
  formatTry,
  type DemoContract,
} from "@/data/demo-modules";
import { useT } from "@/contexts/i18n-context";
import { useTableState } from "@/hooks/use-table-state";

const STATUS_TR: Record<string, string> = {
  draft: "Taslak",
  active: "Aktif",
  pending_signature: "İmza bekliyor",
  expired: "Süresi doldu",
  cancelled: "İptal",
};

const TYPE_TR: Record<string, string> = {
  yüklenici: "Yüklenici",
  "alt yüklenici": "Alt yüklenici",
  kiralama: "Kiralama",
  danışmanlık: "Danışmanlık",
  malzeme: "Malzeme",
};

type SortKey =
  | "code"
  | "title"
  | "storeName"
  | "partyName"
  | "type"
  | "amount"
  | "startDate"
  | "status";

const COLUMNS: DataTableColumn<SortKey>[] = [
  { key: "code", label: "Kod" },
  { key: "title", label: "Sözleşme" },
  { key: "storeName", label: "Mağaza" },
  { key: "partyName", label: "Taraf" },
  { key: "type", label: "Tip" },
  { key: "amount", label: "Tutar" },
  { key: "startDate", label: "Süre" },
  { key: "status", label: "Durum" },
];

function ContractsContent() {
  const t = useT();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    return DEMO_CONTRACTS.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (type !== "all" && item.type !== type) return false;
      if (!q) return true;
      return [
        item.code,
        item.title,
        item.storeName,
        item.partyName,
        item.city,
      ]
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(q);
    });
  }, [query, status, type]);

  const getSortValue = useCallback((item: DemoContract, key: SortKey) => {
    if (key === "storeName") return `${item.storeName} ${item.city}`;
    return item[key];
  }, []);

  const table = useTableState<DemoContract, SortKey>({
    items: filtered,
    initialSort: { key: "startDate", direction: "desc" },
    getSortValue,
    resetKey: `${query}|${status}|${type}`,
  });

  const activeCount = DEMO_CONTRACTS.filter((x) => x.status === "active").length;
  const pendingCount = DEMO_CONTRACTS.filter(
    (x) => x.status === "pending_signature"
  ).length;
  const totalValue = DEMO_CONTRACTS.filter((x) =>
    ["active", "pending_signature"].includes(x.status)
  ).reduce((sum, x) => sum + x.amount, 0);

  return (
    <ModuleTableShell
      title={t("modules.contractsTitle")}
      description="Mağaza projelerine bağlı ana / alt yüklenici, kira ve danışmanlık sözleşmeleri. Statik demo kayıtlar."
      stats={
        <>
          <StatCard label="Toplam sözleşme" value={DEMO_CONTRACTS.length} />
          <StatCard label="Aktif" value={activeCount} />
          <StatCard label="İmza bekleyen" value={pendingCount} />
          <StatCard
            label="Aktif portföy"
            value={formatTry(totalValue)}
            hint="Aktif + imza bekleyen"
          />
        </>
      }
      toolbar={
        <>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kod, taraf, mağaza veya başlıktan ara…"
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
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-10 w-auto min-w-[160px]"
          >
            <option value="all">Tüm tipler</option>
            {Object.entries(TYPE_TR).map(([k, v]) => (
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
            <td className="max-w-[260px] px-4 py-3">
              <p className="font-medium text-zinc-100">{item.title}</p>
              {item.signedBy && (
                <p className="mt-0.5 text-xs text-zinc-600">
                  İmza: {item.signedBy}
                </p>
              )}
            </td>
            <td className="whitespace-nowrap px-4 py-3">
              <p>{item.storeName}</p>
              <p className="text-xs text-zinc-600">{item.city}</p>
            </td>
            <td className="max-w-[180px] px-4 py-3 text-zinc-400">
              {item.partyName}
            </td>
            <td className="whitespace-nowrap px-4 py-3 capitalize text-zinc-400">
              {TYPE_TR[item.type] ?? item.type}
            </td>
            <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-100">
              {formatTry(item.amount)}
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500">
              {item.startDate} → {item.endDate}
            </td>
            <td className="px-4 py-3">
              <StatusBadge
                value={item.status}
                label={STATUS_TR[item.status]}
              />
            </td>
          </tr>
        ))}
        {table.totalItems === 0 && (
          <tr>
            <td
              colSpan={8}
              className="px-4 py-10 text-center text-sm text-zinc-600"
            >
              Filtreye uyan sözleşme bulunamadı.
            </td>
          </tr>
        )}
      </DataTable>
    </ModuleTableShell>
  );
}

export default function ContractsPage() {
  return (
    <AuthGuard routeKey="contracts">
      <ContractsContent />
    </AuthGuard>
  );
}

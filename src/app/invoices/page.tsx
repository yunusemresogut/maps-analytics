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
  DEMO_INVOICES,
  formatTry,
  type DemoInvoice,
} from "@/data/demo-modules";
import { useT } from "@/contexts/i18n-context";
import { useTableState } from "@/hooks/use-table-state";

const STATUS_TR: Record<string, string> = {
  draft: "Taslak",
  issued: "Kesildi",
  partially_paid: "Kısmi ödeme",
  paid: "Ödendi",
  overdue: "Vadesi geçti",
  cancelled: "İptal",
};

const TYPE_TR: Record<string, string> = {
  hakediş: "Hakediş",
  malzeme: "Malzeme",
  hizmet: "Hizmet",
  kira: "Kira",
};

type SortKey =
  | "invoiceNumber"
  | "storeName"
  | "vendor"
  | "type"
  | "amount"
  | "taxAmount"
  | "totalAmount"
  | "dueAt"
  | "status";

const COLUMNS: DataTableColumn<SortKey>[] = [
  { key: "invoiceNumber", label: "Fatura no" },
  { key: "storeName", label: "Mağaza" },
  { key: "vendor", label: "Satıcı" },
  { key: "type", label: "Tip" },
  { key: "amount", label: "Matrah" },
  { key: "taxAmount", label: "KDV" },
  { key: "totalAmount", label: "Toplam" },
  { key: "dueAt", label: "Vade" },
  { key: "status", label: "Durum" },
];

function InvoicesContent() {
  const t = useT();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    return DEMO_INVOICES.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (type !== "all" && item.type !== type) return false;
      if (!q) return true;
      return [
        item.invoiceNumber,
        item.storeName,
        item.vendor,
        item.city,
        item.relatedPaymentCode ?? "",
      ]
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(q);
    });
  }, [query, status, type]);

  const getSortValue = useCallback((item: DemoInvoice, key: SortKey) => {
    if (key === "storeName") return `${item.storeName} ${item.city}`;
    return item[key];
  }, []);

  const table = useTableState<DemoInvoice, SortKey>({
    items: filtered,
    initialSort: { key: "dueAt", direction: "asc" },
    getSortValue,
    resetKey: `${query}|${status}|${type}`,
  });

  const openTotal = DEMO_INVOICES.filter((x) =>
    ["issued", "partially_paid", "overdue"].includes(x.status)
  ).reduce((sum, x) => sum + x.totalAmount, 0);
  const overdueCount = DEMO_INVOICES.filter((x) => x.status === "overdue").length;
  const paidTotal = DEMO_INVOICES.filter((x) => x.status === "paid").reduce(
    (sum, x) => sum + x.totalAmount,
    0
  );

  return (
    <ModuleTableShell
      title={t("modules.invoicesTitle")}
      description="Hakediş, malzeme, hizmet ve kira faturaları — KDV dahil takip. Statik demo kayıtlar."
      stats={
        <>
          <StatCard label="Toplam fatura" value={DEMO_INVOICES.length} />
          <StatCard
            label="Açık bakiye"
            value={formatTry(openTotal)}
            hint="Kesildi + kısmi + vadesi geçen"
          />
          <StatCard label="Vadesi geçen" value={overdueCount} />
          <StatCard label="Ödenen toplam" value={formatTry(paidTotal)} />
        </>
      }
      toolbar={
        <>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Fatura no, satıcı, mağaza veya hakediş kodu…"
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
            className="h-10 w-auto min-w-[140px]"
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
        minWidthClassName="min-w-[900px]"
      >
        {table.pageItems.map((item) => (
          <tr
            key={item.id}
            className="text-zinc-300 transition-colors hover:bg-zinc-900/50"
          >
            <td className="whitespace-nowrap px-4 py-3">
              <p className="font-mono text-xs text-cyan-400/90">
                {item.invoiceNumber}
              </p>
              {item.relatedPaymentCode && (
                <p className="mt-0.5 text-[11px] text-zinc-600">
                  {item.relatedPaymentCode}
                </p>
              )}
            </td>
            <td className="whitespace-nowrap px-4 py-3">
              <p>{item.storeName}</p>
              <p className="text-xs text-zinc-600">{item.city}</p>
            </td>
            <td className="max-w-[180px] px-4 py-3 text-zinc-400">
              {item.vendor}
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-zinc-400">
              {TYPE_TR[item.type] ?? item.type}
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-zinc-400">
              {formatTry(item.amount)}
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
              {formatTry(item.taxAmount)}
            </td>
            <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-100">
              {formatTry(item.totalAmount)}
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500">
              <p>Kesim: {item.issuedAt}</p>
              <p>Vade: {item.dueAt}</p>
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
              colSpan={9}
              className="px-4 py-10 text-center text-sm text-zinc-600"
            >
              Filtreye uyan fatura bulunamadı.
            </td>
          </tr>
        )}
      </DataTable>
    </ModuleTableShell>
  );
}

export default function InvoicesPage() {
  return (
    <AuthGuard routeKey="invoices">
      <InvoicesContent />
    </AuthGuard>
  );
}

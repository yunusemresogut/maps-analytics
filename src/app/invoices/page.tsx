"use client";

import { useCallback, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useModules } from "@/contexts/modules-context";
import { useDb } from "@/contexts/db-context";
import { useStores } from "@/contexts/stores-context";
import { useT } from "@/contexts/i18n-context";
import { usePermissions } from "@/hooks/use-permissions";
import { useTableState } from "@/hooks/use-table-state";
import { formatTry } from "@/lib/currency";
import type { Invoice } from "@/types";

const STATUS_TR: Record<string, string> = {
  draft: "Taslak",
  issued: "Kesildi",
  paid: "Ödendi",
  cancelled: "İptal",
};

type SortKey = "invoiceNumber" | "storeName" | "paymentTitle" | "amount" | "total" | "status" | "actions";

const COLUMNS: DataTableColumn<SortKey>[] = [
  { key: "invoiceNumber", label: "Fatura No" },
  { key: "storeName", label: "Mağaza" },
  { key: "paymentTitle", label: "Hakediş" },
  { key: "amount", label: "Tutar" },
  { key: "total", label: "Toplam" },
  { key: "status", label: "Durum" },
  { key: "actions", label: "" },
];

type InvoiceRow = Invoice & { storeName: string; paymentTitle: string; total: number };

function InvoicesContent() {
  const t = useT();
  const router = useRouter();
  const { invoices, deleteInvoice } = useModules();
  const { progressPayments } = useDb();
  const { stores } = useStores();
  const { canAdd, canEdit, canDelete } = usePermissions("invoices");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const rows: InvoiceRow[] = useMemo(
    () =>
      invoices.map((inv) => ({
        ...inv,
        storeName: stores.find((s) => s.id === inv.storeId)?.name ?? "—",
        paymentTitle: progressPayments.find((p) => p.id === inv.progressPaymentId)?.title ?? "—",
        total: inv.amount + inv.taxAmount,
      })),
    [invoices, stores, progressPayments]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    return rows.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (!q) return true;
      return [item.invoiceNumber, item.storeName, item.paymentTitle]
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(q);
    });
  }, [rows, query, status]);

  const getSortValue = useCallback((item: InvoiceRow, key: SortKey) => {
    if (key === "actions") return "";
    if (key === "total") return item.total;
    if (key === "storeName") return item.storeName;
    if (key === "paymentTitle") return item.paymentTitle;
    return item[key] ?? "";
  }, []);

  const table = useTableState<InvoiceRow, SortKey>({
    items: filtered,
    initialSort: { key: "invoiceNumber", direction: "desc" },
    getSortValue,
    resetKey: `${query}|${status}`,
  });

  const handleDelete = async (id: string, label: string) => {
    if (!canDelete || !confirm(`"${label}" silinsin mi?`)) return;
    await deleteInvoice(id);
  };

  return (
    <ModuleTableShell
      title={t("modules.invoicesTitle")}
      description="Hakedişe bağlı faturalar."
      headerAction={
        canAdd ? (
          <Button size="sm" onClick={() => router.push("/invoices/new")}>
            <Plus className="h-3.5 w-3.5" />
            Yeni
          </Button>
        ) : undefined
      }
      toolbar={
        <>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Fatura no, mağaza…" className="h-10 max-w-sm border-zinc-700/80 bg-zinc-900/80" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 w-auto min-w-[160px]">
            <option value="all">Tüm durumlar</option>
            {Object.entries(STATUS_TR).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </>
      }
      footer={
        <TablePagination page={table.page} totalPages={table.totalPages} totalItems={table.totalItems} rangeStart={table.rangeStart} rangeEnd={table.rangeEnd} onPageChange={table.setPage} pageSize={table.pageSize} onPageSizeChange={table.setPageSize} />
      }
    >
      <DataTable columns={COLUMNS} sortKey={table.sort.key} sortDirection={table.sort.direction} onSort={table.toggleSort} minWidthClassName="min-w-[720px]">
        {table.pageItems.map((item) => (
          <tr key={item.id} className="text-zinc-300 hover:bg-zinc-900/50">
            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-cyan-400/90">{item.invoiceNumber}</td>
            <td className="whitespace-nowrap px-4 py-3">{item.storeName}</td>
            <td className="whitespace-nowrap px-4 py-3 text-zinc-400">{item.paymentTitle}</td>
            <td className="whitespace-nowrap px-4 py-3">{formatTry(item.amount)}</td>
            <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-100">{formatTry(item.total)}</td>
            <td className="px-4 py-3"><StatusBadge value={item.status} label={STATUS_TR[item.status] ?? item.status} /></td>
            <td className="whitespace-nowrap px-4 py-3">
              <div className="flex gap-1">
                {canEdit && (
                  <Link href={`/invoices/${item.id}/edit`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800/20 hover:text-zinc-100" aria-label="Düzenle">
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                )}
                {canDelete && (
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id, item.invoiceNumber)} aria-label="Sil">
                    <Trash2 className="h-3.5 w-3.5 text-red-400/80" />
                  </Button>
                )}
              </div>
            </td>
          </tr>
        ))}
        {table.totalItems === 0 && (
          <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-zinc-600">Kayıt bulunamadı.</td></tr>
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

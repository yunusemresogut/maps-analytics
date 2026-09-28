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
import { paidAmountForPayment } from "@/lib/module-finance";
import type { ProgressPayment } from "@/types";

const STATUS_TR: Record<string, string> = {
  draft: "Taslak",
  submitted: "Gönderildi",
  approved: "Onaylandı",
  paid: "Ödendi",
};

type SortKey = "title" | "storeName" | "contractTitle" | "periodLabel" | "amount" | "paid" | "status" | "actions";

const COLUMNS: DataTableColumn<SortKey>[] = [
  { key: "title", label: "Hakediş" },
  { key: "storeName", label: "Mağaza" },
  { key: "contractTitle", label: "Sözleşme" },
  { key: "periodLabel", label: "Dönem" },
  { key: "amount", label: "Toplam hakediş" },
  { key: "paid", label: "Ödenen" },
  { key: "status", label: "Durum" },
  { key: "actions", label: "" },
];

type PaymentRow = ProgressPayment & { storeName: string; contractTitle: string; paid: number };

function ProgressPaymentsContent() {
  const t = useT();
  const router = useRouter();
  const { progressPayments, deletePayment } = useModules();
  const { contracts, invoices } = useDb();
  const { stores } = useStores();
  const { canAdd, canEdit, canDelete } = usePermissions("progressPayments");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const rows: PaymentRow[] = useMemo(
    () =>
      progressPayments.map((p) => ({
        ...p,
        storeName: stores.find((s) => s.id === p.storeId)?.name ?? "—",
        contractTitle: contracts.find((c) => c.id === p.contractId)?.title ?? "—",
        paid: paidAmountForPayment(p.id, invoices),
      })),
    [progressPayments, stores, contracts, invoices]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    return rows.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (!q) return true;
      return [item.title, item.storeName, item.contractTitle, item.periodLabel]
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(q);
    });
  }, [rows, query, status]);

  const getSortValue = useCallback((item: PaymentRow, key: SortKey) => {
    if (key === "actions") return "";
    if (key === "paid") return item.paid;
    if (key === "storeName") return item.storeName;
    if (key === "contractTitle") return item.contractTitle;
    return item[key] ?? "";
  }, []);

  const table = useTableState<PaymentRow, SortKey>({
    items: filtered,
    initialSort: { key: "periodLabel", direction: "desc" },
    getSortValue,
    resetKey: `${query}|${status}`,
  });

  const handleDelete = async (id: string, title: string) => {
    if (!canDelete || !confirm(`"${title}" silinsin mi?`)) return;
    await deletePayment(id);
  };

  return (
    <ModuleTableShell
      title={t("modules.paymentsTitle")}
      description="Sözleşmeye bağlı hakediş dönemleri."
      headerAction={
        canAdd ? (
          <Button size="sm" onClick={() => router.push("/progress-payments/new")}>
            <Plus className="h-3.5 w-3.5" />
            Yeni
          </Button>
        ) : undefined
      }
      toolbar={
        <>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Hakediş, sözleşme…" className="h-10 max-w-sm border-zinc-700/80 bg-zinc-900/80" />
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
      <DataTable columns={COLUMNS} sortKey={table.sort.key} sortDirection={table.sort.direction} onSort={table.toggleSort} minWidthClassName="min-w-[800px]">
        {table.pageItems.map((item) => (
          <tr key={item.id} className="text-zinc-300 hover:bg-zinc-900/50">
            <td className="max-w-[240px] px-4 py-3 font-medium text-zinc-100">{item.title}</td>
            <td className="whitespace-nowrap px-4 py-3">{item.storeName}</td>
            <td className="whitespace-nowrap px-4 py-3 text-zinc-400">
              {item.contractId ? (
                <Link href={`/contracts/${item.contractId}/edit`} className="hover:text-cyan-300">{item.contractTitle}</Link>
              ) : "—"}
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-zinc-400">{item.periodLabel || "—"}</td>
            <td className="whitespace-nowrap px-4 py-3">{formatTry(item.amount)}</td>
            <td className="whitespace-nowrap px-4 py-3 font-medium text-emerald-300/90">{formatTry(item.paid)}</td>
            <td className="px-4 py-3"><StatusBadge value={item.status} label={STATUS_TR[item.status] ?? item.status} /></td>
            <td className="whitespace-nowrap px-4 py-3">
              <div className="flex gap-1">
                {canEdit && (
                  <Link href={`/progress-payments/${item.id}/edit`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800/20 hover:text-zinc-100" aria-label="Düzenle">
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
        {table.totalItems === 0 && (
          <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-zinc-600">Kayıt bulunamadı.</td></tr>
        )}
      </DataTable>
    </ModuleTableShell>
  );
}

export default function ProgressPaymentsPage() {
  return (
    <AuthGuard routeKey="progressPayments">
      <ProgressPaymentsContent />
    </AuthGuard>
  );
}

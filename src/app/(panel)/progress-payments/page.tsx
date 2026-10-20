"use client";

import { useMemo } from "react";
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
import { mapPayment, useDb } from "@/contexts/db-context";
import { useI18n, useT } from "@/contexts/i18n-context";
import { usePermissions } from "@/hooks/use-permissions";
import { useServerTable } from "@/hooks/use-server-table";
import { formatMoney, formatMoneyTotals, parseMoneyTotals, type MoneyTotals } from "@/lib/currency";
import { formatPaymentPeriod } from "@/lib/module-finance";
import type { ProgressPayment } from "@/types";
import { usePersistentState } from "@/hooks/use-persistent-state";

const STATUS_TR: Record<string, string> = {
  draft: "Taslak",
  submitted: "Gönderildi",
  approved: "Onaylandı",
  paid: "Ödendi",
};

type SortKey = "title" | "storeName" | "contractTitle" | "periodLabel" | "amount" | "paid" | "progress" | "status" | "actions";

const COLUMNS: DataTableColumn<SortKey>[] = [
  { key: "title", label: "Hakediş" },
  { key: "storeName", label: "Mağaza" },
  { key: "contractTitle", label: "Sözleşme" },
  { key: "periodLabel", label: "Dönem" },
  { key: "amount", label: "Toplam hakediş" },
  { key: "paid", label: "Ödenen" },
  { key: "progress", label: "Sözleşme ilerlemesi" },
  { key: "status", label: "Durum" },
  { key: "actions", label: "" },
];

/** paid: hakedişin kendi birimindeki ödenen (sıralama); paidTotals: tüm birimlerde */
type PaymentRow = ProgressPayment & {
  storeName: string;
  contractTitle: string;
  paid: number;
  paidTotals: MoneyTotals;
  progress: number;
};

function mapPaymentRow(row: Record<string, unknown>): PaymentRow {
  return {
    ...mapPayment(row),
    storeName: typeof row.store_name === "string" ? row.store_name : "—",
    contractTitle: typeof row.contract_title === "string" ? row.contract_title : "—",
    paid: Number(row.paid ?? 0),
    paidTotals: parseMoneyTotals(row.paid_totals),
    progress: Number(row.progress ?? 0),
  };
}

const SORT_COLUMNS: Partial<Record<SortKey, string>> = {
  title: "title",
  storeName: "store_name",
  contractTitle: "contract_title",
  periodLabel: "period_label",
  amount: "amount",
  paid: "paid",
  progress: "progress",
  status: "status",
};
const SEARCH_COLUMNS = ["title", "store_name", "contract_title", "period_label"];

function ProgressPaymentsContent() {
  const t = useT();
  const { dateLocale } = useI18n();
  const router = useRouter();
  const { progressPayments, deletePayment } = useModules();
  const { contracts, invoices } = useDb();
  const { canAdd, canEdit, canDelete } = usePermissions("progressPayments");
  const [query, setQuery] = usePersistentState("progress-payments", "query", "");
  const [status, setStatus] = usePersistentState("progress-payments", "status", "all");

  // Ödenen/ilerleme fatura ve sözleşmelerden hesaplanır; bunlar değişince tazele
  const refreshKey = useMemo(
    () => [progressPayments, contracts, invoices],
    [progressPayments, contracts, invoices]
  );

  const table = useServerTable<PaymentRow, SortKey>({
    memoryKey: "progress-payments",
    source: "progress_payments_list",
    mapRow: mapPaymentRow,
    searchColumns: SEARCH_COLUMNS,
    search: query,
    filters: { status },
    sortColumns: SORT_COLUMNS,
    initialSort: { key: "title", direction: "asc" },
    refreshKey,
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
      <DataTable columns={COLUMNS} sortKey={table.sort.key} sortDirection={table.sort.direction} onSort={table.toggleSort} minWidthClassName="min-w-[960px]">
        {table.pageItems.map((item) => (
          <tr key={item.id} className="text-zinc-300 hover:bg-zinc-900/50">
            <td className="max-w-[240px] px-4 py-3 font-medium text-zinc-100">{item.title}</td>
            <td className="whitespace-nowrap px-4 py-3">{item.storeName}</td>
            <td className="whitespace-nowrap px-4 py-3 text-zinc-400">
              {item.contractId ? (
                <Link href={`/contracts/${item.contractId}/edit`} className="hover:text-cyan-300">{item.contractTitle}</Link>
              ) : "—"}
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-zinc-400">{formatPaymentPeriod(item.periodLabel, dateLocale)}</td>
            <td className="whitespace-nowrap px-4 py-3">{formatMoney(item.amount, item.currency)}</td>
            <td className="whitespace-nowrap px-4 py-3 font-medium text-emerald-300/90">{formatMoneyTotals(item.paidTotals, item.currency)}</td>
            <td className="min-w-48 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${item.progress}%` }} />
                </div>
                <span className="w-10 text-right text-xs tabular-nums text-zinc-400">{item.progress}%</span>
              </div>
            </td>
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
        {!table.isLoading && table.totalItems === 0 && (
          <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-zinc-600">Kayıt bulunamadı.</td></tr>
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

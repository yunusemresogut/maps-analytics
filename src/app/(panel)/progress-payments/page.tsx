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
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useModules } from "@/contexts/modules-context";
import { mapPayment, useDb } from "@/contexts/db-context";
import { useI18n, useT } from "@/contexts/i18n-context";
import { usePermissions } from "@/hooks/use-permissions";
import { useServerTable } from "@/hooks/use-server-table";
import { formatMoney, formatMoneyTotals, parseMoneyTotals, type MoneyTotals } from "@/lib/currency";
import { formatPaymentPeriod, PAYMENT_STATUS_LABELS } from "@/lib/module-finance";
import type { ProgressPayment } from "@/types";
import { usePersistentState } from "@/hooks/use-persistent-state";


type SortKey = "title" | "storeName" | "contractTitle" | "periodLabel" | "amount" | "paid" | "progress" | "status" | "actions";

function getColumns(t: ReturnType<typeof useT>): DataTableColumn<SortKey>[] {
  return [
    { key: "title", label: t("finance.shared.progressPayment") },
    { key: "storeName", label: t("finance.shared.store") },
    { key: "contractTitle", label: t("finance.shared.contract") },
    { key: "periodLabel", label: t("finance.payments.period") },
    { key: "amount", label: t("finance.payments.totalAmount") },
    { key: "paid", label: t("finance.payments.paid") },
    { key: "progress", label: t("finance.payments.contractProgress") },
    { key: "status", label: t("finance.shared.status") },
    { key: "actions", label: "" },
  ];
}

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
    if (!canDelete || !confirm(t("finance.shared.deleteNamedConfirm", { name: title }))) return;
    await deletePayment(id);
  };

  return (
    <ModuleTableShell
      title={t("modules.paymentsTitle")}
      description={t("finance.payments.description")}
      headerAction={
        canAdd ? (
          <Button size="sm" onClick={() => router.push("/progress-payments/new")}>
            <Plus className="h-3.5 w-3.5" />
            {t("finance.shared.new")}
          </Button>
        ) : undefined
      }
      toolbar={
        <>
          <SearchInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("finance.payments.searchPlaceholder")} aria-label={t("finance.payments.searchLabel")} containerClassName="w-full max-w-sm" className="h-10" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 w-auto min-w-[160px]">
            <option value="all">{t("finance.shared.allStatuses")}</option>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </>
      }
      footer={
        <TablePagination page={table.page} totalPages={table.totalPages} totalItems={table.totalItems} rangeStart={table.rangeStart} rangeEnd={table.rangeEnd} onPageChange={table.setPage} pageSize={table.pageSize} onPageSizeChange={table.setPageSize} />
      }
    >
      <DataTable columns={getColumns(t)} sortKey={table.sort.key} sortDirection={table.sort.direction} onSort={table.toggleSort} minWidthClassName="min-w-[960px]">
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
            <td className="px-4 py-3"><StatusBadge value={item.status} label={PAYMENT_STATUS_LABELS[item.status] ?? item.status} /></td>
            <td className="whitespace-nowrap px-4 py-3">
              <div className="flex gap-1">
                {canEdit && (
                  <Link href={`/progress-payments/${item.id}/edit`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800/20 hover:text-zinc-100" aria-label={t("common.edit")}>
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
          <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-zinc-600">{t("finance.shared.noRecords")}</td></tr>
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

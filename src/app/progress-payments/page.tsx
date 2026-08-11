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
  DEMO_PROGRESS_PAYMENTS,
  formatTry,
  type DemoProgressPayment,
} from "@/data/demo-modules";
import { useT } from "@/contexts/i18n-context";
import { useTableState } from "@/hooks/use-table-state";

const STATUS_TR: Record<string, string> = {
  draft: "Taslak",
  submitted: "Gönderildi",
  under_review: "İncelemede",
  approved: "Onaylandı",
  paid: "Ödendi",
  rejected: "Reddedildi",
};

type SortKey =
  | "code"
  | "title"
  | "storeName"
  | "contractor"
  | "periodLabel"
  | "progressPercent"
  | "amount"
  | "netAmount"
  | "status";

const COLUMNS: DataTableColumn<SortKey>[] = [
  { key: "code", label: "Kod" },
  { key: "title", label: "Hakediş" },
  { key: "storeName", label: "Mağaza" },
  { key: "contractor", label: "Yüklenici" },
  { key: "periodLabel", label: "Dönem" },
  { key: "progressPercent", label: "İlerleme" },
  { key: "amount", label: "Brüt" },
  { key: "netAmount", label: "Net" },
  { key: "status", label: "Durum" },
];

function ProgressPaymentsContent() {
  const t = useT();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    return DEMO_PROGRESS_PAYMENTS.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (!q) return true;
      return [
        item.code,
        item.title,
        item.storeName,
        item.contractor,
        item.periodLabel,
        item.city,
      ]
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(q);
    });
  }, [query, status]);

  const getSortValue = useCallback(
    (item: DemoProgressPayment, key: SortKey) => {
      if (key === "storeName") return `${item.storeName} ${item.city}`;
      return item[key];
    },
    []
  );

  const table = useTableState<DemoProgressPayment, SortKey>({
    items: filtered,
    initialSort: { key: "periodLabel", direction: "desc" },
    getSortValue,
    resetKey: `${query}|${status}`,
  });

  const underReview = DEMO_PROGRESS_PAYMENTS.filter((x) =>
    ["submitted", "under_review"].includes(x.status)
  ).length;
  const approvedNet = DEMO_PROGRESS_PAYMENTS.filter((x) =>
    ["approved", "paid"].includes(x.status)
  ).reduce((sum, x) => sum + x.netAmount, 0);
  const retentionTotal = DEMO_PROGRESS_PAYMENTS.reduce(
    (sum, x) => sum + x.retentionAmount,
    0
  );

  return (
    <ModuleTableShell
      title={t("modules.paymentsTitle")}
      description="Şantiye ilerleme yüzdesine göre yüklenici hakediş dönemleri, kesinti ve net tutarlar. Statik demo kayıtlar."
      stats={
        <>
          <StatCard
            label="Toplam hakediş"
            value={DEMO_PROGRESS_PAYMENTS.length}
          />
          <StatCard label="İncelemede" value={underReview} />
          <StatCard
            label="Onaylı / ödenen net"
            value={formatTry(approvedNet)}
          />
          <StatCard
            label="Toplam teminat kesintisi"
            value={formatTry(retentionTotal)}
            hint="%5 örnek kesinti"
          />
        </>
      }
      toolbar={
        <>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kod, yüklenici, mağaza veya dönem ara…"
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
            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-cyan-400/90">
              {item.code}
            </td>
            <td className="max-w-[240px] px-4 py-3">
              <p className="font-medium text-zinc-100">{item.title}</p>
              <p className="mt-0.5 text-xs text-zinc-600">
                Gönderim: {item.submittedAt}
              </p>
            </td>
            <td className="whitespace-nowrap px-4 py-3">
              <p>{item.storeName}</p>
              <p className="text-xs text-zinc-600">{item.city}</p>
            </td>
            <td className="max-w-[180px] px-4 py-3 text-zinc-400">
              {item.contractor}
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-zinc-400">
              {item.periodLabel}
            </td>
            <td className="px-4 py-3">
              <div className="flex min-w-[100px] items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-cyan-500/80"
                    style={{ width: `${item.progressPercent}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums text-zinc-400">
                  %{item.progressPercent}
                </span>
              </div>
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-zinc-400">
              {formatTry(item.amount)}
              <p className="text-[11px] text-zinc-600">
                Kesinti {formatTry(item.retentionAmount)}
              </p>
            </td>
            <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-100">
              {formatTry(item.netAmount)}
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
              Filtreye uyan hakediş bulunamadı.
            </td>
          </tr>
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

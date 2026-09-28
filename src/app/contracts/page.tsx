"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { contractProgressPercent, paidAmountForContract } from "@/lib/module-finance";
import { cn } from "@/lib/utils";
import type { Contract } from "@/types";

const STATUS_TR: Record<string, string> = {
  draft: "Taslak",
  active: "Aktif",
  expired: "Süresi doldu",
  cancelled: "İptal",
  terminated: "Fesih",
  completed: "Tamamlandı",
};

type SortKey = "code" | "title" | "storeName" | "partyName" | "amount" | "progress" | "status" | "actions";

const COLUMNS: DataTableColumn<SortKey>[] = [
  { key: "code", label: "Kod" },
  { key: "title", label: "Sözleşme" },
  { key: "storeName", label: "Mağaza" },
  { key: "partyName", label: "Taraf" },
  { key: "amount", label: "Tutar" },
  { key: "progress", label: "İlerleme" },
  { key: "status", label: "Durum" },
  { key: "actions", label: "" },
];

type ContractRow = Contract & { storeName: string; progress: number; paid: number };

function ContractsContent() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { contracts, deleteContract } = useModules();
  const { progressPayments, invoices } = useDb();
  const { stores } = useStores();
  const { canAdd, canEdit, canDelete } = usePermissions("contracts");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const newHref = searchParams.get("storeId")
    ? `/contracts/new?storeId=${searchParams.get("storeId")}`
    : "/contracts/new";

  const rows: ContractRow[] = useMemo(
    () =>
      contracts.map((c) => {
        const store = stores.find((s) => s.id === c.storeId);
        const paid = paidAmountForContract(c.id, progressPayments, invoices);
        return {
          ...c,
          storeName: store?.name ?? "—",
          paid,
          progress: contractProgressPercent(c, progressPayments, invoices),
        };
      }),
    [contracts, stores, progressPayments, invoices]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    return rows.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (!q) return true;
      return [item.code, item.title, item.storeName, item.partyName]
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(q);
    });
  }, [rows, query, status]);

  const getSortValue = useCallback((item: ContractRow, key: SortKey) => {
    if (key === "actions") return "";
    if (key === "storeName") return item.storeName;
    if (key === "progress") return item.progress;
    if (key === "amount") return item.amount;
    return item[key] ?? "";
  }, []);

  const table = useTableState<ContractRow, SortKey>({
    items: filtered,
    initialSort: { key: "title", direction: "asc" },
    getSortValue,
    resetKey: `${query}|${status}`,
  });

  const handleDelete = async (id: string, title: string) => {
    if (!canDelete || !confirm(`"${title}" silinsin mi?`)) return;
    await deleteContract(id);
  };

  return (
    <ModuleTableShell
      title={t("modules.contractsTitle")}
      description="Mağaza projelerine bağlı sözleşmeler."
      headerAction={
        canAdd ? (
          <Button size="sm" onClick={() => router.push(newHref)}>
            <Plus className="h-3.5 w-3.5" />
            Yeni
          </Button>
        ) : undefined
      }
      toolbar={
        <>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Kod, taraf, mağaza…" className="h-10 max-w-sm border-zinc-700/80 bg-zinc-900/80" />
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
      <DataTable columns={COLUMNS} sortKey={table.sort.key} sortDirection={table.sort.direction} onSort={table.toggleSort}>
        {table.pageItems.map((item) => (
          <tr key={item.id} className={cn("text-zinc-300 hover:bg-zinc-900/50", item.status === "terminated" && "text-red-300/90")}>
            <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-cyan-400/90">{item.code ?? "—"}</td>
            <td className="max-w-[260px] px-4 py-3 font-medium text-zinc-100">{item.title}</td>
            <td className="whitespace-nowrap px-4 py-3">{item.storeName}</td>
            <td className="max-w-[180px] px-4 py-3 text-zinc-400">{item.partyName}</td>
            <td className="whitespace-nowrap px-4 py-3">{formatTry(item.amount)}</td>
            <td className="px-4 py-3">
              <span className="text-xs tabular-nums">%{item.progress}</span>
            </td>
            <td className="px-4 py-3">
              <StatusBadge value={item.status} label={STATUS_TR[item.status] ?? item.status} />
            </td>
            <td className="whitespace-nowrap px-4 py-3">
              <div className="flex gap-1">
                {canEdit && (
                  <Link href={`/contracts/${item.id}/edit`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800/20 hover:text-zinc-100" aria-label="Düzenle">
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

export default function ContractsPage() {
  return (
    <AuthGuard routeKey="contracts">
      <ContractsContent />
    </AuthGuard>
  );
}

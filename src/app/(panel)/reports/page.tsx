"use client";

import { useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { ChevronRight, HardHat, Images, Pencil, Eye, Trash2 } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DataTable, TablePagination, type DataTableColumn } from "@/components/modules/module-table";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { useStores } from "@/contexts/stores-context";
import { useServerTable } from "@/hooks/use-server-table";
import { usePersistentState } from "@/hooks/use-persistent-state";
import {
  SITE_REPORTS_SOURCE,
  canModifySiteReport,
  deleteSiteReport,
  mapSiteReportListRow,
  type SiteReportListRow,
} from "@/lib/site-reports";

/** Hazırlanabilen raporlar; yenileri bu listeye eklenir */
const REPORTS = [
  {
    href: "/reports/daily-site",
    icon: HardHat,
    title: "Günlük şantiye raporu",
    description:
      "Şantiye şefinin yöneticilere günlük özeti: personel, yapılan işler, sorunlar, iş güvenliği ve fotoğraflar. PDF olarak alınır.",
  },
];

type SortKey = "reportDate" | "storeName" | "createdByName" | "photoCount" | "updatedAt" | "actions";

const COLUMNS: DataTableColumn<SortKey>[] = [
  { key: "reportDate", label: "Rapor tarihi" },
  { key: "storeName", label: "Şantiye" },
  { key: "createdByName", label: "Hazırlayan" },
  { key: "photoCount", label: "Fotoğraf" },
  { key: "updatedAt", label: "Son değişiklik" },
  { key: "actions", label: "", sortable: false },
];

const SORT_COLUMNS: Partial<Record<SortKey, string>> = {
  reportDate: "report_date",
  storeName: "store_name",
  createdByName: "created_by_name",
  photoCount: "photo_count",
  updatedAt: "updated_at",
};
const SEARCH_COLUMNS = ["store_name", "store_city", "created_by_name"];

function formatDay(value: string) {
  return format(parseISO(value), "d MMM yyyy, EEE", { locale: tr });
}

function formatStamp(value: string) {
  return format(parseISO(value), "d MMM yyyy HH:mm", { locale: tr });
}

function ReportHistory() {
  const { user } = useAuth();
  const { stores } = useStores();
  const [query, setQuery] = usePersistentState("site-reports", "query", "");
  const [storeId, setStoreId] = usePersistentState("site-reports", "store", "all");
  const [version, setVersion] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const table = useServerTable<SiteReportListRow, SortKey>({
    memoryKey: "site-reports",
    source: SITE_REPORTS_SOURCE,
    mapRow: mapSiteReportListRow,
    searchColumns: SEARCH_COLUMNS,
    search: query,
    filters: { store_id: storeId },
    sortColumns: SORT_COLUMNS,
    initialSort: { key: "reportDate", direction: "desc" },
    refreshKey: version,
  });

  const remove = async (row: SiteReportListRow) => {
    if (!confirm(`${row.storeName} · ${formatDay(row.reportDate)} raporu ve fotoğrafları silinsin mi?`)) return;
    setDeletingId(row.id);
    setError("");
    try {
      await deleteSiteReport(row.id);
      setVersion((current) => current + 1);
    } catch (err) {
      console.error("Rapor silinemedi:", err);
      setError("Rapor silinemedi. Tekrar deneyin.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Geçmiş raporlar</h2>
          <p className="text-sm text-zinc-500">Kaydedilen raporlar. Raporu yazan kişi ve yöneticiler düzenleyip silebilir.</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Şantiye, şehir, hazırlayan…"
            aria-label="Raporlarda ara"
            containerClassName="w-full sm:w-64"
            className="h-10"
          />
          <Select value={storeId} onChange={(e) => setStoreId(e.target.value)} className="h-10 w-auto min-w-[180px]">
            <option value="all">Tüm şantiyeler</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40">
        <div className="scrollbar-themed overflow-x-auto">
          <DataTable
            columns={COLUMNS}
            sortKey={table.sort.key}
            sortDirection={table.sort.direction}
            onSort={table.toggleSort}
          >
            {table.pageItems.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-10 text-center text-sm text-zinc-500">
                  {table.isLoading
                    ? "Yükleniyor…"
                    : query || storeId !== "all"
                      ? "Aramayla eşleşen rapor yok."
                      : "Henüz kaydedilmiş rapor yok."}
                </td>
              </tr>
            ) : (
              table.pageItems.map((row) => {
                const canModify = canModifySiteReport(user, row.createdBy);
                return (
                  <tr key={row.id} className="text-zinc-300 hover:bg-zinc-900/50">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-100">
                      <Link href={`/reports/daily-site/${row.id}`} className="hover:text-cyan-300">
                        {formatDay(row.reportDate)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {row.storeName}
                      {row.storeCity && <span className="text-zinc-500"> · {row.storeCity}</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{row.createdByName || "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-400">
                      <span className="inline-flex items-center gap-1.5">
                        <Images className="h-3.5 w-3.5" aria-hidden />
                        {row.photoCount}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-zinc-500">
                      {formatStamp(row.updatedAt ?? row.createdAt)}
                      {row.updatedByName && <span className="block">{row.updatedByName}</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/reports/daily-site/${row.id}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-100"
                          aria-label={canModify ? "Düzenle" : "Görüntüle"}
                          title={canModify ? "Düzenle" : "Görüntüle"}
                        >
                          {canModify ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Link>
                        {canModify && (
                          <button
                            type="button"
                            onClick={() => void remove(row)}
                            disabled={deletingId === row.id}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                            aria-label="Sil"
                            title="Sil"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </DataTable>
        </div>
        {table.totalItems > 0 && (
          <div className="border-t border-zinc-800 px-3 py-2">
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
          </div>
        )}
      </div>
    </section>
  );
}

function ReportsContent() {
  return (
    <div className="scrollbar-themed h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-100">Raporlar</h1>
        <p className="mt-1 text-sm text-zinc-500">Yeni rapor hazırlayın ya da geçmiş raporları açın.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((report) => (
          <li key={report.href}>
            <Link
              href={report.href}
              className="group flex h-full items-start gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition-colors hover:border-zinc-700 hover:bg-zinc-900/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
            >
              <span className="rounded-lg bg-cyan-500/10 p-2.5 text-cyan-400">
                <report.icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2 font-medium text-zinc-100">
                  Yeni {report.title.toLocaleLowerCase("tr-TR")}
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
                <span className="mt-1 block text-sm text-zinc-500">{report.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <ReportHistory />
    </div>
  );
}

export default function ReportsPage() {
  return (
    <AuthGuard routeKey="reports">
      <ReportsContent />
    </AuthGuard>
  );
}

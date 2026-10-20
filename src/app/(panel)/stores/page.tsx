"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { format, parseISO, isValid } from "date-fns";
import { tr } from "date-fns/locale";
import { CalendarDays, Check, Clock3, HardHat, MapPin, Pencil, Ruler, Search } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { TablePagination } from "@/components/modules/module-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useStores } from "@/contexts/stores-context";
import { useT } from "@/contexts/i18n-context";
import { useServerTable } from "@/hooks/use-server-table";
import { mapStoreFromDb } from "@/lib/store-mapper";
import { usePermissions } from "@/hooks/use-permissions";
import { getProjectStatusLabel, projectStatusConfig } from "@/lib/project-status";
import { getOpeningAlert } from "@/lib/opening-dates";
import { cn } from "@/lib/utils";
import { emptyApprovals, type LocationType, type Store } from "@/types";
import { usePersistentState } from "@/hooks/use-persistent-state";

type Tab = "all" | "pending";
type SortKey = "name" | "city" | "status" | "approvals" | "openingDate";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Ada göre" },
  { key: "city", label: "Şehre göre" },
  { key: "status", label: "Duruma göre" },
  { key: "openingDate", label: "Açılış tarihine göre" },
  { key: "approvals", label: "Onay sayısına göre" },
];

const SORT_COLUMNS: Partial<Record<SortKey, string>> = {
  name: "name",
  city: "city",
  status: "project_status",
  approvals: "approval_count",
  openingDate: "opening_date",
};

const SEARCH_COLUMNS = ["name", "city", "district", "address", "contractor_company", "site_manager"];

const LOCATION_LABELS: Record<LocationType, string> = { avm: "AVM", cadde: "Cadde", outdoor: "Outdoor" };

const DISCIPLINES = [
  { key: "architectural", labelKey: "approvals.architectural" },
  { key: "mechanical", labelKey: "approvals.mechanical" },
  { key: "electrical", labelKey: "approvals.electrical" },
] as const;

function isPendingApproval(store: Store) {
  const a = store.approvals ?? emptyApprovals();
  return (
    !a.architectural.approved ||
    !a.mechanical.approved ||
    !a.electrical.approved
  );
}

/** Açılış tarihi ve kalan gün; açılmış mağazada yalnızca tarih */
function OpeningInfo({ store }: { store: Store }) {
  const date = store.openingDate ? parseISO(store.openingDate) : null;
  if (!date || !isValid(date)) return <span className="text-zinc-600">Açılış tarihi yok</span>;
  const alert = getOpeningAlert(store.openingDate);
  const upcoming = !alert.isOverdue && alert.daysUntilOpening >= 0;
  return (
    <span className="min-w-0 truncate">
      {format(date, "d MMM yyyy", { locale: tr })}
      {upcoming && (
        <span className={cn("ml-1.5", alert.isOpeningSoon ? "font-medium text-amber-400" : "text-zinc-500")}>
          · {alert.daysUntilOpening === 0 ? "bugün" : `${alert.daysUntilOpening} gün kaldı`}
        </span>
      )}
    </span>
  );
}

function DetailItem({
  icon: Icon,
  label,
  children,
  muted,
}: {
  icon: typeof MapPin;
  label: string;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
      <div className="min-w-0">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
        <dd className={cn("mt-0.5 truncate text-sm", muted ? "text-zinc-600" : "text-zinc-300")}>{children}</dd>
      </div>
    </div>
  );
}

function StoreCard({ store, canEdit }: { store: Store; canEdit: boolean }) {
  const t = useT();
  const status = projectStatusConfig[store.projectStatus];
  const approvals = store.approvals ?? emptyApprovals();
  const done = DISCIPLINES.filter((d) => approvals[d.key].approved).length;
  const location = [store.district, store.city].filter(Boolean).join(", ");
  const people = [store.contractorCompany, store.siteManager].filter(Boolean).join(" · ");
  const area = [
    LOCATION_LABELS[store.locationType] ?? store.locationType,
    store.grossM2 > 0 ? `${store.grossM2.toLocaleString("tr-TR")} m²` : null,
    store.floorCount > 1 ? `${store.floorCount} kat` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="group relative flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-5 transition-colors hover:border-zinc-700 hover:bg-zinc-900/70 lg:flex-row lg:items-center lg:gap-8">
      {/* Ad, durum ve konum */}
      <div className="flex min-w-0 items-center gap-4 lg:w-[28%] lg:shrink-0">
        <span className="h-14 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: status?.marker }} aria-hidden />
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-zinc-100">
            {/* Satırın tamamı detaya gider */}
            <Link
              href={`/stores/${store.id}`}
              className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none group-focus-within:text-cyan-300"
            >
              {store.name}
            </Link>
          </h2>
          <span
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium"
            style={{ color: status?.marker, borderColor: `${status?.marker}55`, backgroundColor: `${status?.marker}14` }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: status?.marker }} aria-hidden />
            {getProjectStatusLabel(store.projectStatus, t)}
          </span>
          <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-sm text-zinc-500">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{location || store.address || "—"}</span>
          </p>
        </div>
      </div>

      {/* Detaylar */}
      <dl className="grid min-w-0 flex-1 grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
        <DetailItem icon={CalendarDays} label="Açılış">
          <OpeningInfo store={store} />
        </DetailItem>
        <DetailItem icon={Ruler} label="Konum / Alan">
          {area}
        </DetailItem>
        <DetailItem icon={HardHat} label="Yüklenici / Şef" muted={!people}>
          <span title={people || undefined}>{people || "Belirtilmedi"}</span>
        </DetailItem>
      </dl>

      {/* Onaylar ve düzenle */}
      <div className="flex shrink-0 items-center justify-between gap-4 lg:flex-col lg:items-end lg:gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{t("approvals.title")}</span>
          <span className={cn("text-sm font-semibold tabular-nums", done === 3 ? "text-emerald-400" : "text-zinc-300")}>
            {done}/3
          </span>
          {canEdit && (
            <Link
              href={`/stores/${store.id}/edit`}
              className="relative z-10 ml-1 inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-100"
              aria-label={`${store.name} düzenle`}
              title="Düzenle"
            >
              <Pencil className="h-4 w-4" />
            </Link>
          )}
        </div>
        <ul className="flex flex-wrap gap-1.5" aria-label={t("approvals.title")}>
          {DISCIPLINES.map((d) => {
            const approved = approvals[d.key].approved;
            return (
              <li
                key={d.key}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs",
                  approved ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800/60 text-zinc-500"
                )}
              >
                {approved ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Clock3 className="h-3.5 w-3.5" aria-hidden />}
                {t(d.labelKey)}
                <span className="sr-only">{approved ? "onaylandı" : "bekliyor"}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </li>
  );
}

function StoreCardSkeleton() {
  return <li className="h-[106px] animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40" aria-hidden />;
}

function StoresList() {
  const searchParams = useSearchParams();
  const initialTab =
    searchParams.get("tab") === "pending" ? "pending" : "all";
  // URL'de sekme varsa o geçerli; yoksa hatırlanan sekme
  const [tab, setTab] = usePersistentState<Tab>(
    searchParams.get("tab") ? undefined : "stores",
    "tab",
    initialTab
  );
  const { stores } = useStores();
  const { canEdit } = usePermissions("stores");
  const t = useT();
  const [query, setQuery] = usePersistentState("stores", "query", "");

  const table = useServerTable<Store, SortKey>({
    memoryKey: "stores",
    source: "stores_list",
    mapRow: mapStoreFromDb,
    searchColumns: SEARCH_COLUMNS,
    search: query,
    filters: { pending_approval: tab === "pending" ? true : undefined },
    sortColumns: SORT_COLUMNS,
    initialSort: { key: "name", direction: "asc" },
    // Onay değişiklikleri mağaza listesini günceller
    refreshKey: stores,
  });

  const pendingCount = useMemo(
    () => stores.filter(isPendingApproval).length,
    [stores]
  );

  return (
    <div className="scrollbar-themed h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            {t("modules.storesTitle")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t("modules.storesDescription")}
          </p>
        </div>
        <Link
          href="/map"
          className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-300 hover:bg-cyan-500/20"
        >
          {t("nav.map")}
        </Link>
      </div>

      <div className="mb-4 flex gap-1 rounded-lg border border-zinc-800 bg-zinc-950/60 p-1">
        <button
          type="button"
          onClick={() => setTab("all")}
          className={cn(
            "rounded-md px-4 py-2 text-sm transition-colors",
            tab === "all"
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          Tümü ({stores.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("pending")}
          className={cn(
            "rounded-md px-4 py-2 text-sm transition-colors",
            tab === "pending"
              ? "bg-amber-500/20 text-amber-200"
              : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          Onay Bekleyenler ({pendingCount})
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Mağaza, şehir, yüklenici…"
            aria-label="Mağazalarda ara"
            className="pl-9"
          />
        </div>
        <Select
          value={table.sort.key}
          onChange={(e) => {
            table.setSort({ key: e.target.value as SortKey, direction: "asc" });
          }}
          className="w-auto min-w-[190px]"
          aria-label="Sıralama"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </Select>
        <button
          type="button"
          onClick={() =>
            table.setSort({ key: table.sort.key, direction: table.sort.direction === "asc" ? "desc" : "asc" })
          }
          className="h-10 rounded-lg border border-zinc-700/80 px-3 text-sm text-zinc-400 hover:border-zinc-600 hover:text-zinc-100"
          aria-label={table.sort.direction === "asc" ? "Artan sıralama, azalana çevir" : "Azalan sıralama, artana çevir"}
        >
          {table.sort.direction === "asc" ? "Artan ↑" : "Azalan ↓"}
        </button>
      </div>

      {table.isLoading && table.pageItems.length === 0 ? (
        <ul className="flex flex-col gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <StoreCardSkeleton key={i} />
          ))}
        </ul>
      ) : table.totalItems === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-12 text-center text-sm text-zinc-500">
          {query ? "Aramayla eşleşen mağaza yok." : t("common.noData")}
        </div>
      ) : (
        <ul className={cn("flex flex-col gap-3", table.isLoading && "opacity-60")}>
          {table.pageItems.map((store) => (
            <StoreCard key={store.id} store={store} canEdit={canEdit} />
          ))}
        </ul>
      )}

      {table.totalItems > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/40">
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
  );
}

export default function StoresPage() {
  return (
    <AuthGuard routeKey="stores">
      <StoresList />
    </AuthGuard>
  );
}

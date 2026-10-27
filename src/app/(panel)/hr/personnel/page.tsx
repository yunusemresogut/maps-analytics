"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, MapPin, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { PersonnelModal, formatDay, type SubmitState } from "@/components/hr/hr-modals";
import { TablePagination } from "@/components/modules/module-table";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/contexts/i18n-context";
import type { TranslationKey } from "@/i18n";
import { useMyPersonnelId, resetMyPersonnelCache } from "@/hooks/use-my-personnel";
import { usePermissions } from "@/hooks/use-permissions";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { useServerTable } from "@/hooks/use-server-table";
import { logActivity } from "@/lib/activity-log";
import {
  DOCUMENT_STATE_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  PERSONNEL_SEARCH_COLUMNS,
  PERSONNEL_SOURCE,
  PERSONNEL_STATE_LABELS,
  createPersonnel,
  deletePersonnel,
  fetchPersonnelCounts,
  hrErrorMessage,
  mapPersonnelRow,
  updatePersonnel,
  type DocumentState,
  type Personnel,
} from "@/lib/hr";
import { cn } from "@/lib/utils";

type SortKey = "name" | "code" | "type" | "start" | "store";

const SORT_OPTIONS: { key: SortKey; label: TranslationKey; column: string }[] = [
  { key: "name", label: "hr.personnelList.sortName", column: "full_name" },
  { key: "code", label: "hr.personnelList.sortCode", column: "code" },
  { key: "type", label: "hr.personnelList.sortType", column: "employment_type" },
  { key: "start", label: "hr.personnelList.sortStart", column: "start_date" },
  { key: "store", label: "hr.personnelList.sortStore", column: "store_name" },
];
const SORT_COLUMNS = Object.fromEntries(SORT_OPTIONS.map((option) => [option.key, option.column])) as Record<SortKey, string>;

const STAT_CARDS: { key: "active" | DocumentState; label: TranslationKey; tone: string }[] = [
  { key: "active", label: "hr.personnelList.statActive", tone: "text-zinc-100" },
  { key: "expired", label: "hr.personnelList.statExpired", tone: "text-red-400" },
  { key: "expiring", label: "hr.personnelList.statExpiring", tone: "text-amber-400" },
  { key: "pending", label: "hr.personnelList.statPending", tone: "text-teal-300" },
];

const DOCUMENT_BADGE: Record<Exclude<DocumentState, "ok">, string> = {
  expired: "bg-red-500/10 text-red-400 border-red-500/25",
  expiring: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  pending: "bg-teal-500/10 text-teal-300 border-teal-500/25",
};

function DocumentBadges({ person }: { person: Personnel }) {
  const t = useT();
  const badges = [
    person.expiredCount > 0 && { key: "expired" as const, text: t("hr.personnelList.badgeExpired", { count: person.expiredCount }) },
    person.expiringCount > 0 && { key: "expiring" as const, text: t("hr.personnelList.badgeExpiring", { count: person.expiringCount }) },
    person.pendingCount > 0 && { key: "pending" as const, text: t("hr.personnelList.badgePending", { count: person.pendingCount }) },
  ].filter(Boolean) as { key: Exclude<DocumentState, "ok">; text: string }[];

  if (badges.length === 0) {
    return (
      <p className="mt-0.5 text-sm text-zinc-500">
        {person.certificateCount > 0
          ? t(person.certificateCount === 1 ? "hr.personnelList.documentsOkOne" : "hr.personnelList.documentsOkOther", {
              count: person.certificateCount,
            })
          : t("hr.personnelList.noDocuments")}
      </p>
    );
  }
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {badges.map((badge) => (
        <span key={badge.key} className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", DOCUMENT_BADGE[badge.key])}>
          {badge.text}
        </span>
      ))}
    </div>
  );
}

function PersonnelContent() {
  const router = useRouter();
  const t = useT();
  const { user } = useAuth();
  const { canView, canAdd, canEdit, canDelete } = usePermissions("personnel");
  const { myPersonnelId, loaded } = useMyPersonnelId();
  const [query, setQuery] = usePersistentState("personnel", "query", "");
  const [stateFilter, setStateFilter] = usePersistentState("personnel", "state", "active");
  const [typeFilter, setTypeFilter] = usePersistentState("personnel", "type", "all");
  const [documentFilter, setDocumentFilter] = usePersistentState("personnel", "documents", "all");
  const [version, setVersion] = useState(0);
  const [dialog, setDialog] = useState<{ person: Personnel | null } | null>(null);
  const [submit, setSubmit] = useState<SubmitState>({ saving: false, error: "" });
  const [notice, setNotice] = useState("");
  const [counts, setCounts] = useState<Record<"active" | DocumentState, number> | null>(null);

  // Yetkisi olmayan personel doğrudan kendi kartına gider
  useEffect(() => {
    if (!canView && loaded && myPersonnelId) router.replace(`/hr/personnel/${myPersonnelId}`);
  }, [canView, loaded, myPersonnelId, router]);

  const filters = useMemo(
    () => ({
      state: stateFilter,
      employment_type: typeFilter,
      document_state: documentFilter,
    }),
    [stateFilter, typeFilter, documentFilter]
  );
  const table = useServerTable<Personnel, SortKey>({
    memoryKey: "personnel",
    source: PERSONNEL_SOURCE,
    mapRow: mapPersonnelRow,
    searchColumns: PERSONNEL_SEARCH_COLUMNS,
    search: query,
    filters,
    sortColumns: SORT_COLUMNS,
    initialSort: { key: "name", direction: "asc" },
    refreshKey: version,
  });

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    fetchPersonnelCounts()
      .then((next) => !cancelled && setCounts(next))
      .catch((err) => console.error("Personel özeti yüklenemedi:", err));
    return () => {
      cancelled = true;
    };
  }, [canView, version]);

  const log = useCallback(
    (action: string, message: string, person: { id?: string; fullName: string }) => {
      if (!user) return;
      logActivity({
        category: "hr",
        action,
        message,
        actorId: user.id,
        actorName: user.name,
        targetId: person.id,
        targetLabel: person.fullName,
      });
    },
    [user]
  );

  const remove = async (person: Personnel) => {
    if (
      !confirm(
        `${t("hr.personnelList.deleteConfirm", { name: person.fullName })}\n\n${t("hr.personnelList.deleteConfirmHint")}`
      )
    )
      return;
    try {
      await deletePersonnel(person.id);
      resetMyPersonnelCache();
      log("delete", `Personel silindi: ${person.fullName}`, person);
      setVersion((current) => current + 1);
    } catch (err) {
      console.error("Personel silinemedi:", err);
      setNotice(hrErrorMessage(err, t("hr.personnelList.deleteFailed")));
    }
  };

  if (!canView) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-zinc-500">
        {loaded && !myPersonnelId ? t("hr.personnelList.notLinked") : t("hr.common.loading")}
      </div>
    );
  }

  const filtered = query || stateFilter !== "active" || typeFilter !== "all" || documentFilter !== "all";

  return (
    <div className="scrollbar-themed h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">{t("hr.personnelList.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("hr.personnelList.description")}</p>
        </div>
        {canAdd && (
          <Button
            onClick={() => {
              setSubmit({ saving: false, error: "" });
              setDialog({ person: null });
            }}
          >
            <Plus className="h-4 w-4" />
            {t("hr.personnelForm.newTitle")}
          </Button>
        )}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STAT_CARDS.map((card) => {
          const selected = card.key === "active" ? stateFilter === "active" && documentFilter === "all" : documentFilter === card.key;
          return (
            <button
              key={card.key}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setStateFilter("active");
                setDocumentFilter(card.key === "active" || documentFilter === card.key ? "all" : card.key);
              }}
              className={cn(
                "rounded-xl border bg-zinc-900/40 px-4 py-3 text-left transition-colors",
                selected ? "border-cyan-500/50" : "border-zinc-800 hover:border-zinc-700"
              )}
            >
              <p className="text-xs text-zinc-500">{t(card.label)}</p>
              <p className={cn("mt-1 text-2xl font-semibold tabular-nums", card.tone)}>{counts ? counts[card.key] : "–"}</p>
            </button>
          );
        })}
      </div>

      {notice && (
        <p role="status" className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
          {notice}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("hr.personnelList.searchPlaceholder")}
          aria-label={t("hr.personnelList.searchLabel")}
          containerClassName="flex-1 sm:max-w-sm"
        />
        <Select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="w-auto min-w-[140px]" aria-label={t("common.status")}>
          <option value="all">{t("common.all")}</option>
          {Object.entries(PERSONNEL_STATE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-auto min-w-[180px]" aria-label={t("hr.common.employmentType")}>
          <option value="all">{t("hr.personnelList.allTypes")}</option>
          {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select value={documentFilter} onChange={(e) => setDocumentFilter(e.target.value)} className="w-auto min-w-[180px]" aria-label={t("hr.personnelList.documentState")}>
          <option value="all">{t("hr.personnelList.allDocumentStates")}</option>
          {Object.entries(DOCUMENT_STATE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          value={table.sort.key}
          onChange={(e) => table.setSort({ key: e.target.value as SortKey, direction: "asc" })}
          className="w-auto min-w-[170px]"
          aria-label={t("hr.personnelList.sort")}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {t(option.label)}
            </option>
          ))}
        </Select>
      </div>

      {table.error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {t("hr.personnelList.loadFailed")}
        </p>
      )}

      {table.isLoading && table.pageItems.length === 0 ? (
        <ul className="flex flex-col gap-3" aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="h-[84px] animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40" />
          ))}
        </ul>
      ) : table.totalItems === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-12 text-center text-sm text-zinc-500">
          {filtered
            ? t("hr.personnelList.noMatch")
            : canAdd
              ? t("hr.personnelList.emptyCanAdd")
              : t("hr.personnelList.empty")}
        </div>
      ) : (
        <ul className={cn("flex flex-col gap-3", table.isLoading && "opacity-60")}>
          {table.pageItems.map((person) => (
            <li
              key={person.id}
              className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-4 transition-colors hover:border-zinc-700 lg:flex-row lg:items-center lg:gap-8"
            >
              <Link href={`/hr/personnel/${person.id}`} className="group flex min-w-0 items-center gap-4 lg:w-[30%] lg:shrink-0">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-zinc-800/70 text-zinc-400">
                  <UserRound className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="flex min-w-0 items-center gap-2">
                    {person.code && <span className="shrink-0 font-mono text-xs text-zinc-500">{person.code}</span>}
                    <span className="truncate text-base font-semibold text-zinc-100 group-hover:text-cyan-300">{person.fullName}</span>
                  </p>
                  <p className="mt-1 truncate text-sm text-zinc-500">
                    {[person.jobTitle, person.employmentType === "subcontractor" ? person.subcontractorCompany : person.department]
                      .filter(Boolean)
                      .join(" · ") || EMPLOYMENT_TYPE_LABELS[person.employmentType]}
                  </p>
                </div>
              </Link>

              <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{t("hr.personnelList.employment")}</p>
                    <p className="mt-0.5 truncate text-sm text-zinc-200">{EMPLOYMENT_TYPE_LABELS[person.employmentType]}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {person.state === "left"
                        ? t("hr.personnelList.leftOn", { date: formatDay(person.endDate) })
                        : t("hr.personnelList.startedOn", { date: formatDay(person.startDate) })}
                    </p>
                  </div>
                </div>
                <div className="flex min-w-0 items-start gap-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{t("hr.personnelList.location")}</p>
                    <p className={cn("mt-0.5 truncate text-sm", person.storeName ? "text-zinc-200" : "text-zinc-600")}>
                      {person.storeName ?? t("hr.personnelList.headOffice")}
                    </p>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{t("hr.personnelList.documents")}</p>
                  <DocumentBadges person={person} />
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-1.5 lg:justify-end">
                <Button size="sm" variant="outline" onClick={() => router.push(`/hr/personnel/${person.id}`)}>
                  {t("hr.personnelList.openCard")}
                </Button>
                {canEdit && (
                  <button
                    type="button"
                    aria-label={t("common.edit")}
                    title={t("common.edit")}
                    onClick={() => {
                      setSubmit({ saving: false, error: "" });
                      setDialog({ person });
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800/60 hover:text-zinc-100"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    aria-label={t("common.delete")}
                    title={t("common.delete")}
                    onClick={() => void remove(person)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
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

      {dialog && (
        <PersonnelModal
          person={dialog.person}
          state={submit}
          onClose={() => setDialog(null)}
          onSubmit={(input) => {
            setSubmit({ saving: true, error: "" });
            const existing = dialog.person;
            const task = existing ? updatePersonnel(existing.id, input).then(() => existing.id) : createPersonnel(input);
            task
              .then((id) => {
                resetMyPersonnelCache();
                log(existing ? "update" : "create", `Personel ${existing ? "güncellendi" : "eklendi"}: ${input.fullName}`, {
                  id,
                  fullName: input.fullName,
                });
                setDialog(null);
                setVersion((current) => current + 1);
                if (existing) {
                  setNotice(t("hr.personnelList.updated"));
                  window.setTimeout(() => setNotice(""), 3000);
                } else {
                  router.push(`/hr/personnel/${id}`);
                }
              })
              .catch((err) => {
                console.error("Personel kaydedilemedi:", err);
                setSubmit({ saving: false, error: hrErrorMessage(err, t("hr.personnelList.saveFailed")) });
              });
          }}
        />
      )}
    </div>
  );
}

export default function PersonnelPage() {
  return (
    <AuthGuard routeKey="personnel">
      <PersonnelContent />
    </AuthGuard>
  );
}

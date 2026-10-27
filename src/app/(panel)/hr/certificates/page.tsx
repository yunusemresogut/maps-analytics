"use client";

import { inTurkish } from "@/i18n/runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, Clock, FileBadge, FileText, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { CertificateModal, formatDay, type SubmitState } from "@/components/hr/hr-modals";
import { TablePagination } from "@/components/modules/module-table";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/contexts/i18n-context";
import type { TranslationKey } from "@/i18n";
import { useMyPersonnelId } from "@/hooks/use-my-personnel";
import { usePermissions } from "@/hooks/use-permissions";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { useServerTable } from "@/hooks/use-server-table";
import { logActivity } from "@/lib/activity-log";
import {
  CERTIFICATES_SOURCE,
  CERTIFICATE_SEARCH_COLUMNS,
  CERTIFICATE_TYPE_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  VALIDITY_LABELS,
  VALIDITY_STYLES,
  deleteCertificate,
  fetchCertificateCounts,
  getCertificateFileUrl,
  hrErrorMessage,
  mapCertificateRow,
  saveCertificate,
  setCertificateVerified,
  type Certificate,
  type CertificateValidity,
} from "@/lib/hr";
import { cn } from "@/lib/utils";

type SortKey = "expires" | "personnel" | "type";

const SORT_OPTIONS: { key: SortKey; label: TranslationKey; column: string }[] = [
  { key: "expires", label: "hr.certificateList.sortExpires", column: "expires_at" },
  { key: "personnel", label: "hr.certificateList.sortPersonnel", column: "personnel_name" },
  { key: "type", label: "hr.certificateList.sortType", column: "type" },
];
const SORT_COLUMNS = Object.fromEntries(SORT_OPTIONS.map((option) => [option.key, option.column])) as Record<SortKey, string>;

const STAT_CARDS: { key: CertificateValidity | "pending"; label: TranslationKey; tone: string }[] = [
  { key: "expired", label: "hr.certificateList.statExpired", tone: "text-red-400" },
  { key: "expiring", label: "hr.certificateList.statExpiring", tone: "text-amber-400" },
  { key: "pending", label: "hr.personnelDetail.pending", tone: "text-teal-300" },
  { key: "valid", label: "hr.validity.valid", tone: "text-emerald-400" },
];

function CertificatesContent() {
  const router = useRouter();
  const t = useT();
  const { user } = useAuth();
  const { canView, canEdit, canDelete } = usePermissions("personnel");
  const { myPersonnelId, loaded } = useMyPersonnelId();
  const [query, setQuery] = usePersistentState("certificates", "query", "");
  const [validity, setValidity] = usePersistentState("certificates", "validity", "all");
  const [type, setType] = usePersistentState("certificates", "type", "all");
  const [verified, setVerified] = usePersistentState("certificates", "verified", "all");
  const [includeLeft, setIncludeLeft] = usePersistentState("certificates", "includeLeft", false);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<Certificate | null>(null);
  const [submit, setSubmit] = useState<SubmitState>({ saving: false, error: "" });
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [counts, setCounts] = useState<Record<CertificateValidity | "pending", number> | null>(null);

  // Yetkisi olmayan personel kendi kartındaki belgelere gider
  useEffect(() => {
    if (!canView && loaded && myPersonnelId) router.replace(`/hr/personnel/${myPersonnelId}`);
  }, [canView, loaded, myPersonnelId, router]);

  const filters = useMemo(
    () => ({
      validity,
      type,
      verified: verified === "all" ? undefined : verified === "yes",
      // Ayrılan personelin belgeleri varsayılan olarak gizli
      personnel_active: includeLeft ? undefined : true,
    }),
    [validity, type, verified, includeLeft]
  );
  const table = useServerTable<Certificate, SortKey>({
    memoryKey: "certificates",
    source: CERTIFICATES_SOURCE,
    mapRow: mapCertificateRow,
    searchColumns: CERTIFICATE_SEARCH_COLUMNS,
    search: query,
    filters,
    sortColumns: SORT_COLUMNS,
    initialSort: { key: "expires", direction: "asc" },
    refreshKey: version,
  });

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    fetchCertificateCounts()
      .then((next) => !cancelled && setCounts(next))
      .catch((err) => console.error("Belge özeti yüklenemedi:", err));
    return () => {
      cancelled = true;
    };
  }, [canView, version]);

  const flash = (tone: "success" | "error", text: string) => {
    setNotice({ tone, text });
    window.setTimeout(() => setNotice(null), 3500);
  };

  const log = useCallback(
    (action: string, message: string, certificate: Certificate) => {
      if (!user) return;
      logActivity({
        category: "hr",
        action,
        message,
        actorId: user.id,
        actorName: user.name,
        targetId: certificate.personnelId,
        targetLabel: certificate.personnelName,
      });
    },
    [user]
  );

  const label = (certificate: Pick<Certificate, "name" | "type">) => certificate.name || CERTIFICATE_TYPE_LABELS[certificate.type];

  const openFile = async (certificate: Certificate) => {
    if (!certificate.filePath) return;
    const popup = window.open("", "_blank");
    try {
      const url = await getCertificateFileUrl(certificate.filePath);
      if (popup) popup.location.href = url;
      else window.location.assign(url);
    } catch (err) {
      popup?.close();
      console.error("Dosya açılamadı:", err);
      flash("error", t("hr.certificateList.fileOpenFailed"));
    }
  };

  if (!canView) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-zinc-500">
        {loaded && !myPersonnelId ? t("hr.personnelList.notLinked") : t("hr.common.loading")}
      </div>
    );
  }

  const filtered = query || validity !== "all" || type !== "all" || verified !== "all";

  return (
    <div className="scrollbar-themed h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-100">{t("hr.personnelDetail.certificates")}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {t("hr.certificateList.description")}
        </p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STAT_CARDS.map((card) => {
          const selected = card.key === "pending" ? verified === "no" : validity === card.key;
          return (
            <button
              key={card.key}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                if (card.key === "pending") {
                  setValidity("all");
                  setVerified(selected ? "all" : "no");
                } else {
                  setVerified("all");
                  setValidity(selected ? "all" : card.key);
                }
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
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={cn(
            "mb-4 rounded-lg border px-4 py-2.5 text-sm",
            notice.tone === "error" ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          )}
        >
          {notice.text}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("hr.certificateList.searchPlaceholder")}
          aria-label={t("hr.certificateList.searchLabel")}
          containerClassName="flex-1 sm:max-w-sm"
        />
        <Select value={validity} onChange={(e) => setValidity(e.target.value)} className="w-auto min-w-[150px]" aria-label={t("hr.certificateList.validity")}>
          <option value="all">{t("hr.certificateList.allValidities")}</option>
          {Object.entries(VALIDITY_LABELS).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value)} className="w-auto min-w-[180px]" aria-label={t("hr.certificateForm.type")}>
          <option value="all">{t("hr.certificateList.allTypes")}</option>
          {Object.entries(CERTIFICATE_TYPE_LABELS).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </Select>
        <Select value={verified} onChange={(e) => setVerified(e.target.value)} className="w-auto min-w-[140px]" aria-label={t("hr.certificateList.approval")}>
          <option value="all">{t("hr.certificateList.allApprovals")}</option>
          <option value="yes">{t("hr.personnelDetail.verified")}</option>
          <option value="no">{t("hr.personnelDetail.pending")}</option>
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
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input type="checkbox" checked={includeLeft} onChange={(e) => setIncludeLeft(e.target.checked)} className="accent-cyan-500" />
          {t("hr.certificateList.includeLeft")}
        </label>
      </div>

      {table.isLoading && table.pageItems.length === 0 ? (
        <ul className="flex flex-col gap-2" aria-hidden>
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="h-[68px] animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40" />
          ))}
        </ul>
      ) : table.totalItems === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-12 text-center text-sm text-zinc-500">
          {filtered ? t("hr.certificateList.noMatch") : t("hr.certificateList.empty")}
        </div>
      ) : (
        <ul className={cn("flex flex-col gap-2", table.isLoading && "opacity-60")}>
          {table.pageItems.map((certificate) => (
            <li
              key={certificate.id}
              className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-3.5 transition-colors hover:border-zinc-700 lg:flex-row lg:items-center lg:gap-6"
            >
              <div className="flex min-w-0 items-center gap-3 lg:w-[34%] lg:shrink-0">
                <FileBadge className="h-5 w-5 shrink-0 text-zinc-500" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-100">{label(certificate)}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {[certificate.name ? CERTIFICATE_TYPE_LABELS[certificate.type] : null, certificate.issuer, certificate.documentNo]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
              </div>
              <div className="min-w-0 lg:w-[24%]">
                <Link href={`/hr/personnel/${certificate.personnelId}`} className="truncate text-sm text-zinc-200 hover:text-cyan-300 hover:underline">
                  {certificate.personnelName}
                </Link>
                <p className="truncate text-xs text-zinc-500">
                  {EMPLOYMENT_TYPE_LABELS[certificate.employmentType]}
                  {!certificate.personnelActive && ` · ${t("hr.certificateList.left")}`}
                </p>
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", VALIDITY_STYLES[certificate.validity])}>
                  {VALIDITY_LABELS[certificate.validity]}
                  {certificate.expiresAt && ` · ${formatDay(certificate.expiresAt)}`}
                </span>
                {certificate.verified ? (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                    {t("hr.personnelDetail.verified")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-teal-300">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    {t("hr.personnelDetail.pending")}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {certificate.filePath && (
                  <Button size="sm" variant="ghost" onClick={() => void openFile(certificate)} title={certificate.fileName}>
                    <FileText className="h-3.5 w-3.5" />
                    {t("hr.certificateForm.file")}
                  </Button>
                )}
                {canEdit && !certificate.verified && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void setCertificateVerified(certificate.id, true)
                        .then(() => {
                          log("approve", inTurkish(() => `Belge onaylandı: ${certificate.personnelName} · ${label(certificate)}`), certificate);
                          setVersion((current) => current + 1);
                        })
                        .catch((err) => flash("error", hrErrorMessage(err, t("hr.personnelDetail.approveFailed"))))
                    }
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {t("hr.leaveDecision.approve")}
                  </Button>
                )}
                {canEdit && (
                  <button
                    type="button"
                    aria-label={t("common.edit")}
                    title={t("common.edit")}
                    onClick={() => {
                      setSubmit({ saving: false, error: "" });
                      setEditing(certificate);
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-100"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    aria-label={t("common.delete")}
                    title={t("common.delete")}
                    onClick={() => {
                      if (!confirm(t("hr.certificateList.deleteConfirm", { name: `${certificate.personnelName} · ${label(certificate)}` }))) return;
                      void deleteCertificate(certificate)
                        .then(() => {
                          log("delete", inTurkish(() => `Belge silindi: ${certificate.personnelName} · ${label(certificate)}`), certificate);
                          setVersion((current) => current + 1);
                        })
                        .catch((err) => flash("error", hrErrorMessage(err, t("hr.personnelDetail.deleteCertificateFailed"))));
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
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

      {editing && (
        <CertificateModal
          certificate={editing}
          canVerify={canEdit}
          state={submit}
          onClose={() => setEditing(null)}
          onSubmit={(input, file) => {
            if (!user?.organizationId) return;
            setSubmit({ saving: true, error: "" });
            saveCertificate({
              id: editing.id,
              personnelId: editing.personnelId,
              organizationId: user.organizationId,
              input,
              file,
              previousPath: editing.filePath,
            })
              .then(() => {
                log("update", inTurkish(() => `Belge güncellendi: ${editing.personnelName} · ${input.name || CERTIFICATE_TYPE_LABELS[input.type]}`), editing);
                setEditing(null);
                setVersion((current) => current + 1);
                flash("success", t("hr.personnelDetail.certificateUpdated"));
              })
              .catch((err) => {
                console.error("Belge kaydedilemedi:", err);
                setSubmit({
                  saving: false,
                  error: hrErrorMessage(err, t("hr.personnelDetail.certificateSaveFailed")),
                });
              });
          }}
        />
      )}
    </div>
  );
}

export default function CertificatesPage() {
  return (
    <AuthGuard routeKey="certificates">
      <CertificatesContent />
    </AuthGuard>
  );
}

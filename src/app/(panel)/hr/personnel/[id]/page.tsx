"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addMonths, format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import {
  ArrowLeft,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Package,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import {
  CertificateModal,
  PersonnelModal,
  PrivateInfoModal,
  formatDay,
  type SubmitState,
} from "@/components/hr/hr-modals";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { usePageTitle } from "@/contexts/page-title-context";
import { useMyPersonnelId, resetMyPersonnelCache } from "@/hooks/use-my-personnel";
import { usePermissions } from "@/hooks/use-permissions";
import { logActivity } from "@/lib/activity-log";
import {
  CERTIFICATE_TYPE_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  MAX_YEARLY_OVERTIME,
  TIMESHEET_STATUS,
  VALIDITY_LABELS,
  VALIDITY_STYLES,
  deleteCertificate,
  fetchPersonnel,
  fetchPersonnelCertificates,
  fetchPersonnelPrivate,
  fetchTimesheet,
  fetchYearlyOvertime,
  formatHours,
  formatIban,
  getCertificateFileUrl,
  hrErrorMessage,
  maskNationalId,
  monthDays,
  saveCertificate,
  savePersonnelPrivate,
  setCertificateVerified,
  summarizeTimesheet,
  updatePersonnel,
  type Certificate,
  type Personnel,
  type PersonnelPrivateInput,
  type TimesheetEntry,
} from "@/lib/hr";
import { INVENTORY_SOURCE, mapInventoryRow, type InventoryItem } from "@/lib/inventory";
import { LeaveBalanceSummary, LeaveRequestModal, usePersonnelLeaves } from "@/components/hr/leave-modals";
import {
  LEAVE_STATUS_LABELS,
  LEAVE_STATUS_STYLES,
  LEAVE_TYPE_LABELS,
  createLeaveRequest,
} from "@/lib/leaves";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type Dialog =
  | { kind: "person" }
  | { kind: "private" }
  | { kind: "certificate"; certificate: Certificate | null }
  | { kind: "leave" };

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-5 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Field({ label, value, mono }: { label: string; value?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={cn("mt-1 break-words text-sm", value ? "text-zinc-200" : "text-zinc-600", mono && "font-mono")}>{value || "—"}</p>
    </div>
  );
}

function PersonnelDetail({ id }: { id: string }) {
  const { user, users } = useAuth();
  const personnelPerms = usePermissions("personnel");
  const privatePerms = usePermissions("personnelPrivate");
  const timesheetPerms = usePermissions("timesheets");
  const leavePerms = usePermissions("leaves");
  const { myPersonnelId } = useMyPersonnelId();
  const isSelf = myPersonnelId === id;

  const [person, setPerson] = useState<Personnel | null | undefined>(undefined);
  const [privateInfo, setPrivateInfo] = useState<PersonnelPrivateInput | null>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [entries, setEntries] = useState<TimesheetEntry[]>([]);
  const [yearlyOvertime, setYearlyOvertime] = useState(0);
  const [assignments, setAssignments] = useState<InventoryItem[]>([]);
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [version, setVersion] = useState(0);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [submit, setSubmit] = useState<SubmitState>({ saving: false, error: "" });
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [showNationalId, setShowNationalId] = useState(false);
  usePageTitle(person?.fullName);

  const canSeePrivate = privatePerms.canView || isSelf;
  const leaves = usePersonnelLeaves(person ?? undefined, version);
  const canAddCertificate = personnelPerms.canAdd || personnelPerms.canEdit || isSelf;

  useEffect(() => {
    let cancelled = false;
    fetchPersonnel(id)
      .then((next) => !cancelled && setPerson(next))
      .catch((err) => {
        console.error("Personel yüklenemedi:", err);
        if (!cancelled) setPerson(null);
      });
    fetchPersonnelCertificates(id)
      .then((next) => !cancelled && setCertificates(next))
      .catch((err) => console.error("Belgeler yüklenemedi:", err));
    return () => {
      cancelled = true;
    };
  }, [id, version]);

  useEffect(() => {
    if (!canSeePrivate) return;
    let cancelled = false;
    fetchPersonnelPrivate(id)
      .then((next) => !cancelled && setPrivateInfo(next))
      .catch((err) => console.error("Özlük bilgileri yüklenemedi:", err));
    return () => {
      cancelled = true;
    };
  }, [id, canSeePrivate, version]);

  useEffect(() => {
    let cancelled = false;
    const days = monthDays(month);
    Promise.all([fetchTimesheet(days[0], days[days.length - 1], id), fetchYearlyOvertime(Number(month.slice(0, 4)), id)])
      .then(([nextEntries, overtime]) => {
        if (cancelled) return;
        setEntries(nextEntries);
        setYearlyOvertime(overtime[id] ?? 0);
      })
      .catch((err) => console.error("Puantaj yüklenemedi:", err));
    return () => {
      cancelled = true;
    };
  }, [id, month]);

  const userId = person?.userId;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from(INVENTORY_SOURCE)
      .select("*")
      .eq("assignee_id", userId)
      .order("assigned_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("Zimmetler yüklenemedi:", error);
        else setAssignments((data ?? []).map((row) => mapInventoryRow(row as Record<string, unknown>)));
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const log = useCallback(
    (action: string, message: string) => {
      if (!user || !person) return;
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
    [user, person]
  );

  const flash = (tone: "success" | "error", text: string) => {
    setNotice({ tone, text });
    window.setTimeout(() => setNotice(null), 3500);
  };

  const run = async (task: () => Promise<void>, success: string, fallback: string) => {
    setSubmit({ saving: true, error: "" });
    try {
      await task();
      setDialog(null);
      setSubmit({ saving: false, error: "" });
      setVersion((current) => current + 1);
      flash("success", success);
    } catch (err) {
      console.error(fallback, err);
      setSubmit({ saving: false, error: hrErrorMessage(err, fallback) });
    }
  };

  const openFile = async (certificate: Certificate) => {
    if (!certificate.filePath) return;
    // Pencere tıklama anında açılır ki tarayıcı açılır pencere engeline takılmasın
    const popup = window.open("", "_blank");
    try {
      const url = await getCertificateFileUrl(certificate.filePath);
      if (popup) popup.location.href = url;
      else window.location.assign(url);
    } catch (err) {
      popup?.close();
      console.error("Dosya açılamadı:", err);
      flash("error", "Dosya açılamadı. Bu dosyayı görme yetkiniz olmayabilir.");
    }
  };

  const days = useMemo(() => monthDays(month), [month]);
  const summary = useMemo(() => summarizeTimesheet(entries), [entries]);
  const entryByDate = useMemo(() => new Map(entries.map((entry) => [entry.workDate, entry])), [entries]);

  if (person === undefined) {
    return <div className="flex h-full items-center justify-center text-sm text-zinc-500">Yükleniyor…</div>;
  }
  if (person === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-zinc-500">
        Personel bulunamadı ya da bu kartı görme yetkiniz yok.
        {personnelPerms.canView && (
          <Link href="/hr/personnel" className="text-cyan-400 hover:underline">
            Personel listesine dön
          </Link>
        )}
      </div>
    );
  }

  const nationalId = privateInfo?.nationalId ?? "";

  return (
    <div className="scrollbar-themed h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      {personnelPerms.canView && (
        <Link href="/hr/personnel" className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200">
          <ArrowLeft className="h-4 w-4" />
          Personel
        </Link>
      )}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {person.code && <p className="font-mono text-xs text-cyan-400/90">{person.code}</p>}
          <h1 className="mt-1 text-2xl font-semibold text-zinc-100">{person.fullName}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {[person.jobTitle, EMPLOYMENT_TYPE_LABELS[person.employmentType], person.subcontractorCompany].filter(Boolean).join(" · ")}
          </p>
          <span
            className={cn(
              "mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
              person.state === "active"
                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                : "border-zinc-700 bg-zinc-800/60 text-zinc-400"
            )}
          >
            {person.state === "active" ? "Çalışıyor" : `Ayrıldı · ${formatDay(person.endDate)}`}
          </span>
        </div>
        {personnelPerms.canEdit && (
          <Button
            variant="outline"
            onClick={() => {
              setSubmit({ saving: false, error: "" });
              setDialog({ kind: "person" });
            }}
          >
            <Pencil className="h-4 w-4" />
            Düzenle
          </Button>
        )}
      </div>

      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={cn(
            "mb-4 rounded-lg border px-4 py-2.5 text-sm",
            notice.tone === "error"
              ? "border-red-500/30 bg-red-500/10 text-red-300"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          )}
        >
          {notice.text}
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Genel bilgiler">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Çalışma tipi" value={EMPLOYMENT_TYPE_LABELS[person.employmentType]} />
            {person.employmentType === "subcontractor" ? (
              <Field label="Taşeron firma" value={person.subcontractorCompany} />
            ) : (
              <Field label="Departman" value={person.department} />
            )}
            <Field label="Unvan / meslek" value={person.jobTitle} />
            <Field label="Görev yeri" value={person.storeName ?? "Merkez"} />
            <Field label="Telefon" value={person.phone} />
            <Field label="E-posta" value={person.email} />
            <Field label="İşe giriş" value={person.startDate && formatDay(person.startDate)} />
            <Field label="İşten çıkış" value={person.endDate && formatDay(person.endDate)} />
            <Field
              label="KVKK aydınlatma tebliği"
              value={
                person.privacyNoticeDate ? (
                  formatDay(person.privacyNoticeDate)
                ) : (
                  <span className="text-amber-400">Tebliğ tarihi girilmemiş</span>
                )
              }
            />
            <Field label="Uygulama hesabı" value={person.userId ? "Bağlı" : "Bağlı değil"} />
            <Field
              label="İzin onaylayan yönetici"
              value={person.managerId ? (users.find((u) => u.id === person.managerId)?.name ?? "—") : "Yok (doğrudan İK)"}
            />
          </div>
          {person.notes && <p className="mt-4 whitespace-pre-wrap border-t border-zinc-800 pt-4 text-sm text-zinc-400">{person.notes}</p>}
        </Section>

        {canSeePrivate && (
          <Section
            title="Özlük bilgileri"
            description={isSelf && !privatePerms.canView ? "Bilgileriniz yanlışsa insan kaynaklarına bildirin." : "Hassas kişisel veri — yalnızca yetkililer görür"}
            action={
              privatePerms.canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSubmit({ saving: false, error: "" });
                    setDialog({ kind: "private" });
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {privateInfo ? "Düzenle" : "Bilgi ekle"}
                </Button>
              )
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="T.C. kimlik no"
                mono
                value={
                  nationalId && (
                    <span className="inline-flex items-center gap-2">
                      {showNationalId ? nationalId : maskNationalId(nationalId)}
                      <button
                        type="button"
                        onClick={() => setShowNationalId((value) => !value)}
                        aria-label={showNationalId ? "Gizle" : "Göster"}
                        className="text-zinc-500 hover:text-zinc-200"
                      >
                        {showNationalId ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </span>
                  )
                }
              />
              <Field label="Doğum tarihi" value={privateInfo?.birthDate && formatDay(privateInfo.birthDate)} />
              <Field label="IBAN" mono value={privateInfo?.iban && formatIban(privateInfo.iban)} />
              <Field
                label="Acil durum"
                value={[privateInfo?.emergencyContactName, privateInfo?.emergencyContactPhone].filter(Boolean).join(" · ")}
              />
              <div className="sm:col-span-2">
                <Field label="Adres" value={privateInfo?.address} />
              </div>
            </div>
          </Section>
        )}

        <Section
          title="Belgeler ve sertifikalar"
          description="İSG eğitimi, sağlık muayenesi, MYK ve diğer belgeler"
          action={
            canAddCertificate && (
              <Button
                size="sm"
                onClick={() => {
                  setSubmit({ saving: false, error: "" });
                  setDialog({ kind: "certificate", certificate: null });
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Belge ekle
              </Button>
            )
          }
        >
          {certificates.length === 0 ? (
            <p className="text-sm text-zinc-500">Henüz belge eklenmemiş.</p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {certificates.map((certificate) => {
                const editable = personnelPerms.canEdit || (isSelf && !certificate.verified);
                const removable = personnelPerms.canDelete || (isSelf && !certificate.verified);
                return (
                  <li key={certificate.id} className="flex flex-wrap items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-100">
                        {certificate.name || CERTIFICATE_TYPE_LABELS[certificate.type]}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {[
                          certificate.name ? CERTIFICATE_TYPE_LABELS[certificate.type] : null,
                          certificate.issuer,
                          certificate.documentNo && `No: ${certificate.documentNo}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", VALIDITY_STYLES[certificate.validity])}>
                          {VALIDITY_LABELS[certificate.validity]}
                          {certificate.expiresAt && ` · ${formatDay(certificate.expiresAt)}`}
                        </span>
                        {certificate.verified ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-400" title={certificate.verifiedByName ? `Onaylayan: ${certificate.verifiedByName}` : undefined}>
                            <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                            Onaylı
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-teal-300">
                            <Clock className="h-3.5 w-3.5" aria-hidden />
                            Onay bekliyor
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {certificate.filePath && (
                        <Button size="sm" variant="ghost" onClick={() => void openFile(certificate)} title={certificate.fileName}>
                          <FileText className="h-3.5 w-3.5" />
                          Dosya
                        </Button>
                      )}
                      {personnelPerms.canEdit && !certificate.verified && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void setCertificateVerified(certificate.id, true)
                              .then(() => {
                                log("approve", `Belge onaylandı: ${person.fullName} · ${certificate.name || CERTIFICATE_TYPE_LABELS[certificate.type]}`);
                                setVersion((current) => current + 1);
                              })
                              .catch((err) => flash("error", hrErrorMessage(err, "Belge onaylanamadı.")))
                          }
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Onayla
                        </Button>
                      )}
                      {editable && (
                        <button
                          type="button"
                          aria-label="Belgeyi düzenle"
                          title="Düzenle"
                          onClick={() => {
                            setSubmit({ saving: false, error: "" });
                            setDialog({ kind: "certificate", certificate });
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-100"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {removable && (
                        <button
                          type="button"
                          aria-label="Belgeyi sil"
                          title="Sil"
                          onClick={() => {
                            if (!confirm("Belge ve dosyası silinsin mi?")) return;
                            void deleteCertificate(certificate)
                              .then(() => {
                                log("delete", `Belge silindi: ${person.fullName} · ${certificate.name || CERTIFICATE_TYPE_LABELS[certificate.type]}`);
                                setVersion((current) => current + 1);
                              })
                              .catch((err) => flash("error", hrErrorMessage(err, "Belge silinemedi.")));
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section
          title="Puantaj"
          description={format(parseISO(`${month}-01`), "MMMM yyyy", { locale: tr })}
          action={
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Önceki ay"
                onClick={() => setMonth(format(addMonths(parseISO(`${month}-01`), -1), "yyyy-MM"))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Sonraki ay"
                onClick={() => setMonth(format(addMonths(parseISO(`${month}-01`), 1), "yyyy-MM"))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {(timesheetPerms.canView || isSelf) && (
                <Link href={`/hr/timesheets?month=${month}`} className="ml-2 text-xs text-cyan-400 hover:underline">
                  Cetveli aç
                </Link>
              )}
            </div>
          }
        >
          <div className="grid grid-cols-7 gap-1 sm:grid-cols-[repeat(16,minmax(0,1fr))]">
            {days.map((day) => {
              const entry = entryByDate.get(day);
              const meta = entry ? TIMESHEET_STATUS[entry.status] : null;
              return (
                <div
                  key={day}
                  title={
                    meta
                      ? `${formatDay(day)} · ${meta.label}${entry!.overtimeHours ? ` · ${formatHours(entry!.overtimeHours)} sa fazla mesai` : ""}`
                      : formatDay(day)
                  }
                  className={cn(
                    "flex h-10 flex-col items-center justify-center rounded-md text-[10px] tabular-nums",
                    meta ? meta.style : "bg-zinc-900 text-zinc-600"
                  )}
                >
                  <span className="opacity-70">{Number(day.slice(8))}</span>
                  <span className="text-xs font-semibold">{meta?.code ?? "·"}</span>
                </div>
              );
            })}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-zinc-500">Çalışılan gün</dt>
              <dd className="font-semibold tabular-nums text-zinc-100">{formatHours(summary.workedDays)}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Fazla mesai (ay)</dt>
              <dd className="font-semibold tabular-nums text-zinc-100">{formatHours(summary.overtime)} sa</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">İzin / rapor</dt>
              <dd className="font-semibold tabular-nums text-zinc-100">
                {summary.annualLeave + summary.otherLeave} / {summary.sick}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Fazla mesai ({month.slice(0, 4)})</dt>
              <dd className={cn("font-semibold tabular-nums", yearlyOvertime > MAX_YEARLY_OVERTIME ? "text-red-400" : "text-zinc-100")}>
                {formatHours(yearlyOvertime)} / {MAX_YEARLY_OVERTIME} sa
              </dd>
            </div>
          </dl>
          {yearlyOvertime > MAX_YEARLY_OVERTIME && (
            <p className="mt-3 rounded-lg border border-red-500/25 bg-red-500/5 px-3 py-2 text-xs text-red-300">
              Yıllık fazla mesai 270 saati aştı (İş Kanunu md. 41).
            </p>
          )}
        </Section>

        {(leavePerms.canView || isSelf || (!!user && person.managerId === user.id)) && (
          <Section
            title="Yıllık izin"
            description="İş Kanunu md. 53'e göre hizmet süresinden hesaplanır"
            action={
              (isSelf || leavePerms.canAdd) &&
              person.state === "active" && (
                <Button
                  size="sm"
                  onClick={() => {
                    setSubmit({ saving: false, error: "" });
                    setDialog({ kind: "leave" });
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  İzin talebi
                </Button>
              )
            }
          >
            {leaves.balance ? (
              <LeaveBalanceSummary balance={leaves.balance} />
            ) : (
              <p className="text-sm text-zinc-500">
                {person.startDate ? "Yükleniyor…" : "İşe giriş tarihi girilmediği için izin hakkı hesaplanamıyor."}
              </p>
            )}
            {leaves.requests && leaves.requests.length > 0 && (
              <ul className="mt-4 divide-y divide-zinc-800 border-t border-zinc-800">
                {leaves.requests.slice(0, 5).map((request) => (
                  <li key={request.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <span className="text-zinc-200">
                      {LEAVE_TYPE_LABELS[request.type]}
                      <span className="ml-2 text-xs text-zinc-500">
                        {formatDay(request.startDate)} – {formatDay(request.endDate)} · {formatHours(request.dayCount)} gün
                      </span>
                    </span>
                    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", LEAVE_STATUS_STYLES[request.status])}>
                      {LEAVE_STATUS_LABELS[request.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/hr/leaves" className="mt-3 inline-block text-xs text-cyan-400 hover:underline">
              Tüm izinler
            </Link>
          </Section>
        )}

        {person.userId && (
          <Section title="Zimmetler" description="Kişiye zimmetli ekipman ve araçlar">
            {assignments.length === 0 ? (
              <p className="text-sm text-zinc-500">Zimmetli eşya yok.</p>
            ) : (
              <ul className="divide-y divide-zinc-800">
                {assignments.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <Package className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-zinc-200">
                        {item.code && <span className="mr-2 font-mono text-xs text-zinc-500">{item.code}</span>}
                        {item.name}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {formatDay(item.assignment?.assignedAt)}
                        {item.assignment?.storeName && ` · ${item.assignment.storeName}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}
      </div>

      {dialog?.kind === "leave" && (
        <LeaveRequestModal
          people={[person]}
          state={submit}
          onClose={() => setDialog(null)}
          onSubmit={(input) =>
            void run(
              async () => {
                await createLeaveRequest(input);
                log("create", `İzin talebi oluşturuldu: ${person.fullName} · ${LEAVE_TYPE_LABELS[input.type]}, ${formatDay(input.startDate)} – ${formatDay(input.endDate)}`);
              },
              "İzin talebi oluşturuldu ve onaya gönderildi.",
              "İzin talebi kaydedilemedi."
            )
          }
        />
      )}
      {dialog?.kind === "person" && (
        <PersonnelModal
          person={person}
          state={submit}
          onClose={() => setDialog(null)}
          onSubmit={(input) =>
            void run(
              async () => {
                await updatePersonnel(person.id, input);
                resetMyPersonnelCache();
                log("update", `Personel güncellendi: ${input.fullName}`);
              },
              "Personel güncellendi.",
              "Personel kaydedilemedi."
            )
          }
        />
      )}
      {dialog?.kind === "private" && (
        <PrivateInfoModal
          person={person}
          value={privateInfo}
          state={submit}
          onClose={() => setDialog(null)}
          onSubmit={(input) =>
            void run(
              async () => {
                await savePersonnelPrivate(person.id, input);
                // Hassas verinin içeriği loga yazılmaz
                log("update", `Özlük bilgileri güncellendi: ${person.fullName}`);
              },
              "Özlük bilgileri kaydedildi.",
              "Özlük bilgileri kaydedilemedi."
            )
          }
        />
      )}
      {dialog?.kind === "certificate" && (
        <CertificateModal
          certificate={dialog.certificate}
          canVerify={dialog.certificate ? personnelPerms.canEdit : personnelPerms.canEdit || personnelPerms.canAdd}
          state={submit}
          onClose={() => setDialog(null)}
          onSubmit={(input, file) =>
            void run(
              async () => {
                if (!user?.organizationId) throw new Error("Organizasyon bilgisi bulunamadı.");
                await saveCertificate({
                  id: dialog.certificate?.id,
                  personnelId: person.id,
                  organizationId: user.organizationId,
                  input,
                  file,
                  previousPath: dialog.certificate?.filePath,
                });
                const label = input.name || CERTIFICATE_TYPE_LABELS[input.type];
                log(dialog.certificate ? "update" : "create", `Belge ${dialog.certificate ? "güncellendi" : "eklendi"}: ${person.fullName} · ${label}`);
              },
              dialog.certificate ? "Belge güncellendi." : "Belge eklendi.",
              "Belge kaydedilemedi."
            )
          }
        />
      )}
    </div>
  );
}

export default function PersonnelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGuard routeKey="personnel">
      <PersonnelDetail id={id} />
    </AuthGuard>
  );
}

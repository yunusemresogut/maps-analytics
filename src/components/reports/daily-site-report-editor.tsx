"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Eye, ImagePlus, ListChecks, Plus, Printer, Save, Trash2, X } from "lucide-react";
import { ModuleFormShell } from "@/components/modules/module-form-shell";
import { DailySiteReportDocument } from "@/components/reports/daily-site-report-document";
import { ReportAttendanceSection } from "@/components/reports/report-attendance";
import { Switch } from "@/components/ui/switch";
import { usePermissions } from "@/hooks/use-permissions";
import { useSettings } from "@/contexts/settings-context";
import { hrErrorMessage, syncAttendanceToTimesheet } from "@/lib/hr";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { useI18n } from "@/contexts/i18n-context";
import { getDateLocale } from "@/i18n/runtime";
import { useStores } from "@/contexts/stores-context";
import { fetchStoreWorkPlan } from "@/lib/store-details";
import {
  WEATHER_OPTIONS,
  attendancePresent,
  crewTotal,
  emptyDailySiteReport,
  newRowId,
  reportFileName,
  weatherLabel,
  workPlanLinesForDate,
  type DailySiteReport,
  type ReportPhoto,
} from "@/lib/daily-site-report";
import {
  canModifySiteReport,
  compressPhoto,
  deleteSiteReport,
  saveSiteReport,
  type SiteReportMeta,
} from "@/lib/site-reports";

const MAX_PHOTOS = 24;
const PHOTO_TYPES = "image/jpeg,image/png,image/webp";

const subscribeNoop = () => () => {};

/** Sunucuda false, tarayıcıda true; portal yalnızca tarayıcıda kurulur */
function useIsClient() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

function Panel({ title, description, action, children }: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800 px-5 py-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
        </div>
        {action}
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}

const isBlobUrl = (url: string) => url.startsWith("blob:");

function formatStamp(value: string): string {
  return format(parseISO(value), "d MMM yyyy HH:mm", { locale: getDateLocale() });
}

type DailySiteReportEditorProps = {
  /** Kayıtlı rapor; verilmezse yeni rapor açılır */
  initial?: { report: DailySiteReport; meta: SiteReportMeta };
};

export function DailySiteReportEditor({ initial }: DailySiteReportEditorProps) {
  const router = useRouter();
  const { t } = useI18n();
  const { user, organization } = useAuth();
  const { stores, getStore } = useStores();
  const isClient = useIsClient();
  const [report, setReport] = useState<DailySiteReport>(
    () => initial?.report ?? emptyDailySiteReport(user?.name ?? "", format(new Date(), "yyyy-MM-dd"))
  );
  const meta = initial?.meta;
  const canModify = !meta || canModifySiteReport(user, meta.createdBy);
  const [dirty, setDirty] = useState(false);
  // Yeni rapor ilk kayıttan sonra bu id ile güncellenir
  const [savedId, setSavedId] = useState(meta?.id);
  // Formdan çıkarılan kayıtlı fotoğraflar; kaydedince depodan silinir
  const [removedPaths, setRemovedPaths] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [storeMissing, setStoreMissing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [workPlanState, setWorkPlanState] = useState<{ status: "idle" | "loading" | "error" | "empty" }>({
    status: "idle",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timesheetPerms = usePermissions("timesheets");
  const { isModuleEnabled } = useSettings();
  // Yoklama kaydedilirken puantaja işlenir (puantaj yazma yetkisi gerekir)
  const canSyncTimesheet = (timesheetPerms.canAdd || timesheetPerms.canEdit) && isModuleEnabled("timesheets");
  const [syncTimesheet, setSyncTimesheet] = useState(true);

  const store = getStore(report.storeId);
  const update = (patch: Partial<DailySiteReport>) => {
    setReport((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  };

  // Kaydedilmemiş değişiklikle sayfa kapatılırken uyar
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Sayfadan çıkınca fotoğraf önizlemeleri serbest bırakılır
  const photosRef = useRef(report.photos);
  useEffect(() => {
    photosRef.current = report.photos;
  }, [report.photos]);
  useEffect(
    () => () =>
      photosRef.current.forEach((photo) => {
        if (isBlobUrl(photo.url)) URL.revokeObjectURL(photo.url);
      }),
    []
  );

  const onStoreChange = (storeId: string) => {
    const next = getStore(storeId);
    setWorkPlanState({ status: "idle" });
    update({
      storeId,
      siteManager: next?.siteManager ?? "",
      contractor: next?.contractorCompany ?? "",
    });
  };

  const importWorkPlan = async () => {
    if (!report.storeId) return;
    setWorkPlanState({ status: "loading" });
    try {
      const lines = workPlanLinesForDate(await fetchStoreWorkPlan(report.storeId), report.date);
      if (lines.length === 0) {
        setWorkPlanState({ status: "empty" });
        return;
      }
      setReport((prev) => {
        const existing = new Set(prev.worksDone.split("\n").map((line) => line.trim()));
        const added = lines.filter((line) => !existing.has(line));
        const worksDone = [prev.worksDone.trimEnd(), ...added].filter(Boolean).join("\n");
        return { ...prev, worksDone };
      });
      setDirty(true);
      setWorkPlanState({ status: "idle" });
    } catch (err) {
      console.error("İş planı yüklenemedi:", err);
      setWorkPlanState({ status: "error" });
    }
  };

  const addPhotos = async (files: File[]) => {
    const room = MAX_PHOTOS - report.photos.length;
    const selected = files
      .filter((file) => PHOTO_TYPES.split(",").includes(file.type))
      .slice(0, Math.max(0, room));
    if (selected.length === 0) return;
    // Yüklemeden önce küçültülür; önizleme ve PDF de küçültülmüş kopyayı kullanır
    const added: ReportPhoto[] = await Promise.all(
      selected.map(async (file) => {
        const blob = await compressPhoto(file);
        return {
          id: newRowId(),
          url: URL.createObjectURL(blob),
          name: file.name.replace(/\.[^.]+$/, ""),
          caption: "",
          file: blob,
        };
      })
    );
    setReport((prev) => ({ ...prev, photos: [...prev.photos, ...added].slice(0, MAX_PHOTOS) }));
    setDirty(true);
  };

  const removePhoto = (id: string) => {
    const photo = report.photos.find((item) => item.id === id);
    if (photo && isBlobUrl(photo.url)) URL.revokeObjectURL(photo.url);
    if (photo?.path) setRemovedPaths((prev) => [...prev, photo.path!]);
    update({ photos: report.photos.filter((item) => item.id !== id) });
  };

  const updatePhoto = (id: string, caption: string) =>
    update({ photos: report.photos.map((item) => (item.id === id ? { ...item, caption } : item)) });

  /** Tarayıcının yazdırma penceresi; "PDF olarak kaydet" ile dosya alınır */
  const printReport = () => {
    const previousTitle = document.title;
    // Kaydedilen PDF'in önerilen adı sayfa başlığından gelir
    document.title = reportFileName(store?.name ?? "", report.date);
    window.addEventListener("afterprint", () => (document.title = previousTitle), { once: true });
    window.print();
  };

  const save = async () => {
    if (!report.storeId) {
      setStoreMissing(true);
      setNotice({ tone: "error", text: t("reports.editor.selectSiteToSave") });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const result = await saveSiteReport({
        id: savedId,
        report,
        removedPaths,
        userName: user?.name ?? "",
      });
      setSavedId(result.id);

      // Yoklama puantaja: hata raporun kaydını geri almaz, yalnızca bildirilir
      let timesheetNote = "";
      let timesheetFailed = false;
      if (canSyncTimesheet && syncTimesheet && report.attendance.length > 0) {
        try {
          const sync = await syncAttendanceToTimesheet({
            storeId: report.storeId,
            date: report.date,
            attendance: report.attendance,
          });
          timesheetNote = ` ${t(sync.written === 1 ? "reports.editor.timesheetWrittenOne" : "reports.editor.timesheetWrittenOther", { count: sync.written })}`;
          if (sync.skipped.length > 0) timesheetNote += ` ${t("reports.editor.timesheetSkipped", { names: sync.skipped.join(", ") })}`;
        } catch (err) {
          console.error("Yoklama puantaja işlenemedi:", err);
          timesheetFailed = true;
          timesheetNote = ` ${t("reports.editor.timesheetFailed", { reason: hrErrorMessage(err, t("reports.editor.checkConnection")) })}`;
        }
      }

      if (!meta && result.errors.length === 0 && !timesheetFailed) {
        // Yeni rapor: kayıtlı raporun sayfasına geçilir (fotoğraflar depodan gelir)
        setDirty(false);
        router.replace(`/reports/daily-site/${result.id}`);
        return;
      }
      const uploaded = new Map(result.photos.map((photo) => [photo.id, photo.path]));
      setReport((prev) => ({
        ...prev,
        photos: prev.photos.map((photo) =>
          uploaded.get(photo.id) ? { ...photo, path: uploaded.get(photo.id), file: undefined } : photo
        ),
      }));
      setRemovedPaths([]);
      setDirty(result.errors.length > 0);
      setNotice(
        result.errors.length > 0
          ? { tone: "error", text: `${t("reports.editor.savedWithPhotoErrors", { errors: result.errors.join(" ") })}${timesheetNote}` }
          : { tone: timesheetFailed ? "error" : "success", text: `${t("reports.editor.saved")}${timesheetNote}` }
      );
    } catch (err) {
      console.error("Rapor kaydedilemedi:", err);
      setNotice({ tone: "error", text: t("reports.editor.saveFailed") });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!meta || !confirm(t("reports.editor.confirmDelete"))) return;
    setDeleting(true);
    try {
      await deleteSiteReport(meta.id);
      setDirty(false);
      router.push("/reports");
    } catch (err) {
      console.error("Rapor silinemedi:", err);
      setNotice({ tone: "error", text: t("reports.editor.deleteFailed") });
      setDeleting(false);
    }
  };

  const reportDocument = (
    <DailySiteReportDocument report={report} store={store} organizationName={organization?.name} />
  );

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {canModify && (
        <Button onClick={() => void save()} loading={saving} disabled={deleting}>
          <Save className="h-4 w-4" />
          {savedId ? t("reports.editor.saveChanges") : t("reports.editor.saveReport")}
        </Button>
      )}
      <Button variant="outline" onClick={() => setPreviewOpen(true)}>
        <Eye className="h-4 w-4" />
        {t("reports.editor.preview")}
      </Button>
      <Button
        variant="outline"
        onClick={printReport}
        disabled={!report.storeId}
        title={report.storeId ? undefined : t("reports.editor.selectSiteFirst")}
      >
        <Printer className="h-4 w-4" />
        {t("reports.editor.exportPdf")}
      </Button>
      {meta && canModify && (
        <Button variant="danger" onClick={() => void remove()} loading={deleting} disabled={saving}>
          <Trash2 className="h-4 w-4" />
          {t("common.delete")}
        </Button>
      )}
      {dirty && canModify && <span className="text-xs text-amber-400/90">{t("reports.editor.unsavedChanges")}</span>}
    </div>
  );

  const printCopy =
    isClient && createPortal(<div className="print-root">{reportDocument}</div>, document.body);

  const subtitle = meta
    ? `${meta.createdByName || "—"} · ${formatStamp(meta.createdAt)}${
        meta.updatedAt ? ` · ${t("reports.editor.lastEdited", { value: `${meta.updatedByName ? `${meta.updatedByName}, ` : ""}${formatStamp(meta.updatedAt)}` })}` : ""
      }`
    : t("reports.editor.subtitle");

  const totalPeople = attendancePresent(report.attendance) + crewTotal(report.crew);

  // Raporu düzenleme yetkisi olmayan kullanıcı yalnızca okur ve PDF alır
  if (!canModify) {
    return (
      <ModuleFormShell backHref="/reports" backLabel={t("pageTitle.reports")} title={t("pageTitle.dailySiteReport")} subtitle={subtitle}>
        {actions}
        <div className="overflow-x-auto rounded-xl bg-neutral-200 p-3 sm:p-6">{reportDocument}</div>
        {printCopy}
      </ModuleFormShell>
    );
  }

  return (
    <ModuleFormShell
      backHref="/reports"
      backLabel={t("pageTitle.reports")}
      title={t("pageTitle.dailySiteReport")}
      subtitle={subtitle}
    >
      {actions}
      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={
            notice.tone === "error"
              ? "rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
              : "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
          }
        >
          {notice.text}
        </p>
      )}

      <Panel title={t("reports.editor.general")}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label={t("reports.editor.site")} required className="sm:col-span-2">
            <Select value={report.storeId} onChange={(e) => onStoreChange(e.target.value)} placeholder={t("reports.editor.selectSite")} aria-invalid={storeMissing && !report.storeId}>
              {stores.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.city})
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t("reports.editor.reportDate")} required>
            <DatePicker value={report.date} onChange={(date) => update({ date })} />
          </FormField>
          <FormField label={t("reports.editor.preparedBy")}>
            <Input value={report.preparedBy} onChange={(e) => update({ preparedBy: e.target.value })} />
          </FormField>
          <FormField label={t("reports.editor.siteManager")}>
            <Input value={report.siteManager} onChange={(e) => update({ siteManager: e.target.value })} />
          </FormField>
          <FormField label={t("reports.editor.contractor")}>
            <Input value={report.contractor} onChange={(e) => update({ contractor: e.target.value })} />
          </FormField>
          <FormField label={t("reports.editor.weather")}>
            <Select value={report.weather} onChange={(e) => update({ weather: e.target.value })}>
              {WEATHER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {weatherLabel(option)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t("reports.editor.temperature")}>
            <Input
              inputMode="decimal"
              placeholder={t("reports.editor.temperaturePlaceholder")}
              value={report.temperature}
              onChange={(e) => update({ temperature: e.target.value })}
            />
          </FormField>
        </div>
      </Panel>

      <Panel
        title={t("reports.editor.personnelOnSite")}
        description={t(totalPeople === 1 ? "reports.editor.totalPeopleOne" : "reports.editor.totalPeopleOther", { count: totalPeople })}
      >
        <ReportAttendanceSection
          storeId={report.storeId}
          date={report.date}
          attendance={report.attendance}
          onChange={(attendance) => update({ attendance })}
          autoFill={!meta}
        />
        {report.attendance.length > 0 &&
          (canSyncTimesheet ? (
            <Switch
              checked={syncTimesheet}
              onChange={setSyncTimesheet}
              label={t("reports.editor.syncTimesheet")}
            />
          ) : (
            <p className="text-xs text-zinc-500">
              {t("reports.editor.attendanceStoredNote")}
            </p>
          ))}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800 pt-4">
          <div>
            <h3 className="text-sm font-medium text-zinc-200">{t("reports.editor.crewCounts")}</h3>
            <p className="text-xs text-zinc-500">{t("reports.editor.crewCountsHint")}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => update({ crew: [...report.crew, { id: newRowId(), trade: "", count: null }] })}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("reports.editor.addCrew")}
          </Button>
        </div>
        <div className="space-y-2">
          {report.crew.map((row, index) => (
            <div key={row.id} className="flex items-center gap-2">
              <Input
                aria-label={t("reports.editor.crewRow", { n: index + 1 })}
                placeholder={t("reports.editor.crewTradePlaceholder")}
                value={row.trade}
                onChange={(e) =>
                  update({ crew: report.crew.map((item) => (item.id === row.id ? { ...item, trade: e.target.value } : item)) })
                }
              />
              <Input
                aria-label={t("reports.editor.crewRowCount", { n: index + 1 })}
                type="number"
                min={0}
                placeholder={t("reports.editor.people")}
                className="w-24 shrink-0 tabular-nums"
                value={row.count ?? ""}
                onChange={(e) => {
                  const count = e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value)) || 0);
                  update({ crew: report.crew.map((item) => (item.id === row.id ? { ...item, count } : item)) });
                }}
              />
              <button
                type="button"
                onClick={() => update({ crew: report.crew.filter((item) => item.id !== row.id) })}
                className="shrink-0 rounded-md p-2 text-zinc-500 hover:bg-zinc-800/50 hover:text-red-400"
                aria-label={t("reports.editor.removeCrew", { n: index + 1 })}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title={t("reports.editor.daySummary")}>
        <FormField label={t("reports.editor.worksDone")}>
          <Textarea
            rows={6}
            value={report.worksDone}
            onChange={(e) => update({ worksDone: e.target.value })}
            placeholder={t("reports.editor.worksDonePlaceholder")}
          />
        </FormField>
        <div className="-mt-2 flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void importWorkPlan()}
            disabled={!report.storeId}
            loading={workPlanState.status === "loading"}
          >
            <ListChecks className="h-3.5 w-3.5" />
            {t("reports.editor.importWorkPlan")}
          </Button>
          <span className="text-xs text-zinc-500" role="status">
            {!report.storeId
              ? t("reports.editor.workPlanHintNoSite")
              : workPlanState.status === "empty"
                ? t("reports.editor.workPlanEmpty")
                : workPlanState.status === "error"
                  ? t("reports.editor.workPlanError")
                  : t("reports.editor.workPlanHint")}
          </span>
        </div>
        <FormField label={t("reports.editor.materialsReceived")}>
          <Textarea rows={3} value={report.materialsReceived} onChange={(e) => update({ materialsReceived: e.target.value })} />
        </FormField>
        <FormField label={t("reports.editor.issues")}>
          <Textarea rows={3} value={report.issues} onChange={(e) => update({ issues: e.target.value })} />
        </FormField>
        <FormField label={t("reports.editor.safety")}>
          <Textarea
            rows={2}
            value={report.safetyNotes}
            onChange={(e) => update({ safetyNotes: e.target.value })}
            placeholder={t("reports.editor.safetyPlaceholder")}
          />
        </FormField>
        <FormField label={t("reports.editor.tomorrowPlan")}>
          <Textarea rows={3} value={report.tomorrowPlan} onChange={(e) => update({ tomorrowPlan: e.target.value })} />
        </FormField>
      </Panel>

      <Panel
        title={t("reports.editor.photosTitle", { count: report.photos.length })}
        description={t("reports.editor.photosDescription")}
        action={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept={PHOTO_TYPES}
              multiple
              hidden
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                void addPhotos(files);
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={report.photos.length >= MAX_PHOTOS}
            >
              <ImagePlus className="h-3.5 w-3.5" />
              {t("reports.editor.addPhoto")}
            </Button>
          </>
        }
      >
        {report.photos.length === 0 ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void addPhotos(Array.from(e.dataTransfer.files));
            }}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 px-4 py-8 text-sm text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
          >
            <ImagePlus className="h-5 w-5" />
            {t("reports.editor.dropPhotos")}
          </button>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {report.photos.map((photo, index) => (
              <li key={photo.id} className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/40">
                <div className="relative">
                  {/* Yerel dosya önizlemesi (blob URL) */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={photo.caption || photo.name} className="h-40 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    className="absolute right-2 top-2 rounded-md bg-black/60 p-1 text-white hover:bg-black/80"
                    aria-label={t("reports.editor.removePhoto", { n: index + 1 })}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-2">
                  <Input
                    aria-label={t("reports.editor.photoCaption", { n: index + 1 })}
                    placeholder={photo.name}
                    value={photo.caption}
                    onChange={(e) => updatePhoto(photo.id, e.target.value)}
                    className="h-9"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {actions}

      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={t("reports.editor.previewTitle")}
        description={t("reports.editor.previewDescription")}
        className="sm:max-w-[calc(210mm+3rem)]"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPreviewOpen(false)}>
              {t("common.close")}
            </Button>
            <Button onClick={printReport} disabled={!report.storeId}>
              <Printer className="h-4 w-4" />
              {t("reports.editor.exportPdf")}
            </Button>
          </>
        }
      >
        <div className="overflow-x-auto rounded-lg bg-neutral-200 p-3">{reportDocument}</div>
      </Modal>

      {/* Yazdırılan kopya: body'nin doğrudan çocuğu, ekranda gizli (globals.css) */}
      {printCopy}
    </ModuleFormShell>
  );
}

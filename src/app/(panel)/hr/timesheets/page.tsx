"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { addMonths, format, parseISO } from "date-fns";
// Aktivite logu Türkçe tutulur
import { tr as trLocale } from "date-fns/locale";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Eraser,
  Lock,
  LockOpen,
  MousePointerClick,
  WandSparkles,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { TimesheetEntryModal, type SubmitState } from "@/components/hr/hr-modals";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { useI18n } from "@/contexts/i18n-context";
import { useStores } from "@/contexts/stores-context";
import { useSettings } from "@/contexts/settings-context";
import { useMyPersonnelId } from "@/hooks/use-my-personnel";
import { usePermissions } from "@/hooks/use-permissions";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { logActivity } from "@/lib/activity-log";
import {
  EMPLOYMENT_TYPE_LABELS,
  MAX_DAILY_HOURS,
  MAX_YEARLY_OVERTIME,
  TIMESHEET_STATUS,
  TIMESHEET_STATUSES,
  WORKING_STATUSES,
  activeInMonth,
  deleteTimesheetEntries,
  employedOn,
  exportTimesheetXlsx,
  fetchAllPersonnel,
  fetchTimesheet,
  fetchTimesheetLock,
  fetchYearlyOvertime,
  lockTimesheetMonth,
  unlockTimesheetMonth,
  formatDayCount,
  formatHourCount,
  formatHours,
  hrErrorMessage,
  isSaturday,
  isSunday,
  monthDays,
  planReportAttendanceImport,
  summarizeTimesheet,
  upsertTimesheetEntries,
  type Personnel,
  type TimesheetEntry,
  type TimesheetEntryInput,
  type TimesheetLock,
  type TimesheetStatus,
  type TimesheetUpsert,
} from "@/lib/hr";
import { DAILY_HOUR_OPTIONS } from "@/lib/settings";
import { cn } from "@/lib/utils";

/** Hızlı giriş: seçili durum hücreye tıklayınca doğrudan yazılır; "clear" günü boşaltır */
type Brush = "none" | "clear" | TimesheetStatus;

const key = (personnelId: string, date: string) => `${personnelId}|${date}`;

function TimesheetsContent() {
  const { t, locale, dateLocale } = useI18n();
  const { user } = useAuth();
  const { stores } = useStores();
  const searchParams = useSearchParams();
  const { canView, canAdd, canEdit, canDelete } = usePermissions("timesheets");
  const { myPersonnelId, loaded: myLoaded } = useMyPersonnelId();
  const [lock, setLock] = useState<{ month: string; lock: TimesheetLock | null } | null>(null);

  const initialMonth = searchParams.get("month");
  const [month, setMonth] = useState(() =>
    initialMonth && /^\d{4}-\d{2}$/.test(initialMonth) ? initialMonth : format(new Date(), "yyyy-MM")
  );
  const [query, setQuery] = usePersistentState("timesheets", "query", "");
  const [storeFilter, setStoreFilter] = usePersistentState("timesheets", "store", "all");
  const [typeFilter, setTypeFilter] = usePersistentState("timesheets", "type", "all");
  const { org } = useSettings();
  // Varsayılan firma ayarından; kullanıcı değiştirirse hatırlanır
  const [dailyHours, setDailyHours] = usePersistentState("timesheets", "dailyHours", org.hr.dailyHours);
  const [brush, setBrush] = useState<Brush>("none");

  const [personnel, setPersonnel] = useState<Personnel[] | null>(null);
  const [entries, setEntries] = useState<Map<string, TimesheetEntry>>(new Map());
  /** Yıl içinde bu ay dışındaki fazla mesai; yıllık toplam = bu + aydaki kayıtlar */
  const [overtimeOutsideMonth, setOvertimeOutsideMonth] = useState<Record<string, number>>({});
  // Yükleme durumu, en son yüklenen aydan türetilir
  const [loadedMonth, setLoadedMonth] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [editing, setEditing] = useState<{ person: Personnel; date: string } | null>(null);
  const [submit, setSubmit] = useState<SubmitState>({ saving: false, error: "" });

  const days = useMemo(() => monthDays(month), [month]);
  const year = Number(month.slice(0, 4));
  const loading = loadedMonth !== month;
  const monthLock = lock?.month === month ? lock.lock : null;
  // Kapatılan ay salt okunurdur (sunucu da reddeder)
  const canWrite = (canAdd || canEdit) && lock?.month === month && !monthLock;

  const flash = (tone: "success" | "error", text: string) => {
    setNotice({ tone, text });
    window.setTimeout(() => setNotice(null), 3500);
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchAllPersonnel(), fetchTimesheet(days[0], days[days.length - 1]), fetchYearlyOvertime(year)])
      .then(([people, rows, overtime]) => {
        if (cancelled) return;
        setPersonnel(people);
        setEntries(new Map(rows.map((row) => [key(row.personnelId, row.workDate), row])));
        const outside = { ...overtime };
        for (const row of rows) outside[row.personnelId] = (outside[row.personnelId] ?? 0) - row.overtimeHours;
        setOvertimeOutsideMonth(outside);
        setLoadError(false);
      })
      .catch((err) => {
        console.error("Puantaj yüklenemedi:", err);
        if (!cancelled) setLoadError(true);
      })
      .finally(() => !cancelled && setLoadedMonth(month));
    return () => {
      cancelled = true;
    };
  }, [days, year, month]);

  useEffect(() => {
    let cancelled = false;
    fetchTimesheetLock(month)
      .then((next) => !cancelled && setLock({ month, lock: next }))
      // Faz 2 migration'ı yoksa kilit yok sayılır
      .catch(() => !cancelled && setLock({ month, lock: null }));
    return () => {
      cancelled = true;
    };
  }, [month]);

  const toggleLock = async () => {
    const label = format(parseISO(`${month}-01`), "MMMM yyyy", { locale: dateLocale });
    const logLabel = format(parseISO(`${month}-01`), "MMMM yyyy", { locale: trLocale });
    if (monthLock) {
      if (!confirm(t("hr.timesheets.unlockConfirm", { month: label }))) return;
    } else if (!confirm(`${t("hr.timesheets.lockConfirm", { month: label })}\n\n${t("hr.timesheets.lockConfirmHint")}`)) {
      return;
    }
    setBusy(true);
    try {
      if (monthLock) await unlockTimesheetMonth(month);
      else await lockTimesheetMonth(month);
      setLock({ month, lock: await fetchTimesheetLock(month) });
      log(`Puantaj ${monthLock ? "kilidi açıldı" : "kapatıldı"}: ${logLabel}`);
      flash("success", monthLock ? t("hr.timesheets.unlocked") : t("hr.timesheets.locked"));
    } catch (err) {
      console.error("Puantaj kilidi değiştirilemedi:", err);
      flash("error", hrErrorMessage(err, t("hr.timesheets.actionFailed")));
    } finally {
      setBusy(false);
    }
  };

  const rows = useMemo(() => {
    const term = query.trim().toLocaleLowerCase(locale);
    return (personnel ?? []).filter(
      (person) =>
        activeInMonth(person, month) &&
        (storeFilter === "all" || (storeFilter === "none" ? !person.storeId : person.storeId === storeFilter)) &&
        (typeFilter === "all" || person.employmentType === typeFilter) &&
        (!term ||
          [person.fullName, person.code, person.jobTitle, person.subcontractorCompany]
            .join(" ")
            .toLocaleLowerCase(locale)
            .includes(term))
    );
  }, [personnel, month, storeFilter, typeFilter, query, locale]);

  const storeName = useCallback((id?: string) => stores.find((store) => store.id === id)?.name, [stores]);

  const log = useCallback(
    (message: string) => {
      if (!user) return;
      logActivity({ category: "hr", action: "timesheet", message, actorId: user.id, actorName: user.name });
    },
    [user]
  );

  /** Kaydedilen ve silinen satırları yerel duruma işler */
  const applySaved = (saved: TimesheetEntry[], removed: TimesheetEntry[] = []) => {
    setEntries((prev) => {
      const next = new Map(prev);
      for (const entry of removed) next.delete(key(entry.personnelId, entry.workDate));
      for (const entry of saved) next.set(key(entry.personnelId, entry.workDate), entry);
      return next;
    });
  };

  const defaultInput = (person: Personnel, status: TimesheetStatus): TimesheetEntryInput => ({
    status,
    hours: status === "worked" ? dailyHours : status === "half_day" ? dailyHours / 2 : 0,
    overtimeHours: 0,
    storeId: person.storeId,
    notes: "",
  });

  const paint = async (person: Personnel, date: string) => {
    const existing = entries.get(key(person.id, date));
    try {
      if (brush === "clear") {
        if (!existing) return;
        await deleteTimesheetEntries([existing.id]);
        applySaved([], [existing]);
        return;
      }
      if (brush === "none" || existing?.status === brush) return;
      // Mevcut saha ve not korunur; saat yeni duruma göre
      const input = existing
        ? { ...defaultInput(person, brush), storeId: existing.storeId, notes: existing.notes }
        : defaultInput(person, brush);
      const saved = await upsertTimesheetEntries([{ ...input, personnelId: person.id, workDate: date }]);
      applySaved(saved);
    } catch (err) {
      console.error("Puantaj kaydedilemedi:", err);
      flash("error", hrErrorMessage(err, t("hr.timesheets.saveFailed")));
    }
  };

  /** Seçili personelin boş günlerini doldurur: Pazar → hafta tatili, diğer günler → çalıştı */
  const fillEmpty = async (people: Personnel[]) => {
    const batch: TimesheetUpsert[] = [];
    for (const person of people) {
      for (const day of days) {
        if (!employedOn(person, day) || entries.has(key(person.id, day))) continue;
        const status: TimesheetStatus = isSunday(day) ? "weekly_rest" : "worked";
        batch.push({ ...defaultInput(person, status), personnelId: person.id, workDate: day });
      }
    }
    if (batch.length === 0) {
      flash("success", t("hr.timesheets.nothingToFill"));
      return;
    }
    const scope = people.length === 1 ? people[0].fullName : `${people.length} personel`;
    const scopeLabel = people.length === 1 ? people[0].fullName : t("hr.timesheets.personnelCount", { count: people.length });
    if (
      !confirm(
        `${t(batch.length === 1 ? "hr.timesheets.fillConfirmOne" : "hr.timesheets.fillConfirmOther", { scope: scopeLabel, count: batch.length })}\n\n${t(
          "hr.timesheets.fillConfirmHint",
          { hours: formatHourCount(dailyHours) }
        )}`
      )
    )
      return;
    setBusy(true);
    try {
      const saved = await upsertTimesheetEntries(batch);
      applySaved(saved);
      log(`Puantaj dolduruldu: ${scope}, ${format(parseISO(`${month}-01`), "MMMM yyyy", { locale: trLocale })}`);
      flash("success", t("hr.timesheets.filled", { days: formatDayCount(saved.length) }));
    } catch (err) {
      console.error("Puantaj doldurulamadı:", err);
      flash("error", hrErrorMessage(err, t("hr.timesheets.fillFailed")));
    } finally {
      setBusy(false);
    }
  };

  /** Ayın günlük raporlarındaki isimli yoklamaları boş günlere aktarır */
  const importFromReports = async () => {
    setBusy(true);
    try {
      const { upserts, reportCount } = await planReportAttendanceImport(month, (personnelId, date) =>
        entries.has(key(personnelId, date))
      );
      if (upserts.length === 0) {
        flash(
          "success",
          reportCount === 0 ? t("hr.timesheets.noReports") : t("hr.timesheets.allImported")
        );
        return;
      }
      if (
        !confirm(
          `${t(reportCount === 1 ? "hr.timesheets.importConfirmOne" : "hr.timesheets.importConfirmOther", {
            count: reportCount,
            days: formatDayCount(upserts.length),
          })}\n\n${t("hr.timesheets.importConfirmHint")}`
        )
      )
        return;
      const saved = await upsertTimesheetEntries(upserts);
      applySaved(saved);
      log(`Puantaj raporlardan aktarıldı: ${format(parseISO(`${month}-01`), "MMMM yyyy", { locale: trLocale })}, ${saved.length} gün`);
      flash("success", t("hr.timesheets.imported", { days: formatDayCount(saved.length) }));
    } catch (err) {
      console.error("Raporlardan aktarılamadı:", err);
      flash("error", hrErrorMessage(err, t("hr.timesheets.importFailed")));
    } finally {
      setBusy(false);
    }
  };

  const onCellClick = (person: Personnel, date: string) => {
    if (!canWrite) return;
    if (brush !== "none") {
      void paint(person, date);
      return;
    }
    setSubmit({ saving: false, error: "" });
    setEditing({ person, date });
  };

  const changeMonth = (delta: number) => setMonth(format(addMonths(parseISO(`${month}-01`), delta), "yyyy-MM"));

  if (!canView && myLoaded && !myPersonnelId) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-zinc-500">
        {t("hr.personnelList.notLinked")}
      </div>
    );
  }

  const editingEntry = editing ? entries.get(key(editing.person.id, editing.date)) : undefined;

  return (
    <div className="scrollbar-themed h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">{canView ? t("hr.personnelDetail.timesheet") : t("hr.timesheets.myTitle")}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {canView
              ? t("hr.timesheets.description")
              : t("hr.timesheets.myDescription")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900/60">
            <button type="button" aria-label={t("hr.common.previousMonth")} onClick={() => changeMonth(-1)} className="p-2 text-zinc-400 hover:text-zinc-100">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[130px] text-center text-sm font-medium capitalize text-zinc-100">
              {format(parseISO(`${month}-01`), "MMMM yyyy", { locale: dateLocale })}
            </span>
            <button type="button" aria-label={t("hr.common.nextMonth")} onClick={() => changeMonth(1)} className="p-2 text-zinc-400 hover:text-zinc-100">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {monthLock ? (
            canDelete && (
              <Button variant="outline" disabled={busy} onClick={() => void toggleLock()}>
                <LockOpen className="h-4 w-4" />
                {t("hr.timesheets.unlock")}
              </Button>
            )
          ) : (
            canEdit &&
            lock?.month === month && (
              <Button variant="outline" disabled={busy} onClick={() => void toggleLock()}>
                <Lock className="h-4 w-4" />
                {t("hr.timesheets.lock")}
              </Button>
            )
          )}
          {canView && (
            <Button
              variant="outline"
              disabled={rows.length === 0}
              onClick={() =>
                void exportTimesheetXlsx({
                  month,
                  personnel: rows,
                  entries: [...entries.values()].filter((entry) => rows.some((person) => person.id === entry.personnelId)),
                  storeName,
                })
              }
            >
              <Download className="h-4 w-4" />
              Excel
            </Button>
          )}
        </div>
      </div>

      {monthLock && (
        <p className="mb-3 flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-2.5 text-sm text-zinc-300">
          <Lock className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
          {t("hr.timesheets.lockedNotice", {
            name: monthLock.lockedByName || "—",
            date: format(parseISO(monthLock.lockedAt), "d MMM yyyy HH:mm", { locale: dateLocale }),
          })}
        </p>
      )}

      {canView && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("hr.timesheets.searchPlaceholder")}
            aria-label={t("hr.personnelList.searchLabel")}
            containerClassName="flex-1 sm:max-w-xs"
          />
          <Select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)} className="w-auto min-w-[160px]" aria-label={t("hr.personnelList.location")}>
            <option value="all">{t("hr.timesheets.allLocations")}</option>
            <option value="none">{t("hr.personnelList.headOffice")}</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </Select>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-auto min-w-[170px]" aria-label={t("hr.common.employmentType")}>
            <option value="all">{t("hr.personnelList.allTypes")}</option>
            {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          {canWrite && (
            <>
              <Select
                value={dailyHours}
                onChange={(e) => setDailyHours(Number(e.target.value))}
                className="w-auto min-w-[130px]"
                aria-label={t("hr.timesheets.dailyHours")}
              >
                {DAILY_HOUR_OPTIONS.map((hours) => (
                  <option key={hours} value={hours}>
                    {t("hr.timesheets.dailyHoursOption", { hours: formatHours(hours) })}
                  </option>
                ))}
              </Select>
              <Button variant="outline" disabled={busy || rows.length === 0} onClick={() => void fillEmpty(rows)}>
                <WandSparkles className="h-4 w-4" />
                {t("hr.timesheets.fillEmpty")}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void importFromReports()}
                title={t("hr.timesheets.importHint")}
              >
                <ClipboardList className="h-4 w-4" />
                {t("hr.timesheets.import")}
              </Button>
            </>
          )}
        </div>
      )}

      {canWrite && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2">
          <span className="mr-1 text-xs text-zinc-500">{t("hr.timesheets.quickEntry")}</span>
          <button
            type="button"
            onClick={() => setBrush("none")}
            aria-pressed={brush === "none"}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs",
              brush === "none" ? "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30" : "text-zinc-400 hover:bg-zinc-800"
            )}
            title={t("hr.timesheets.detailedHint")}
          >
            <MousePointerClick className="h-3.5 w-3.5" />
            {t("hr.timesheets.detailed")}
          </button>
          {TIMESHEET_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setBrush(status)}
              aria-pressed={brush === status}
              title={TIMESHEET_STATUS[status].label}
              className={cn(
                "inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-md px-2 text-xs font-semibold",
                TIMESHEET_STATUS[status].style,
                brush === status ? "ring-2 ring-cyan-400" : "opacity-80 hover:opacity-100"
              )}
            >
              {TIMESHEET_STATUS[status].code}
              <span className="hidden font-normal xl:inline">{TIMESHEET_STATUS[status].label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setBrush("clear")}
            aria-pressed={brush === "clear"}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs",
              brush === "clear" ? "bg-red-500/15 text-red-300 ring-2 ring-red-400/60" : "text-zinc-400 hover:bg-zinc-800"
            )}
          >
            <Eraser className="h-3.5 w-3.5" />
            {t("hr.timesheets.clear")}
          </button>
        </div>
      )}

      {!canWrite && (
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
          {TIMESHEET_STATUSES.map((status) => (
            <span key={status}>
              <b className="font-semibold text-zinc-300">{TIMESHEET_STATUS[status].code}</b> {TIMESHEET_STATUS[status].label}
            </span>
          ))}
        </div>
      )}

      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={cn(
            "mb-3 rounded-lg border px-4 py-2.5 text-sm",
            notice.tone === "error" ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          )}
        >
          {notice.text}
        </p>
      )}
      {loadError && (
        <p role="alert" className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {t("hr.timesheets.loadFailed")}
        </p>
      )}

      {loading && !personnel ? (
        <div className="h-64 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40" aria-hidden />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-12 text-center text-sm text-zinc-500">
          {(personnel ?? []).length === 0 ? (
            canView ? (
              <>
                {t("hr.personnelList.empty")}{" "}
                <Link href="/hr/personnel" className="text-cyan-400 hover:underline">
                  {t("hr.timesheets.addPersonnel")}
                </Link>
                .
              </>
            ) : (
              t("hr.timesheets.noEntries")
            )
          ) : (
            t("hr.timesheets.noMatch")
          )}
        </div>
      ) : (
        <div className={cn("scrollbar-themed overflow-x-auto rounded-xl border border-zinc-800", loading && "opacity-60")}>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-950/80 text-zinc-500">
                <th className="sticky left-0 z-10 min-w-[200px] border-b border-r border-zinc-800 bg-zinc-950 px-3 py-2 text-left font-medium">
                  {t("hr.leaveForm.personnel")}
                </th>
                {days.map((day) => (
                  <th
                    key={day}
                    className={cn(
                      "min-w-[30px] border-b border-zinc-800 px-0.5 py-1.5 text-center font-medium tabular-nums",
                      isSunday(day) && "bg-zinc-900/80 text-zinc-400",
                      isSaturday(day) && "bg-zinc-900/40"
                    )}
                  >
                    <div>{Number(day.slice(8))}</div>
                    <div className="text-[9px] font-normal opacity-70">{t("hr.timesheets.weekdays").split(",")[parseISO(day).getDay()]}</div>
                  </th>
                ))}
                <th className="border-b border-l border-zinc-800 px-2 py-2 text-right font-medium" title={t("hr.lib.timesheetExport.workedDays")}>
                  {t("hr.timesheets.colDays")}
                </th>
                <th className="border-b border-zinc-800 px-2 py-2 text-right font-medium" title={t("hr.lib.timesheetExport.overtime")}>
                  {t("hr.timesheets.colOvertime")}
                </th>
                <th className="border-b border-zinc-800 px-2 py-2 text-right font-medium" title={t("hr.timesheets.colLeaveTitle")}>
                  {t("hr.timesheets.colLeave")}
                </th>
                <th className="border-b border-zinc-800 px-2 py-2 text-right font-medium" title={t("hr.lib.timesheetExport.sick")}>
                  {t("hr.timesheets.colSick")}
                </th>
                <th className="border-b border-zinc-800 px-2 py-2 text-right font-medium" title={t("hr.timesheets.colAbsentTitle")}>
                  {t("hr.timesheets.colAbsent")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((person) => {
                const own = days.map((day) => entries.get(key(person.id, day))).filter(Boolean) as TimesheetEntry[];
                const summary = summarizeTimesheet(own);
                const yearOvertime = (overtimeOutsideMonth[person.id] ?? 0) + summary.overtime;
                const overLimit = yearOvertime > MAX_YEARLY_OVERTIME;
                return (
                  <tr key={person.id} className="group">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-b border-r border-zinc-800 bg-zinc-950 px-3 py-1.5 text-left font-normal group-hover:bg-zinc-900"
                    >
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <Link href={`/hr/personnel/${person.id}`} className="block truncate text-sm text-zinc-200 hover:text-cyan-300">
                            {person.fullName}
                          </Link>
                          <p className="truncate text-[11px] text-zinc-500">
                            {[person.code, person.jobTitle || EMPLOYMENT_TYPE_LABELS[person.employmentType]].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        {overLimit && (
                          <span title={t("hr.timesheets.overtimeLimitTitle", { year, hours: formatHourCount(yearOvertime) })}>
                            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" aria-label={t("hr.timesheets.overtimeLimit")} />
                          </span>
                        )}
                        {canWrite && (
                          <button
                            type="button"
                            onClick={() => void fillEmpty([person])}
                            disabled={busy}
                            title={t("hr.timesheets.fillPersonTitle")}
                            aria-label={t("hr.timesheets.fillPersonLabel", { name: person.fullName })}
                            className="rounded p-1 text-zinc-600 opacity-0 hover:bg-zinc-800 hover:text-zinc-200 group-hover:opacity-100 focus:opacity-100"
                          >
                            <WandSparkles className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </th>
                    {days.map((day) => {
                      const employed = employedOn(person, day);
                      const entry = entries.get(key(person.id, day));
                      const meta = entry ? TIMESHEET_STATUS[entry.status] : null;
                      const tooLong = entry && WORKING_STATUSES.includes(entry.status) && entry.hours + entry.overtimeHours > MAX_DAILY_HOURS;
                      const title = !employed
                        ? t("hr.timesheets.outsideEmployment")
                        : entry
                          ? [
                              meta!.label,
                              WORKING_STATUSES.includes(entry.status) && t("hr.common.hoursShort", { hours: formatHours(entry.hours) }),
                              entry.overtimeHours > 0 && t("hr.timesheets.overtimeCell", { hours: formatHours(entry.overtimeHours) }),
                              storeName(entry.storeId),
                              entry.leaveRequestId && t("hr.timesheets.fromLeaveRequest"),
                              entry.notes,
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : t("hr.timesheets.empty");
                      return (
                        <td
                          key={day}
                          className={cn(
                            "border-b border-zinc-800/70 p-0.5 text-center",
                            isSunday(day) && "bg-zinc-900/60",
                            isSaturday(day) && "bg-zinc-900/25"
                          )}
                        >
                          {employed ? (
                            <button
                              type="button"
                              disabled={!canWrite && !entry}
                              onClick={() => onCellClick(person, day)}
                              title={title}
                              aria-label={`${person.fullName}, ${day}: ${title}`}
                              className={cn(
                                "relative flex h-7 w-full min-w-[26px] items-center justify-center rounded text-[11px] font-semibold tabular-nums",
                                meta ? meta.style : "text-zinc-700",
                                canWrite ? "cursor-pointer hover:ring-1 hover:ring-cyan-500/60" : "cursor-default",
                                tooLong && "ring-1 ring-red-500/70"
                              )}
                            >
                              {meta?.code ?? "·"}
                              {entry && entry.overtimeHours > 0 && (
                                <span className="absolute right-0.5 top-0.5 h-1 w-1 rounded-full bg-amber-400" aria-hidden />
                              )}
                            </button>
                          ) : (
                            <span className="block h-7 rounded bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,rgb(39_39_42/0.6)_3px,rgb(39_39_42/0.6)_5px)]" title={title} />
                          )}
                        </td>
                      );
                    })}
                    <td className="border-b border-l border-zinc-800 px-2 text-right tabular-nums text-zinc-200">{formatHours(summary.workedDays)}</td>
                    <td className={cn("border-b border-zinc-800 px-2 text-right tabular-nums", summary.overtime ? "text-amber-300" : "text-zinc-600")}>
                      {formatHours(summary.overtime)}
                    </td>
                    <td className="border-b border-zinc-800 px-2 text-right tabular-nums text-zinc-300">{summary.annualLeave + summary.otherLeave}</td>
                    <td className="border-b border-zinc-800 px-2 text-right tabular-nums text-zinc-300">{summary.sick}</td>
                    <td className={cn("border-b border-zinc-800 px-2 text-right tabular-nums", summary.absent ? "text-red-400" : "text-zinc-300")}>
                      {summary.absent}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {canWrite && rows.length > 0 && (
        <p className="mt-3 text-xs text-zinc-500">
          {t("hr.timesheets.legend")}
        </p>
      )}

      {editing && (
        <TimesheetEntryModal
          person={editing.person}
          date={editing.date}
          entry={editingEntry ?? null}
          defaultHours={dailyHours}
          state={submit}
          onClose={() => setEditing(null)}
          onClear={
            editingEntry
              ? () => {
                  setSubmit({ saving: true, error: "" });
                  deleteTimesheetEntries([editingEntry.id])
                    .then(() => {
                      applySaved([], [editingEntry]);
                      setEditing(null);
                    })
                    .catch((err) => setSubmit({ saving: false, error: hrErrorMessage(err, t("hr.timesheets.clearFailed")) }));
                }
              : undefined
          }
          onSubmit={(input) => {
            setSubmit({ saving: true, error: "" });
            upsertTimesheetEntries([{ ...input, personnelId: editing.person.id, workDate: editing.date }])
              .then((saved) => {
                applySaved(saved);
                setEditing(null);
              })
              .catch((err) => {
                console.error("Puantaj kaydedilemedi:", err);
                setSubmit({ saving: false, error: hrErrorMessage(err, t("hr.timesheets.saveFailed")) });
              });
          }}
        />
      )}
    </div>
  );
}

export default function TimesheetsPage() {
  return (
    <AuthGuard routeKey="timesheets">
      <TimesheetsContent />
    </AuthGuard>
  );
}

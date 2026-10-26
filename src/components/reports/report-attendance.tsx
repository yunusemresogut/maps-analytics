"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarOff, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useSettings } from "@/contexts/settings-context";
import { usePermissions } from "@/hooks/use-permissions";
import {
  ATTENDANCE_STATUS_LABELS,
  attendancePresent,
  type AttendanceStatus,
  type ReportAttendance,
} from "@/lib/daily-site-report";
import {
  MAX_DAILY_HOURS,
  TIMESHEET_STATUS,
  employedOn,
  fetchAllPersonnel,
  fetchTimesheet,
  isLeaveEntry,
  type Personnel,
  type TimesheetEntry,
} from "@/lib/hr";

/**
 * Günlük rapordaki isimli yoklama. Personel listesi puantaj görüntüleme yetkisi
 * ister; rapor kaydedilirken (yazma yetkisi varsa) puantaja işlenir.
 */
export function ReportAttendanceSection({
  storeId,
  date,
  attendance,
  onChange,
  autoFill,
}: {
  storeId: string;
  date: string;
  attendance: ReportAttendance[];
  onChange: (attendance: ReportAttendance[]) => void;
  /** Yeni raporda saha seçilince sahaya bağlı personel kendiliğinden eklenir */
  autoFill: boolean;
}) {
  const { canView } = usePermissions("timesheets");
  const { org, isModuleEnabled } = useSettings();
  const enabled = canView && isModuleEnabled("timesheets");
  const dailyHours = org.hr.dailyHours;
  const [personnel, setPersonnel] = useState<Personnel[] | null>(null);
  const [dayEntries, setDayEntries] = useState<{ date: string; entries: TimesheetEntry[] } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetchAllPersonnel()
      .then((rows) => !cancelled && setPersonnel(rows))
      .catch((err) => console.warn("Personel listesi yüklenemedi:", err));
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !date) return;
    let cancelled = false;
    fetchTimesheet(date, date)
      .then((entries) => !cancelled && setDayEntries({ date, entries }))
      .catch((err) => console.warn("Günün puantajı yüklenemedi:", err));
    return () => {
      cancelled = true;
    };
  }, [enabled, date]);

  /** Bu gün izinli / raporlu olanlar: yoklamaya eklenmez, puantajları değişmez */
  const leaveByPerson = useMemo(() => {
    const map = new Map<string, TimesheetEntry>();
    if (dayEntries?.date === date) for (const entry of dayEntries.entries) if (isLeaveEntry(entry)) map.set(entry.personnelId, entry);
    return map;
  }, [dayEntries, date]);

  const listed = new Set(attendance.map((row) => row.personnelId));
  const available = (personnel ?? []).filter((person) => employedOn(person, date) && !listed.has(person.id));
  const assigned = available.filter((person) => person.storeId === storeId && !leaveByPerson.has(person.id));
  const assignedOnLeave = (personnel ?? []).filter(
    (person) => person.storeId === storeId && employedOn(person, date) && leaveByPerson.has(person.id)
  );

  const rowFor = (person: Personnel): ReportAttendance => ({
    personnelId: person.id,
    name: person.fullName,
    jobTitle: person.jobTitle,
    status: "worked",
    hours: dailyHours,
    overtimeHours: 0,
  });

  const addPeople = (people: Personnel[]) => {
    if (people.length > 0) onChange([...attendance, ...people.map(rowFor)]);
  };

  // Yeni raporda saha seçilince (yoklama boşsa) sahaya bağlı personel eklenir
  const autoFilledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!autoFill || !storeId || !personnel || dayEntries?.date !== date) return;
    if (autoFilledFor.current === storeId || attendance.length > 0) return;
    autoFilledFor.current = storeId;
    if (assigned.length > 0) onChange(assigned.map(rowFor));
    // Yalnızca saha / veri değişince çalışır
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFill, storeId, personnel, dayEntries, date]);

  const updateRow = (personnelId: string, patch: Partial<ReportAttendance>) =>
    onChange(attendance.map((row) => (row.personnelId === personnelId ? { ...row, ...patch } : row)));

  if (!enabled) {
    return attendance.length > 0 ? (
      <p className="text-xs text-zinc-500">
        Raporda {attendance.length} kişilik isimli yoklama var; görmek ve değiştirmek için puantaj görüntüleme yetkisi gerekir.
      </p>
    ) : null;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">İsimli yoklama</h3>
          <p className="text-xs text-zinc-500">
            {attendance.length > 0
              ? `${attendancePresent(attendance)} kişi sahada, ${attendance.length - attendancePresent(attendance)} kişi gelmedi`
              : storeId
                ? "Bu sahaya bağlı personeli ekleyin ya da listeden seçin."
                : "Önce şantiye seçin."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {assigned.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => addPeople(assigned)}>
              <Users className="h-3.5 w-3.5" />
              Sahadaki personel ({assigned.length})
            </Button>
          )}
          {available.length > 0 && (
            <Select
              value=""
              onChange={(e) => {
                const person = available.find((p) => p.id === e.target.value);
                if (person) addPeople([person]);
              }}
              placeholder="Personel ekle…"
              className="h-8 w-48 text-xs"
              aria-label="Yoklamaya personel ekle"
            >
              {available.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName}
                  {leaveByPerson.has(person.id) ? " (izinli)" : ""}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      {attendance.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <div className="hidden grid-cols-[minmax(0,1fr)_150px_90px_90px_36px] gap-2 bg-zinc-950/60 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500 sm:grid">
            <span>Personel</span>
            <span>Durum</span>
            <span>Normal (sa)</span>
            <span>Fazla mesai</span>
            <span />
          </div>
          <ul className="divide-y divide-zinc-800">
            {attendance.map((row) => {
              const leave = leaveByPerson.get(row.personnelId);
              const total = row.status === "absent" ? 0 : row.hours + row.overtimeHours;
              return (
                <li
                  key={row.personnelId}
                  className="grid grid-cols-2 items-center gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_150px_90px_90px_36px]"
                >
                  <div className="col-span-2 min-w-0 sm:col-span-1">
                    <Link href={`/hr/personnel/${row.personnelId}`} className="truncate text-sm text-zinc-200 hover:text-cyan-300">
                      {row.name}
                    </Link>
                    <p className="truncate text-xs text-zinc-500">
                      {leave ? (
                        <span className="text-amber-400">
                          Puantajda {TIMESHEET_STATUS[leave.status].label.toLocaleLowerCase("tr-TR")}; puantaja işlenmez
                        </span>
                      ) : (
                        row.jobTitle || "—"
                      )}
                    </p>
                  </div>
                  <Select
                    value={row.status}
                    onChange={(e) => updateRow(row.personnelId, { status: e.target.value as AttendanceStatus })}
                    aria-label={`${row.name} durum`}
                    className="h-8 text-xs"
                  >
                    {Object.entries(ATTENDANCE_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    max={24}
                    step={0.5}
                    value={row.status === "absent" ? "" : row.hours}
                    disabled={row.status === "absent"}
                    onChange={(e) => updateRow(row.personnelId, { hours: Math.max(0, Number(e.target.value) || 0) })}
                    aria-label={`${row.name} normal çalışma saati`}
                    className="h-8 text-xs tabular-nums"
                  />
                  <Input
                    type="number"
                    min={0}
                    max={24}
                    step={0.5}
                    value={row.status === "absent" ? "" : row.overtimeHours}
                    disabled={row.status === "absent"}
                    onChange={(e) => updateRow(row.personnelId, { overtimeHours: Math.max(0, Number(e.target.value) || 0) })}
                    aria-label={`${row.name} fazla mesai`}
                    aria-invalid={total > MAX_DAILY_HOURS}
                    title={total > MAX_DAILY_HOURS ? "Günlük çalışma 11 saati aşamaz (İş Kanunu md. 63)" : undefined}
                    className="h-8 text-xs tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => onChange(attendance.filter((item) => item.personnelId !== row.personnelId))}
                    className="justify-self-end rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800/50 hover:text-red-400"
                    aria-label={`${row.name} yoklamadan çıkar`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {assignedOnLeave.length > 0 && (
        <p className="flex flex-wrap items-center gap-1 text-xs text-zinc-500">
          <CalendarOff className="h-3.5 w-3.5" aria-hidden />
          Bugün izinli:{" "}
          {assignedOnLeave
            .map((person) => `${person.fullName} (${TIMESHEET_STATUS[leaveByPerson.get(person.id)!.status].label.toLocaleLowerCase("tr-TR")})`)
            .join(", ")}
        </p>
      )}
    </div>
  );
}

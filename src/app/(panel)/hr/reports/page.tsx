"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addMonths, format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { formatDay } from "@/components/hr/hr-modals";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/contexts/settings-context";
import { useStores } from "@/contexts/stores-context";
import { usePermissions } from "@/hooks/use-permissions";
import {
  CERTIFICATE_TYPE_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  MAX_YEARLY_OVERTIME,
  fetchActiveCertificates,
  fetchAllPersonnel,
  fetchTimesheet,
  fetchYearlyOvertime,
  formatHours,
  monthDays,
  summarizeTimesheet,
  type Certificate,
  type CertificateType,
  type EmploymentType,
  type Personnel,
  type TimesheetEntry,
} from "@/lib/hr";
import { PENDING_STATUSES, computeLeaveBalance, fetchLeaveRequests, type LeaveRequest } from "@/lib/leaves";
import { cn } from "@/lib/utils";

/** Fazla mesai bu saati geçince uyarı (yıllık sınır 270) */
const OVERTIME_WARNING = 200;

type Table = { title: string; header: string[]; rows: (string | number)[][] };

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40">
      <div className="border-b border-zinc-800 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-4 py-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums text-zinc-100", tone)}>{value}</p>
    </div>
  );
}

function DataTable({ table, empty }: { table: Table; empty: string }) {
  if (table.rows.length === 0) return <p className="text-sm text-zinc-500">{empty}</p>;
  return (
    <div className="scrollbar-themed overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs text-zinc-500">
            {table.header.map((cell, index) => (
              <th key={cell} className={cn("border-b border-zinc-800 px-2 py-2 font-medium", index > 0 && "text-right")}>
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-zinc-900/60">
              {row.map((cell, index) => (
                <td key={index} className={cn("border-b border-zinc-800/60 px-2 py-1.5 text-zinc-300", index > 0 && "text-right tabular-nums")}>
                  {typeof cell === "number" ? formatHours(cell) : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function exportTables(tables: Table[], fileName: string) {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  for (const table of tables) {
    const sheet = XLSX.utils.aoa_to_sheet([table.header, ...table.rows]);
    // Sayfa adı en çok 31 karakter, : \ / ? * [ ] olmadan
    XLSX.utils.book_append_sheet(book, sheet, table.title.replace(/[:\\/?*[\]]/g, "").slice(0, 31));
  }
  const buffer = XLSX.write(book, { bookType: "xlsx", type: "array" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function HrReportsContent() {
  const { stores } = useStores();
  const { isModuleEnabled } = useSettings();
  const { canView: canPersonnel } = usePermissions("personnel");
  const { canView: canLeaves } = usePermissions("leaves");
  const { canView: canTimesheets } = usePermissions("timesheets");
  const showLeaves = canLeaves && isModuleEnabled("leaves");
  const showTimesheets = canTimesheets && isModuleEnabled("timesheets");

  const year = new Date().getFullYear();
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [personnel, setPersonnel] = useState<Personnel[] | null>(null);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [entries, setEntries] = useState<{ month: string; rows: TimesheetEntry[]; overtime: Record<string, number> } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchAllPersonnel(),
      fetchActiveCertificates(),
      showLeaves ? fetchLeaveRequests({ statuses: ["approved", ...PENDING_STATUSES] }) : Promise.resolve([]),
    ])
      .then(([people, certs, leaveRows]) => {
        if (cancelled) return;
        setPersonnel(people);
        setCertificates(certs);
        setLeaves(leaveRows);
      })
      .catch((err) => {
        console.error("İK raporu yüklenemedi:", err);
        if (!cancelled) setError("Rapor verisi yüklenemedi. İK migration'ları uygulanmamış olabilir.");
      });
    return () => {
      cancelled = true;
    };
  }, [showLeaves]);

  useEffect(() => {
    if (!showTimesheets) return;
    let cancelled = false;
    const days = monthDays(month);
    Promise.all([fetchTimesheet(days[0], days[days.length - 1]), fetchYearlyOvertime(Number(month.slice(0, 4)))])
      .then(([rows, overtime]) => !cancelled && setEntries({ month, rows, overtime }))
      .catch((err) => console.error("Puantaj raporu yüklenemedi:", err));
    return () => {
      cancelled = true;
    };
  }, [month, showTimesheets]);

  const storeName = (id?: string) => (id ? (stores.find((s) => s.id === id)?.name ?? "—") : "Merkez");

  // ---- Personel ----
  const active = useMemo(() => (personnel ?? []).filter((p) => p.state === "active"), [personnel]);
  const hiredThisYear = (personnel ?? []).filter((p) => p.startDate.startsWith(String(year))).length;
  const leftThisYear = (personnel ?? []).filter((p) => p.endDate.startsWith(String(year)) && p.state === "left").length;
  const byType: Table = {
    title: "Çalışma tipine göre",
    header: ["Çalışma tipi", "Personel"],
    rows: (Object.keys(EMPLOYMENT_TYPE_LABELS) as EmploymentType[])
      .map((type) => [EMPLOYMENT_TYPE_LABELS[type], active.filter((p) => p.employmentType === type).length] as (string | number)[])
      .filter((row) => (row[1] as number) > 0),
  };
  const byStore: Table = {
    title: "Görev yerine göre",
    header: ["Görev yeri", "Personel", "Taşeron"],
    rows: [...new Set(active.map((p) => p.storeId ?? ""))]
      .map((id) => {
        const group = active.filter((p) => (p.storeId ?? "") === id);
        return [storeName(id || undefined), group.length, group.filter((p) => p.employmentType === "subcontractor").length];
      })
      .sort((a, b) => (b[1] as number) - (a[1] as number)),
  };

  // ---- Belgeler ----
  const certTable: Table = {
    title: "Belge uyumu",
    header: ["Belge türü", "Geçerli", "30 günde bitiyor", "Süresi geçmiş", "Onay bekliyor"],
    rows: (Object.keys(CERTIFICATE_TYPE_LABELS) as CertificateType[])
      .map((type) => {
        const group = certificates.filter((c) => c.type === type);
        return [
          CERTIFICATE_TYPE_LABELS[type],
          group.filter((c) => c.validity === "valid" || c.validity === "permanent").length,
          group.filter((c) => c.validity === "expiring").length,
          group.filter((c) => c.validity === "expired").length,
          group.filter((c) => !c.verified).length,
        ];
      })
      .filter((row) => row.slice(1).some((cell) => (cell as number) > 0)),
  };
  const expiredTable: Table = {
    title: "Süresi geçmiş belgeler",
    header: ["Personel", "Belge", "Bitiş"],
    rows: certificates
      .filter((c) => c.validity === "expired")
      .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))
      .map((c) => [c.personnelName, c.name || CERTIFICATE_TYPE_LABELS[c.type], formatDay(c.expiresAt)]),
  };

  // ---- İzin ----
  const leaveTable: Table = {
    title: "Yıllık izin durumu",
    header: ["Personel", "Hizmet yılı", "Hak edilen", "Kullanılan", "Bekleyen", "Kalan"],
    rows: active
      .filter((p) => p.employmentType !== "subcontractor" && p.startDate)
      .flatMap((p) => {
        const balance = computeLeaveBalance({
          startDate: p.startDate,
          adjustment: p.leaveAdjustment,
          requests: leaves.filter((r) => r.personnelId === p.id),
        });
        return balance
          ? [[p.fullName, balance.serviceYears, balance.earned + balance.adjustment, balance.used, balance.pending, balance.remaining]]
          : [];
      })
      .sort((a, b) => (b[5] as number) - (a[5] as number)),
  };

  // ---- Puantaj ----
  const monthEntries = entries?.month === month ? entries.rows : [];
  const timesheetByStore: Table = {
    title: `Puantaj ${month}`,
    header: ["Saha", "Kişi", "Çalışılan gün", "Fazla mesai (sa)", "İzin", "Rapor", "Devamsız"],
    rows: [...new Set(monthEntries.map((e) => e.storeId ?? ""))]
      .map((id) => {
        const group = monthEntries.filter((e) => (e.storeId ?? "") === id);
        const summary = summarizeTimesheet(group);
        return [
          storeName(id || undefined),
          new Set(group.filter((e) => e.status === "worked" || e.status === "half_day").map((e) => e.personnelId)).size,
          summary.workedDays,
          summary.overtime,
          summary.annualLeave + summary.otherLeave,
          summary.sick,
          summary.absent,
        ];
      })
      .sort((a, b) => (b[2] as number) - (a[2] as number)),
  };
  const overtimeTable: Table = {
    title: `Fazla mesai ${month.slice(0, 4)}`,
    header: ["Personel", "Yıllık fazla mesai (sa)", "Sınıra kalan (sa)"],
    rows: Object.entries(entries?.month === month ? entries.overtime : {})
      .filter(([, hours]) => hours >= OVERTIME_WARNING)
      .sort((a, b) => b[1] - a[1])
      .map(([id, hours]) => [
        (personnel ?? []).find((p) => p.id === id)?.fullName ?? "—",
        hours,
        Math.max(0, MAX_YEARLY_OVERTIME - hours),
      ]),
  };

  const tables = [
    byType,
    byStore,
    certTable,
    expiredTable,
    ...(showLeaves ? [leaveTable] : []),
    ...(showTimesheets ? [timesheetByStore, overtimeTable] : []),
  ];

  if (!canPersonnel) {
    return <div className="flex h-full items-center justify-center text-sm text-zinc-500">İK raporları için personel görüntüleme yetkisi gerekir.</div>;
  }

  return (
    <div className="scrollbar-themed h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">İK raporları</h1>
          <p className="mt-1 text-sm text-zinc-500">Personel dağılımı, belge uyumu, izin kullanımı ve puantaj özeti.</p>
        </div>
        <Button variant="outline" disabled={!personnel} onClick={() => void exportTables(tables, `ik_raporu_${month}.xlsx`)}>
          <Download className="h-4 w-4" />
          Excel
        </Button>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}

      {!personnel && !error ? (
        <div className="h-64 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40" aria-hidden />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Çalışan personel" value={active.length} />
            <Stat label={`${year} işe giriş`} value={hiredThisYear} tone="text-emerald-400" />
            <Stat label={`${year} ayrılış`} value={leftThisYear} tone="text-amber-400" />
            <Stat
              label="Süresi geçmiş belge"
              value={expiredTable.rows.length}
              tone={expiredTable.rows.length > 0 ? "text-red-400" : undefined}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Section title="Çalışma tipine göre">
              <DataTable table={byType} empty="Personel yok." />
            </Section>
            <Section title="Görev yerine göre">
              <DataTable table={byStore} empty="Personel yok." />
            </Section>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Section title="Belge uyumu" description="Çalışan personelin belgeleri, türe göre">
              <DataTable table={certTable} empty="Belge kaydı yok." />
            </Section>
            <Section title="Süresi geçmiş belgeler">
              <DataTable table={expiredTable} empty="Süresi geçmiş belge yok." />
              {expiredTable.rows.length > 0 && (
                <Link href="/hr/certificates" className="mt-3 inline-block text-xs text-cyan-400 hover:underline">
                  Belgelere git
                </Link>
              )}
            </Section>
          </div>

          {showLeaves && (
            <Section
              title="Yıllık izin durumu"
              description="İş Kanunu md. 53'e göre; yaş kuralı (18 yaş altı / 50 yaş üstü en az 20 gün) bu tabloda uygulanmaz, personel kartına bakın"
            >
              <DataTable table={leaveTable} empty="İşe giriş tarihi girilmiş personel yok." />
            </Section>
          )}

          {showTimesheets && (
            <div className="grid gap-5 xl:grid-cols-2">
              <Section title="Puantaj özeti" description="Sahaya göre, seçili ay">
                <div className="mb-3 flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Önceki ay"
                    onClick={() => setMonth(format(addMonths(parseISO(`${month}-01`), -1), "yyyy-MM"))}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="min-w-[120px] text-center text-sm capitalize text-zinc-200">
                    {format(parseISO(`${month}-01`), "MMMM yyyy", { locale: tr })}
                  </span>
                  <button
                    type="button"
                    aria-label="Sonraki ay"
                    onClick={() => setMonth(format(addMonths(parseISO(`${month}-01`), 1), "yyyy-MM"))}
                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <DataTable table={timesheetByStore} empty="Bu ay puantaj kaydı yok." />
              </Section>
              <Section
                title="Fazla mesai riski"
                description={`Yıllık fazla mesaisi ${OVERTIME_WARNING} saati geçenler (İş Kanunu md. 41: yılda en çok ${MAX_YEARLY_OVERTIME} saat)`}
              >
                <DataTable table={overtimeTable} empty="Sınıra yaklaşan personel yok." />
              </Section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HrReportsPage() {
  return (
    <AuthGuard routeKey="hrReports">
      <HrReportsContent />
    </AuthGuard>
  );
}

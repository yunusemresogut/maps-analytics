import { format, isValid, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import {
  ATTENDANCE_STATUS_LABELS,
  attendancePresent,
  crewTotal,
  type DailySiteReport,
} from "@/lib/daily-site-report";
import type { Store } from "@/types";
import { cn } from "@/lib/utils";

/**
 * Raporun A4 sayfası: önizlemede ve yazdırırken (PDF) aynı bileşen kullanılır.
 * Renkler temadan bağımsızdır (neutral/beyaz); zinc tonları açık temada ters
 * çevrildiği için kâğıtta kullanılmaz.
 */

const BRAND = "#2f55a8";

function formatReportDate(value: string): string {
  const date = parseISO(value);
  return isValid(date) ? format(date, "d MMMM yyyy, EEEE", { locale: tr }) : "—";
}

function InfoCell({ label, value, className }: { label: string; value?: string; className?: string }) {
  return (
    <div className={cn("border-b border-r border-neutral-300 px-3 py-2", className)}>
      <div className="text-[9px] font-semibold uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-0.5 text-[11px] text-neutral-900">{value?.trim() || "—"}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid">
      <h3
        className="border-b-2 pb-1 text-[11px] font-bold uppercase tracking-wide"
        style={{ color: BRAND, borderColor: BRAND }}
      >
        {title}
      </h3>
      <div className="mt-2 text-[11px] leading-relaxed text-neutral-800">{children}</div>
    </section>
  );
}

function TextBlock({ value }: { value: string }) {
  return value.trim() ? (
    <p className="whitespace-pre-wrap">{value.trim()}</p>
  ) : (
    <p className="text-neutral-400">Belirtilmedi</p>
  );
}

type DailySiteReportDocumentProps = {
  report: DailySiteReport;
  store?: Store;
  organizationName?: string;
  className?: string;
};

export function DailySiteReportDocument({
  report,
  store,
  organizationName,
  className,
}: DailySiteReportDocumentProps) {
  const crew = report.crew.filter((row) => row.trade.trim() || row.count);
  const location = store ? [store.address, store.district, store.city].filter(Boolean).join(", ") : "";
  const weather = [report.weather, report.temperature.trim() && `${report.temperature.trim()} °C`]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      className={cn(
        "daily-site-report mx-auto w-[210mm] max-w-full bg-white px-[14mm] py-[12mm] font-sans text-neutral-900",
        className
      )}
    >
      <header className="flex items-start justify-between gap-6 border-b-4 pb-3" style={{ borderColor: BRAND }}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
            {organizationName || "Şantiye"}
          </p>
          <h1 className="mt-1 text-[20px] font-bold tracking-tight" style={{ color: BRAND }}>
            Günlük Şantiye Raporu
          </h1>
        </div>
        <div className="text-right text-[11px] text-neutral-700">
          <div className="font-semibold text-neutral-900">{formatReportDate(report.date)}</div>
          <div className="mt-0.5">{store?.name ?? "Şantiye seçilmedi"}</div>
        </div>
      </header>

      <div className="mt-4 grid grid-cols-2 border-l border-t border-neutral-300">
        <InfoCell label="Saha" value={store?.name} />
        <InfoCell label="Tarih" value={formatReportDate(report.date)} />
        <InfoCell label="Adres" value={location} className="col-span-2" />
        <InfoCell label="Yüklenici firma" value={report.contractor} />
        <InfoCell label="Hava durumu" value={weather} />
        <InfoCell label="Şantiye şefi" value={report.siteManager} />
        <InfoCell label="Hazırlayan" value={report.preparedBy} />
      </div>

      <Section title="Sahadaki personel">
        {crew.length === 0 && report.attendance.length === 0 && <p className="text-neutral-400">Belirtilmedi</p>}
        {report.attendance.length > 0 && (
          <table className="mb-2 w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-neutral-100 text-left text-[9px] uppercase tracking-wide text-neutral-600">
                <th className="border border-neutral-300 px-2 py-1 font-semibold">Ad soyad</th>
                <th className="border border-neutral-300 px-2 py-1 font-semibold">Görev</th>
                <th className="w-24 border border-neutral-300 px-2 py-1 font-semibold">Durum</th>
                <th className="w-24 border border-neutral-300 px-2 py-1 text-right font-semibold">Fazla mesai</th>
              </tr>
            </thead>
            <tbody>
              {report.attendance.map((row) => (
                <tr key={row.personnelId}>
                  <td className="border border-neutral-300 px-2 py-1">{row.name}</td>
                  <td className="border border-neutral-300 px-2 py-1">{row.jobTitle || "—"}</td>
                  <td className="border border-neutral-300 px-2 py-1">{ATTENDANCE_STATUS_LABELS[row.status]}</td>
                  <td className="border border-neutral-300 px-2 py-1 text-right tabular-nums">
                    {row.status !== "absent" && row.overtimeHours > 0 ? `${row.overtimeHours} sa` : "—"}
                  </td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td colSpan={3} className="border border-neutral-300 px-2 py-1 text-right">
                  Sahada
                </td>
                <td className="border border-neutral-300 px-2 py-1 text-right tabular-nums">
                  {attendancePresent(report.attendance)} kişi
                </td>
              </tr>
            </tbody>
          </table>
        )}
        {crew.length > 0 && (
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-neutral-100 text-left text-[9px] uppercase tracking-wide text-neutral-600">
                <th className="border border-neutral-300 px-2 py-1 font-semibold">Ekip / Meslek</th>
                <th className="w-24 border border-neutral-300 px-2 py-1 text-right font-semibold">Kişi</th>
              </tr>
            </thead>
            <tbody>
              {crew.map((row) => (
                <tr key={row.id}>
                  <td className="border border-neutral-300 px-2 py-1">{row.trade.trim() || "—"}</td>
                  <td className="border border-neutral-300 px-2 py-1 text-right tabular-nums">{row.count ?? 0}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="border border-neutral-300 px-2 py-1 text-right">Toplam</td>
                <td className="border border-neutral-300 px-2 py-1 text-right tabular-nums">{crewTotal(crew)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Bugün yapılan işler">
        <TextBlock value={report.worksDone} />
      </Section>
      <Section title="Gelen malzeme ve ekipman">
        <TextBlock value={report.materialsReceived} />
      </Section>
      <Section title="Sorunlar, gecikmeler ve talepler">
        <TextBlock value={report.issues} />
      </Section>
      <Section title="İş güvenliği">
        <TextBlock value={report.safetyNotes} />
      </Section>
      <Section title="Yarın planlanan işler">
        <TextBlock value={report.tomorrowPlan} />
      </Section>

      <div className="mt-8 grid grid-cols-2 gap-8 break-inside-avoid text-[10px] text-neutral-600">
        {[
          { label: "Hazırlayan", name: report.preparedBy },
          { label: "Şantiye şefi", name: report.siteManager },
        ].map((signer) => (
          <div key={signer.label}>
            <div className="h-12 border-b border-neutral-400" />
            <div className="mt-1 font-semibold text-neutral-800">{signer.name.trim() || " "}</div>
            <div>{signer.label} · İmza</div>
          </div>
        ))}
      </div>

      {report.photos.length > 0 && (
        <Section title={`Fotoğraflar (${report.photos.length})`}>
          <div className="grid grid-cols-2 gap-3">
            {report.photos.map((photo, index) => (
              <figure key={photo.id} className="break-inside-avoid">
                {/* Yerel dosya önizlemesi (blob URL); next/image burada uygun değil */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.caption || photo.name}
                  className="h-[62mm] w-full rounded border border-neutral-300 bg-neutral-100 object-cover"
                />
                <figcaption className="mt-1 text-[10px] text-neutral-600">
                  <span className="font-semibold text-neutral-800">{index + 1}.</span>{" "}
                  {photo.caption.trim() || photo.name}
                </figcaption>
              </figure>
            ))}
          </div>
        </Section>
      )}
    </article>
  );
}

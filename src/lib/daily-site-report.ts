import type { StoreWorkPlanItem } from "@/types";

/**
 * Günlük şantiye raporu: şantiye şefinin yöneticilere gönderdiği günlük özet.
 * Rapor site_reports tablosuna kaydedilir (src/lib/site-reports.ts); PDF,
 * tarayıcının yazdırma penceresinden alınır.
 */

export const WEATHER_OPTIONS = ["Açık", "Parçalı bulutlu", "Bulutlu", "Yağmurlu", "Karlı", "Rüzgârlı", "Sisli"] as const;

export type ReportCrewRow = { id: string; trade: string; count: number | null };

/** İsimli yoklamada seçilebilen durumlar (puantaj durumlarının sahada belirlenenleri) */
export type AttendanceStatus = "worked" | "half_day" | "absent";

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  worked: "Çalıştı",
  half_day: "Yarım gün",
  absent: "Gelmedi",
};

/** İsimli yoklama satırı; kayıtta puantaja işlenir (src/lib/hr.ts) */
export type ReportAttendance = {
  personnelId: string;
  /** Rapor yazdırılırken ve personel silinse de görünsün diye ad da saklanır */
  name: string;
  jobTitle: string;
  status: AttendanceStatus;
  hours: number;
  overtimeHours: number;
};

export type ReportPhoto = {
  id: string;
  /** Gösterim adresi: yeni fotoğrafta blob URL, kayıtlıda imzalı depo bağlantısı */
  url: string;
  name: string;
  caption: string;
  /** Kayıtlı fotoğrafın depo yolu ({rapor id}/{dosya}) */
  path?: string;
  /** Henüz yüklenmemiş (küçültülmüş) dosya */
  file?: Blob;
};

export type DailySiteReport = {
  storeId: string;
  date: string;
  weather: string;
  temperature: string;
  preparedBy: string;
  siteManager: string;
  contractor: string;
  crew: ReportCrewRow[];
  attendance: ReportAttendance[];
  worksDone: string;
  materialsReceived: string;
  issues: string;
  safetyNotes: string;
  tomorrowPlan: string;
  photos: ReportPhoto[];
};

export function newRowId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyDailySiteReport(preparedBy: string, date: string): DailySiteReport {
  return {
    storeId: "",
    date,
    weather: "Açık",
    temperature: "",
    preparedBy,
    siteManager: "",
    contractor: "",
    crew: [{ id: newRowId(), trade: "", count: null }],
    attendance: [],
    worksDone: "",
    materialsReceived: "",
    issues: "",
    safetyNotes: "",
    tomorrowPlan: "",
    photos: [],
  };
}

export function crewTotal(crew: ReportCrewRow[]): number {
  return crew.reduce((sum, row) => sum + (row.count ?? 0), 0);
}

/** Yoklamada sahada olan (çalıştı / yarım gün) kişi sayısı */
export function attendancePresent(attendance: ReportAttendance[]): number {
  return attendance.filter((row) => row.status !== "absent").length;
}

/** Rapor gününe denk gelen ya da devam eden iş kalemleri, madde listesi olarak */
export function workPlanLinesForDate(items: StoreWorkPlanItem[], date: string): string[] {
  return items
    .filter((item) => {
      if (item.status === "tamamlandi") return false;
      const start = item.startDate.slice(0, 10);
      const end = item.endDate.slice(0, 10);
      const inRange = !!start && !!end && start <= date && date <= end;
      return inRange || item.status === "devam_ediyor";
    })
    .map((item) => `• ${item.description} (%${Math.round(item.percentComplete)})`);
}

/** PDF dosya adı olarak da kullanılan başlık, örn. Gunluk-Santiye-Raporu-Kadikoy-2026-10-20 */
export function reportFileName(storeName: string, date: string): string {
  const slug = storeName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "I")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return ["Gunluk-Santiye-Raporu", slug, date].filter(Boolean).join("-");
}

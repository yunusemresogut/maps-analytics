import { supabase } from "@/lib/supabase";
import { MODULE_FILES_BUCKET } from "@/lib/upload-module-attachment";
import { FULL_MANAGER_ROLES, isAdmin } from "@/lib/roles";
import {
  WEATHER_OPTIONS,
  newRowId,
  type AttendanceStatus,
  type DailySiteReport,
  type ReportAttendance,
  type ReportCrewRow,
  type ReportPhoto,
} from "@/lib/daily-site-report";
import type { User } from "@/types";

/**
 * Şantiye raporlarının kaydı (supabase/migrations/20261021090000_site_reports.sql).
 * Form içeriği data (jsonb) sütununda, fotoğraflar module-files deposunda
 * {rapor id}/{fotoğraf id}.jpg yolundadır.
 */

export const SITE_REPORTS_SOURCE = "site_reports_list";

export type SiteReportMeta = {
  id: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedByName?: string;
  updatedAt?: string;
};

export type SiteReportListRow = SiteReportMeta & {
  storeId: string;
  storeName: string;
  storeCity: string;
  reportDate: string;
  photoCount: number;
};

type StoredPhoto = { id: string; path: string; name: string; caption: string };

/** Raporu yazan ya da admin, yönetici, bölge müdürü (veritabanındaki can_modify_site_report) */
export function canModifySiteReport(user: Pick<User, "id" | "role"> | null, createdBy: string): boolean {
  if (!user) return false;
  return user.id === createdBy || isAdmin(user.role) || FULL_MANAGER_ROLES.includes(user.role);
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

function storedPhotos(raw: unknown): StoredPhoto[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): StoredPhoto[] => {
    if (!item || typeof item !== "object") return [];
    const photo = item as Record<string, unknown>;
    if (typeof photo.path !== "string") return [];
    return [{ id: text(photo.id) || newRowId(), path: photo.path, name: text(photo.name), caption: text(photo.caption) }];
  });
}

function crewRows(raw: unknown): ReportCrewRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): ReportCrewRow[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const count = Number(row.count);
    return [{ id: text(row.id) || newRowId(), trade: text(row.trade), count: Number.isFinite(count) && row.count !== null ? count : null }];
  });
}

const ATTENDANCE_STATUSES: AttendanceStatus[] = ["worked", "half_day", "absent"];

export function attendanceRows(raw: unknown): ReportAttendance[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): ReportAttendance[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const status = row.status as AttendanceStatus;
    if (typeof row.personnelId !== "string" || !ATTENDANCE_STATUSES.includes(status)) return [];
    const hours = Number(row.hours);
    const overtime = Number(row.overtimeHours);
    return [
      {
        personnelId: row.personnelId,
        name: text(row.name),
        jobTitle: text(row.jobTitle),
        status,
        hours: Number.isFinite(hours) ? hours : 0,
        overtimeHours: Number.isFinite(overtime) ? overtime : 0,
      },
    ];
  });
}

/** Kaydedilen içerik: şantiye ve tarih sütunlarda, geri kalanı data'da */
function reportData(report: DailySiteReport, photos: StoredPhoto[]) {
  return {
    weather: report.weather,
    temperature: report.temperature,
    preparedBy: report.preparedBy,
    siteManager: report.siteManager,
    contractor: report.contractor,
    crew: report.crew.map(({ id, trade, count }) => ({ id, trade, count })),
    attendance: report.attendance,
    worksDone: report.worksDone,
    materialsReceived: report.materialsReceived,
    issues: report.issues,
    safetyNotes: report.safetyNotes,
    tomorrowPlan: report.tomorrowPlan,
    photos,
  };
}

function savedPhotosOf(photos: ReportPhoto[]): StoredPhoto[] {
  return photos.flatMap((photo) =>
    photo.path ? [{ id: photo.id, path: photo.path, name: photo.name, caption: photo.caption }] : []
  );
}

export function mapSiteReportListRow(row: Record<string, unknown>): SiteReportListRow {
  return {
    id: String(row.id),
    storeId: String(row.store_id ?? ""),
    storeName: text(row.store_name) || "—",
    storeCity: text(row.store_city),
    reportDate: String(row.report_date ?? ""),
    photoCount: Number(row.photo_count ?? 0),
    createdBy: String(row.created_by ?? ""),
    createdByName: text(row.created_by_name),
    createdAt: String(row.created_at ?? ""),
    updatedByName: text(row.updated_by_name) || undefined,
    updatedAt: text(row.updated_at) || undefined,
  };
}

/** Kayıtlı rapor; fotoğraflar 1 saatlik imzalı bağlantıyla gelir. Bulunamazsa null */
export async function fetchSiteReport(id: string): Promise<{ report: DailySiteReport; meta: SiteReportMeta } | null> {
  const { data: row, error } = await supabase.from("site_reports").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const data = (row.data ?? {}) as Record<string, unknown>;
  const stored = storedPhotos(data.photos);
  const signed = new Map<string, string>();
  if (stored.length > 0) {
    const { data: urls } = await supabase.storage
      .from(MODULE_FILES_BUCKET)
      .createSignedUrls(stored.map((photo) => photo.path), 60 * 60);
    urls?.forEach((item) => item.path && item.signedUrl && signed.set(item.path, item.signedUrl));
  }

  const weather = text(data.weather);
  return {
    report: {
      storeId: String(row.store_id),
      date: String(row.report_date),
      weather: (WEATHER_OPTIONS as readonly string[]).includes(weather) ? weather : WEATHER_OPTIONS[0],
      temperature: text(data.temperature),
      preparedBy: text(data.preparedBy),
      siteManager: text(data.siteManager),
      contractor: text(data.contractor),
      crew: crewRows(data.crew),
      attendance: attendanceRows(data.attendance),
      worksDone: text(data.worksDone),
      materialsReceived: text(data.materialsReceived),
      issues: text(data.issues),
      safetyNotes: text(data.safetyNotes),
      tomorrowPlan: text(data.tomorrowPlan),
      photos: stored.map((photo) => ({ ...photo, url: signed.get(photo.path) ?? "" })),
    },
    meta: {
      id: String(row.id),
      createdBy: String(row.created_by),
      createdByName: text(row.created_by_name),
      createdAt: String(row.created_at),
      updatedByName: text(row.updated_by_name) || undefined,
      updatedAt: text(row.updated_at) || undefined,
    },
  };
}

/**
 * Raporu kaydeder: yeni raporda önce satır açılır (fotoğraf klasörü rapor
 * id'sidir), sonra bekleyen fotoğraflar yüklenir ve satır güncellenir.
 * Formdan çıkarılan kayıtlı fotoğraflar en son depodan silinir.
 * Yüklenemeyen fotoğraflar errors'ta döner, kalanlar kaydedilir.
 */
export async function saveSiteReport(input: {
  id?: string;
  report: DailySiteReport;
  removedPaths: string[];
  userName: string;
}): Promise<{ id: string; photos: ReportPhoto[]; errors: string[] }> {
  const { report, userName } = input;
  let id = input.id;

  if (!id) {
    const { data, error } = await supabase
      .from("site_reports")
      .insert({
        store_id: report.storeId,
        report_date: report.date,
        data: reportData(report, savedPhotosOf(report.photos)),
        created_by_name: userName,
      })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("Rapor oluşturulamadı");
    id = String(data.id);
  }

  const errors: string[] = [];
  const photos: ReportPhoto[] = [];
  for (const photo of report.photos) {
    if (photo.path || !photo.file) {
      if (photo.path) photos.push(photo);
      continue;
    }
    const path = `${id}/${photo.id}.jpg`;
    const { error } = await supabase.storage
      .from(MODULE_FILES_BUCKET)
      .upload(path, photo.file, { contentType: photo.file.type || "image/jpeg", upsert: false });
    if (error) {
      errors.push(`"${photo.name}" yüklenemedi: ${error.message}`);
      continue;
    }
    photos.push({ ...photo, path, file: undefined });
  }

  const { error: updateError } = await supabase
    .from("site_reports")
    .update({
      store_id: report.storeId,
      report_date: report.date,
      data: reportData(report, savedPhotosOf(photos)),
      updated_by_name: userName,
    })
    .eq("id", id);
  if (updateError) throw updateError;

  if (input.removedPaths.length > 0) {
    const { error } = await supabase.storage.from(MODULE_FILES_BUCKET).remove(input.removedPaths);
    if (error) console.error("Kaldırılan rapor fotoğrafları silinemedi:", error);
  }

  return { id, photos, errors };
}

/** Önce fotoğraflar silinir: depo izni raporun var olmasına bağlıdır */
export async function deleteSiteReport(id: string): Promise<void> {
  const { data: files } = await supabase.storage.from(MODULE_FILES_BUCKET).list(id, { limit: 1000 });
  if (files && files.length > 0) {
    const { error } = await supabase.storage
      .from(MODULE_FILES_BUCKET)
      .remove(files.map((file) => `${id}/${file.name}`));
    if (error) console.error("Rapor fotoğrafları silinemedi:", error);
  }
  const { error } = await supabase.from("site_reports").delete().eq("id", id);
  if (error) throw error;
}

/** Telefon fotoğraflarını yüklemeden önce küçültür (uzun kenar en çok 1600 px, JPEG) */
export async function compressPhoto(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, parseISO, startOfMonth } from "date-fns";
import { supabase } from "@/lib/supabase";
import { fetchAllRows } from "@/lib/supabase-query";
import { getFileMimeType, isAllowedFileType } from "@/lib/file-types";
import { attendanceRows } from "@/lib/site-reports";
import type { ReportAttendance } from "@/lib/daily-site-report";

/**
 * İnsan Kaynakları: personel kartları, özlük, belge / sertifika ve puantaj
 * (supabase/migrations/20261027090000_hr.sql). Yetkiler "personnel",
 * "personnelPrivate" ve "timesheets" modülleridir; kullanıcıya bağlı personel
 * yetkisi olmasa da kendi kaydını görür.
 */

export const PERSONNEL_SOURCE = "personnel_list";
export const PERSONNEL_SEARCH_COLUMNS = ["full_name", "code", "job_title", "department", "subcontractor_company", "store_name"];
export const CERTIFICATES_SOURCE = "personnel_certificates_list";
export const CERTIFICATE_SEARCH_COLUMNS = ["personnel_name", "personnel_code", "name", "document_no", "issuer"];
export const HR_FILES_BUCKET = "hr-files";
export const MAX_HR_FILE_BYTES = 20 * 1024 * 1024;
/** Listedeki "yakında bitiyor" eşiği; personnel_certificates_list view'ı ile aynı */
export const CERTIFICATE_EXPIRING_DAYS = 30;

// ---------------------------------------------------------------------------
// Personel
// ---------------------------------------------------------------------------

export type EmploymentType = "office" | "salaried" | "daily" | "subcontractor";
export type PersonnelState = "active" | "left";

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  office: "Ofis personeli",
  salaried: "Maaşlı işçi",
  daily: "Günlük (yevmiyeli) işçi",
  subcontractor: "Taşeron personeli",
};

export const PERSONNEL_STATE_LABELS: Record<PersonnelState, string> = {
  active: "Çalışıyor",
  left: "Ayrıldı",
};

/** Personelin en kötü belge durumu (personnel_list.document_state) */
export type DocumentState = "expired" | "expiring" | "pending" | "ok";

export const DOCUMENT_STATE_LABELS: Record<DocumentState, string> = {
  expired: "Süresi geçmiş belge",
  expiring: "Belgesi bitiyor",
  pending: "Onay bekleyen belge",
  ok: "Belgeler tamam",
};

export type PersonnelInput = {
  code: string;
  fullName: string;
  userId?: string;
  employmentType: EmploymentType;
  subcontractorCompany: string;
  department: string;
  jobTitle: string;
  phone: string;
  email: string;
  storeId?: string;
  startDate: string;
  endDate: string;
  privacyNoticeDate: string;
  notes: string;
  /** İzin taleplerini ilk onaylayan yönetici (kullanıcı) */
  managerId?: string;
  /** Devreden / elle düzeltilen yıllık izin günü (+/-) */
  leaveAdjustment: number;
};

export type Personnel = PersonnelInput & {
  id: string;
  state: PersonnelState;
  documentState: DocumentState;
  storeName?: string;
  expiredCount: number;
  expiringCount: number;
  pendingCount: number;
  certificateCount: number;
  createdByName: string;
  updatedAt?: string;
};

/** Özlük: yalnızca özlük yetkilisi ve kişinin kendisi görür */
export type PersonnelPrivateInput = {
  nationalId: string;
  birthDate: string;
  address: string;
  iban: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};

// ---------------------------------------------------------------------------
// Belge / sertifika
// ---------------------------------------------------------------------------

export type CertificateType =
  | "isg_training"
  | "health_check"
  | "myk"
  | "height_work"
  | "operator"
  | "driver_license"
  | "first_aid"
  | "emergency_team"
  | "other";

export type CertificateValidity = "expired" | "expiring" | "valid" | "permanent";

export const CERTIFICATE_TYPE_LABELS: Record<CertificateType, string> = {
  isg_training: "İSG eğitimi",
  health_check: "Sağlık muayenesi (işe giriş / periyodik)",
  myk: "Mesleki yeterlilik belgesi (MYK)",
  height_work: "Yüksekte çalışma eğitimi",
  operator: "İş makinesi operatör belgesi",
  driver_license: "Sürücü belgesi / SRC / psikoteknik",
  first_aid: "İlk yardım sertifikası",
  emergency_team: "Acil durum ekibi eğitimi",
  other: "Diğer",
};

/**
 * Çok tehlikeli sınıf (inşaat) için önerilen geçerlilik (ay). Yalnızca bitiş
 * tarihi önerisidir; belgedeki tarih esastır.
 * - İSG eğitimi ve periyodik sağlık muayenesi: yılda en az bir
 * - MYK belgesi: 5 yıl, ilk yardım sertifikası: 3 yıl
 */
export const CERTIFICATE_DEFAULT_MONTHS: Partial<Record<CertificateType, number>> = {
  isg_training: 12,
  health_check: 12,
  myk: 60,
  first_aid: 36,
};

export const VALIDITY_LABELS: Record<CertificateValidity, string> = {
  expired: "Süresi geçti",
  expiring: "Yakında bitiyor",
  valid: "Geçerli",
  permanent: "Süresiz",
};

export const VALIDITY_STYLES: Record<CertificateValidity, string> = {
  expired: "bg-red-500/10 text-red-400 border-red-500/25",
  expiring: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  valid: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
  permanent: "bg-zinc-800/60 text-zinc-400 border-zinc-700",
};

export type CertificateInput = {
  type: CertificateType;
  name: string;
  documentNo: string;
  issuer: string;
  issuedAt: string;
  expiresAt: string;
  notes: string;
  /** Yalnızca İK (personel düzenleme yetkisi) onaylayabilir; sunucu da denetler */
  verified: boolean;
};

export type Certificate = CertificateInput & {
  id: string;
  personnelId: string;
  personnelName: string;
  personnelCode: string;
  employmentType: EmploymentType;
  personnelActive: boolean;
  validity: CertificateValidity;
  filePath?: string;
  fileName?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  createdByName: string;
};

// ---------------------------------------------------------------------------
// Puantaj
// ---------------------------------------------------------------------------

export type TimesheetStatus =
  | "worked"
  | "half_day"
  | "annual_leave"
  | "excused_leave"
  | "sick_leave"
  | "unpaid_leave"
  | "absent"
  | "weekly_rest"
  | "public_holiday";

/** Puantaj cetvelinde kullanılan kısa kod, ad ve renk */
export const TIMESHEET_STATUS: Record<TimesheetStatus, { code: string; label: string; style: string }> = {
  worked: { code: "X", label: "Çalıştı", style: "bg-emerald-500/15 text-emerald-300" },
  half_day: { code: "Y", label: "Yarım gün", style: "bg-teal-500/15 text-teal-300" },
  annual_leave: { code: "İ", label: "Yıllık izin", style: "bg-sky-500/15 text-sky-300" },
  excused_leave: { code: "M", label: "Mazeret izni", style: "bg-indigo-500/15 text-indigo-300" },
  sick_leave: { code: "R", label: "Raporlu", style: "bg-violet-500/15 text-violet-300" },
  unpaid_leave: { code: "Ü", label: "Ücretsiz izin", style: "bg-zinc-700/50 text-zinc-300" },
  absent: { code: "D", label: "Devamsız", style: "bg-red-500/15 text-red-300" },
  weekly_rest: { code: "H", label: "Hafta tatili", style: "bg-zinc-800 text-zinc-400" },
  public_holiday: { code: "RT", label: "Resmi tatil", style: "bg-amber-500/15 text-amber-300" },
};

export const TIMESHEET_STATUSES = Object.keys(TIMESHEET_STATUS) as TimesheetStatus[];

/** Yalnızca bu durumlarda çalışma saati girilir */
export const WORKING_STATUSES: TimesheetStatus[] = ["worked", "half_day"];

/** İş Kanunu md. 63: günlük çalışma 11 saati aşamaz */
export const MAX_DAILY_HOURS = 11;
/** İş Kanunu md. 41: yıllık fazla çalışma 270 saati aşamaz */
export const MAX_YEARLY_OVERTIME = 270;

export type TimesheetEntryInput = {
  status: TimesheetStatus;
  hours: number;
  overtimeHours: number;
  storeId?: string;
  notes: string;
};

export type TimesheetEntry = TimesheetEntryInput & {
  id: string;
  personnelId: string;
  workDate: string;
  updatedByName?: string;
  /** İzin talebinden yazıldıysa talep */
  leaveRequestId?: string;
};

export type TimesheetLock = { month: string; lockedByName: string; lockedAt: string };

// ---------------------------------------------------------------------------
// Eşleme
// ---------------------------------------------------------------------------

const text = (value: unknown) => (typeof value === "string" ? value : "");
const optional = (value: unknown) => (typeof value === "string" && value ? value : undefined);
const count = (value: unknown) => Number(value) || 0;

export function mapPersonnelRow(row: Record<string, unknown>): Personnel {
  return {
    id: String(row.id),
    code: text(row.code),
    fullName: text(row.full_name),
    userId: optional(row.user_id),
    employmentType: (text(row.employment_type) || "office") as EmploymentType,
    subcontractorCompany: text(row.subcontractor_company),
    department: text(row.department),
    jobTitle: text(row.job_title),
    phone: text(row.phone),
    email: text(row.email),
    storeId: optional(row.store_id),
    storeName: optional(row.store_name),
    startDate: text(row.start_date),
    endDate: text(row.end_date),
    privacyNoticeDate: text(row.privacy_notice_date),
    notes: text(row.notes),
    managerId: optional(row.manager_id),
    leaveAdjustment: Number(row.leave_adjustment) || 0,
    state: (text(row.state) || "active") as PersonnelState,
    documentState: (text(row.document_state) || "ok") as DocumentState,
    expiredCount: count(row.expired_count),
    expiringCount: count(row.expiring_count),
    pendingCount: count(row.pending_count),
    certificateCount: count(row.certificate_count),
    createdByName: text(row.created_by_name),
    updatedAt: optional(row.updated_at),
  };
}

export function mapCertificateRow(row: Record<string, unknown>): Certificate {
  return {
    id: String(row.id),
    personnelId: String(row.personnel_id),
    personnelName: text(row.personnel_name),
    personnelCode: text(row.personnel_code),
    employmentType: (text(row.employment_type) || "office") as EmploymentType,
    personnelActive: row.personnel_active !== false,
    type: (text(row.type) || "other") as CertificateType,
    name: text(row.name),
    documentNo: text(row.document_no),
    issuer: text(row.issuer),
    issuedAt: text(row.issued_at),
    expiresAt: text(row.expires_at),
    notes: text(row.notes),
    verified: row.verified === true,
    verifiedByName: optional(row.verified_by_name),
    verifiedAt: optional(row.verified_at),
    validity: (text(row.validity) || "permanent") as CertificateValidity,
    filePath: optional(row.file_path),
    fileName: optional(row.file_name),
    createdByName: text(row.created_by_name),
  };
}

function mapPrivateRow(row: Record<string, unknown>): PersonnelPrivateInput {
  return {
    nationalId: text(row.national_id),
    birthDate: text(row.birth_date),
    address: text(row.address),
    iban: text(row.iban),
    emergencyContactName: text(row.emergency_contact_name),
    emergencyContactPhone: text(row.emergency_contact_phone),
  };
}

function mapTimesheetRow(row: Record<string, unknown>): TimesheetEntry {
  return {
    id: String(row.id),
    personnelId: String(row.personnel_id),
    workDate: text(row.work_date),
    status: text(row.status) as TimesheetStatus,
    hours: Number(row.hours) || 0,
    overtimeHours: Number(row.overtime_hours) || 0,
    storeId: optional(row.store_id),
    notes: text(row.notes),
    updatedByName: optional(row.updated_by_name) ?? optional(row.created_by_name),
    leaveRequestId: optional(row.leave_request_id),
  };
}

function personnelToDb(input: PersonnelInput) {
  return {
    code: input.code.trim(),
    full_name: input.fullName.trim(),
    user_id: input.userId || null,
    employment_type: input.employmentType,
    subcontractor_company: input.employmentType === "subcontractor" ? input.subcontractorCompany.trim() : "",
    department: input.department.trim(),
    job_title: input.jobTitle.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    store_id: input.storeId || null,
    start_date: input.startDate || null,
    end_date: input.endDate || null,
    privacy_notice_date: input.privacyNoticeDate || null,
    notes: input.notes.trim(),
    manager_id: input.managerId || null,
    leave_adjustment: input.leaveAdjustment,
  };
}

function certificateToDb(input: CertificateInput) {
  return {
    type: input.type,
    name: input.name.trim(),
    document_no: input.documentNo.trim(),
    issuer: input.issuer.trim(),
    issued_at: input.issuedAt || null,
    expires_at: input.expiresAt || null,
    notes: input.notes.trim(),
    verified: input.verified,
  };
}

// ---------------------------------------------------------------------------
// Doğrulama
// ---------------------------------------------------------------------------

/** T.C. kimlik numarası algoritma kontrolü (11 hane, kontrol haneleri) */
export function isValidNationalId(value: string): boolean {
  if (!/^[1-9][0-9]{10}$/.test(value)) return false;
  const d = value.split("").map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  if ((((odd * 7 - even) % 10) + 10) % 10 !== d[9]) return false;
  return d.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10 === d[10];
}

/** TR IBAN: boşluklar atılır, TR + 24 hane ve mod-97 kontrolü */
export function normalizeIban(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function isValidIban(value: string): boolean {
  const iban = normalizeIban(value);
  if (!/^TR[0-9]{24}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of numeric) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1;
}

export function formatIban(value: string): string {
  return normalizeIban(value).replace(/(.{4})/g, "$1 ").trim();
}

/** Ekranda TC kimlik no'nun yalnızca son 4 hanesi görünür */
export function maskNationalId(value: string): string {
  return value ? `•••••••${value.slice(-4)}` : "";
}

/** Postgres hatalarını kullanıcıya anlaşılır mesaja çevirir */
export function hrErrorMessage(error: unknown, fallback: string): string {
  const code = (error as { code?: string } | null)?.code;
  const message = (error as { message?: string } | null)?.message ?? "";
  // Sunucu fonksiyonlarının Türkçe mesajları (ör. "… ayının puantajı kapatılmış") olduğu gibi gösterilir;
  // RLS ve kısıt ihlallerinin İngilizce mesajlarında "violates" geçer
  if (code && ["P0001", "P0002", "42501", "23514"].includes(code) && message && !message.includes("violates")) {
    return message;
  }
  if (code === "23505") {
    if (message.includes("personnel_user_idx")) return "Bu kullanıcı zaten başka bir personel kartına bağlı.";
    return "Bu kayıt zaten var.";
  }
  if (code === "42501") return "Bu işlem için yetkiniz yok.";
  if (code === "23514") return "Girilen bilgileri kontrol edin (tarih sırası, TC kimlik no biçimi ya da saat toplamı).";
  if (error instanceof Error && error.message.startsWith("Dosya")) return error.message;
  return fallback;
}

// ---------------------------------------------------------------------------
// Personel işlemleri
// ---------------------------------------------------------------------------

export async function fetchPersonnel(id: string): Promise<Personnel | null> {
  const { data, error } = await supabase.from(PERSONNEL_SOURCE).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapPersonnelRow(data as Record<string, unknown>) : null;
}

/** Oturumdaki kullanıcının personel kartı (bağlı değilse null) */
export async function fetchMyPersonnelId(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from("personnel").select("id").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data?.id as string | undefined) ?? null;
}

/** Puantaj ve seçim listeleri için tüm personel (ada göre) */
export async function fetchAllPersonnel(): Promise<Personnel[]> {
  const { data, error } = await fetchAllRows<Record<string, unknown>>((from, to) =>
    supabase.from(PERSONNEL_SOURCE).select("*").order("full_name").order("id").range(from, to)
  );
  if (error) throw error;
  return data.map(mapPersonnelRow);
}

/** Özet kartları: çalışan personel ve belge durumlarına göre sayılar */
export async function fetchPersonnelCounts(): Promise<Record<"active" | DocumentState, number>> {
  const states: DocumentState[] = ["expired", "expiring", "pending"];
  const [active, ...results] = await Promise.all([
    supabase.from(PERSONNEL_SOURCE).select("id", { count: "exact", head: true }).eq("state", "active"),
    ...states.map((state) =>
      supabase
        .from(PERSONNEL_SOURCE)
        .select("id", { count: "exact", head: true })
        .eq("state", "active")
        .eq("document_state", state)
    ),
  ]);
  if (active.error) throw active.error;
  const counts = { active: active.count ?? 0, ok: 0 } as Record<"active" | DocumentState, number>;
  results.forEach(({ count: value, error }, index) => {
    if (error) throw error;
    counts[states[index]] = value ?? 0;
  });
  return counts;
}

export async function createPersonnel(input: PersonnelInput): Promise<string> {
  const { data, error } = await supabase.from("personnel").insert(personnelToDb(input)).select("id").single();
  if (error) throw error;
  return String(data.id);
}

export async function updatePersonnel(id: string, input: PersonnelInput): Promise<void> {
  const { error } = await supabase.from("personnel").update(personnelToDb(input)).eq("id", id);
  if (error) throw error;
}

/**
 * Belge dosyalarını siler. Depolama izni belge kaydına bakar; bu yüzden dosyalar
 * kayıt silinmeden önce silinir. Silinemeyen dosya kalırsa kayıt da silinmez
 * (ör. sağlık raporunu yalnızca özlük yetkilisi silebilir).
 */
async function removeHrFiles(paths: string[]) {
  if (paths.length === 0) return;
  const { data, error } = await supabase.storage.from(HR_FILES_BUCKET).remove(paths);
  if (error || (data ?? []).length < paths.length) {
    throw new Error("Dosya silinemedi: belgeye ait dosyayı silme yetkiniz yok (sağlık raporları için özlük yetkisi gerekir).");
  }
}

/** Personel, belgeleri, puantajı ve özlüğü birlikte silinir; dosyalar da kaldırılır */
export async function deletePersonnel(id: string): Promise<void> {
  const { data: files, error: filesError } = await supabase
    .from("personnel_certificates")
    .select("file_path")
    .eq("personnel_id", id)
    .not("file_path", "is", null);
  if (filesError) throw filesError;
  await removeHrFiles((files ?? []).map((row) => row.file_path as string).filter(Boolean));
  const { error } = await supabase.from("personnel").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchPersonnelPrivate(personnelId: string): Promise<PersonnelPrivateInput | null> {
  const { data, error } = await supabase
    .from("personnel_private")
    .select("*")
    .eq("personnel_id", personnelId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapPrivateRow(data as Record<string, unknown>) : null;
}

export async function savePersonnelPrivate(personnelId: string, input: PersonnelPrivateInput): Promise<void> {
  const { error } = await supabase.from("personnel_private").upsert(
    {
      personnel_id: personnelId,
      national_id: input.nationalId.trim(),
      birth_date: input.birthDate || null,
      address: input.address.trim(),
      iban: normalizeIban(input.iban),
      emergency_contact_name: input.emergencyContactName.trim(),
      emergency_contact_phone: input.emergencyContactPhone.trim(),
    },
    { onConflict: "personnel_id" }
  );
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Belge işlemleri
// ---------------------------------------------------------------------------

export async function fetchPersonnelCertificates(personnelId: string): Promise<Certificate[]> {
  const { data, error } = await supabase
    .from(CERTIFICATES_SOURCE)
    .select("*")
    .eq("personnel_id", personnelId)
    .order("expires_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapCertificateRow(row as Record<string, unknown>));
}

/** Raporlar: çalışan personelin tüm belgeleri */
export async function fetchActiveCertificates(): Promise<Certificate[]> {
  const { data, error } = await fetchAllRows<Record<string, unknown>>((from, to) =>
    supabase.from(CERTIFICATES_SOURCE).select("*").eq("personnel_active", true).order("id").range(from, to)
  );
  if (error) throw error;
  return data.map(mapCertificateRow);
}

/** Bildirimler: verilen tarihe kadar süresi dolan (ya da dolmuş) belgeler, çalışan personel */
export async function fetchExpiringCertificates(untilDate: string): Promise<Certificate[]> {
  const { data, error } = await fetchAllRows<Record<string, unknown>>((from, to) =>
    supabase
      .from(CERTIFICATES_SOURCE)
      .select("*")
      .eq("personnel_active", true)
      .lte("expires_at", untilDate)
      .order("expires_at")
      .order("id")
      .range(from, to)
  );
  if (error) throw error;
  return data.map(mapCertificateRow);
}

/** Bildirimler: onay bekleyen belgeler */
export async function fetchPendingCertificates(): Promise<Certificate[]> {
  const { data, error } = await supabase
    .from(CERTIFICATES_SOURCE)
    .select("*")
    .eq("verified", false)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((row) => mapCertificateRow(row as Record<string, unknown>));
}

/** Geçerlilik durumlarına göre sayılar (özet kartları) */
export async function fetchCertificateCounts(): Promise<Record<CertificateValidity | "pending", number>> {
  const validities = Object.keys(VALIDITY_LABELS) as CertificateValidity[];
  const [pending, ...results] = await Promise.all([
    supabase.from(CERTIFICATES_SOURCE).select("id", { count: "exact", head: true }).eq("verified", false),
    ...validities.map((validity) =>
      supabase
        .from(CERTIFICATES_SOURCE)
        .select("id", { count: "exact", head: true })
        .eq("validity", validity)
        .eq("personnel_active", true)
    ),
  ]);
  if (pending.error) throw pending.error;
  const counts = { pending: pending.count ?? 0 } as Record<CertificateValidity | "pending", number>;
  results.forEach(({ count: value, error }, index) => {
    if (error) throw error;
    counts[validities[index]] = value ?? 0;
  });
  return counts;
}

function fileObjectPath(organizationId: string, personnelId: string, certificateId: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
  return `${organizationId}/${personnelId}/${certificateId}/${Date.now()}_${safeName}`;
}

export function validateHrFile(file: File): string | null {
  if (!isAllowedFileType(file.name)) return `"${file.name}": bu dosya türü desteklenmiyor.`;
  if (file.size > MAX_HR_FILE_BYTES) return `"${file.name}": dosya 20 MB sınırını aşıyor.`;
  return null;
}

async function attachCertificateFile(
  certificate: { id: string; personnelId: string; previousPath?: string },
  organizationId: string,
  file: File
) {
  const path = fileObjectPath(organizationId, certificate.personnelId, certificate.id, file.name);
  const { error: uploadError } = await supabase.storage
    .from(HR_FILES_BUCKET)
    .upload(path, file, { upsert: false, contentType: getFileMimeType(file) });
  if (uploadError) throw new Error(`Dosya yüklenemedi: ${uploadError.message}`);
  const { error } = await supabase
    .from("personnel_certificates")
    .update({ file_path: path, file_name: file.name })
    .eq("id", certificate.id);
  if (error) {
    await supabase.storage.from(HR_FILES_BUCKET).remove([path]);
    throw error;
  }
  if (certificate.previousPath) await supabase.storage.from(HR_FILES_BUCKET).remove([certificate.previousPath]);
}

/**
 * Belge kaydı ve (varsa) dosyası. Dosya yolu belge kimliğini içerdiği için
 * önce kayıt oluşturulur, sonra dosya yüklenir.
 */
export async function saveCertificate(options: {
  id?: string;
  personnelId: string;
  organizationId: string;
  input: CertificateInput;
  file?: File | null;
  previousPath?: string;
}): Promise<void> {
  const { id, personnelId, organizationId, input, file, previousPath } = options;
  let certificateId = id;
  if (certificateId) {
    const { error } = await supabase.from("personnel_certificates").update(certificateToDb(input)).eq("id", certificateId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("personnel_certificates")
      .insert({ personnel_id: personnelId, ...certificateToDb(input) })
      .select("id")
      .single();
    if (error) throw error;
    certificateId = String(data.id);
  }
  if (file) await attachCertificateFile({ id: certificateId, personnelId, previousPath }, organizationId, file);
}

export async function setCertificateVerified(id: string, verified: boolean): Promise<void> {
  const { error } = await supabase.from("personnel_certificates").update({ verified }).eq("id", id);
  if (error) throw error;
}

export async function deleteCertificate(certificate: Pick<Certificate, "id" | "filePath">): Promise<void> {
  await removeHrFiles(certificate.filePath ? [certificate.filePath] : []);
  const { error } = await supabase.from("personnel_certificates").delete().eq("id", certificate.id);
  if (error) throw error;
}

export async function getCertificateFileUrl(path: string, download?: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(HR_FILES_BUCKET)
    .createSignedUrl(path, 60 * 5, { download: download ?? false });
  if (error || !data?.signedUrl) throw error ?? new Error("Dosya açılamadı");
  return data.signedUrl;
}

/** Belgenin geçerlilik durumu (bitiş tarihinden; view ile aynı kural) */
export function certificateValidity(expiresAt: string, today = format(new Date(), "yyyy-MM-dd")): CertificateValidity {
  if (!expiresAt) return "permanent";
  if (expiresAt < today) return "expired";
  const threshold = format(addDaysISO(today, CERTIFICATE_EXPIRING_DAYS), "yyyy-MM-dd");
  return expiresAt <= threshold ? "expiring" : "valid";
}

function addDaysISO(date: string, days: number) {
  const value = parseISO(date);
  value.setDate(value.getDate() + days);
  return value;
}

/** Düzenlenme tarihine göre önerilen bitiş tarihi */
export function suggestedExpiry(type: CertificateType, issuedAt: string): string {
  const months = CERTIFICATE_DEFAULT_MONTHS[type];
  if (!months || !issuedAt) return "";
  return format(addMonths(parseISO(issuedAt), months), "yyyy-MM-dd");
}

// ---------------------------------------------------------------------------
// Puantaj işlemleri
// ---------------------------------------------------------------------------

export function monthDays(month: string): string[] {
  const start = startOfMonth(parseISO(`${month}-01`));
  return eachDayOfInterval({ start, end: endOfMonth(start) }).map((day) => format(day, "yyyy-MM-dd"));
}

export function isSunday(date: string) {
  return getDay(parseISO(date)) === 0;
}

export function isSaturday(date: string) {
  return getDay(parseISO(date)) === 6;
}

/** Personel ay içinde çalışıyor muydu (giriş / çıkış tarihine göre) */
export function activeInMonth(person: Pick<Personnel, "startDate" | "endDate">, month: string) {
  const days = monthDays(month);
  const first = days[0];
  const last = days[days.length - 1];
  return (!person.startDate || person.startDate <= last) && (!person.endDate || person.endDate >= first);
}

/** Gün personelin giriş-çıkış aralığında mı */
export function employedOn(person: Pick<Personnel, "startDate" | "endDate">, date: string) {
  return (!person.startDate || person.startDate <= date) && (!person.endDate || person.endDate >= date);
}

export async function fetchTimesheet(from: string, to: string, personnelId?: string): Promise<TimesheetEntry[]> {
  const { data, error } = await fetchAllRows<Record<string, unknown>>((start, end) => {
    let query = supabase.from("timesheet_entries").select("*").gte("work_date", from).lte("work_date", to);
    if (personnelId) query = query.eq("personnel_id", personnelId);
    return query.order("work_date").order("id").range(start, end);
  });
  if (error) throw error;
  return data.map(mapTimesheetRow);
}

/** Yıl içindeki toplam fazla mesai (personel → saat); 270 saat sınırı uyarısı için */
export async function fetchYearlyOvertime(year: number, personnelId?: string): Promise<Record<string, number>> {
  const { data, error } = await fetchAllRows<Record<string, unknown>>((start, end) => {
    let query = supabase
      .from("timesheet_entries")
      .select("id, personnel_id, overtime_hours")
      .gte("work_date", `${year}-01-01`)
      .lte("work_date", `${year}-12-31`)
      .gt("overtime_hours", 0);
    if (personnelId) query = query.eq("personnel_id", personnelId);
    return query.order("id").range(start, end);
  });
  if (error) throw error;
  const totals: Record<string, number> = {};
  for (const row of data) {
    const id = String(row.personnel_id);
    totals[id] = (totals[id] ?? 0) + (Number(row.overtime_hours) || 0);
  }
  return totals;
}

export async function fetchTimesheetLock(month: string): Promise<TimesheetLock | null> {
  const { data, error } = await supabase.from("timesheet_locks").select("*").eq("month", `${month}-01`).maybeSingle();
  if (error) throw error;
  return data
    ? { month, lockedByName: text(data.locked_by_name), lockedAt: text(data.locked_at) }
    : null;
}

/** Ayı kapatır: o aya ait puantaj artık değiştirilemez */
export async function lockTimesheetMonth(month: string): Promise<void> {
  const { error } = await supabase.from("timesheet_locks").insert({ month: `${month}-01` });
  if (error) throw error;
}

export async function unlockTimesheetMonth(month: string): Promise<void> {
  const { error } = await supabase.from("timesheet_locks").delete().eq("month", `${month}-01`);
  if (error) throw error;
}

export type TimesheetUpsert = TimesheetEntryInput & { personnelId: string; workDate: string };

const UPSERT_CHUNK = 500;

/** Günlük kayıtları ekler ya da günceller; kaydedilen satırları döner */
export async function upsertTimesheetEntries(entries: TimesheetUpsert[]): Promise<TimesheetEntry[]> {
  const saved: TimesheetEntry[] = [];
  for (let i = 0; i < entries.length; i += UPSERT_CHUNK) {
    const { data, error } = await supabase
      .from("timesheet_entries")
      .upsert(
        entries.slice(i, i + UPSERT_CHUNK).map((entry) => ({
          personnel_id: entry.personnelId,
          work_date: entry.workDate,
          status: entry.status,
          hours: WORKING_STATUSES.includes(entry.status) ? entry.hours : 0,
          overtime_hours: WORKING_STATUSES.includes(entry.status) ? entry.overtimeHours : 0,
          store_id: entry.storeId || null,
          notes: entry.notes.trim(),
        })),
        { onConflict: "personnel_id,work_date" }
      )
      .select();
    if (error) throw error;
    saved.push(...(data ?? []).map((row) => mapTimesheetRow(row as Record<string, unknown>)));
  }
  return saved;
}

export async function deleteTimesheetEntries(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from("timesheet_entries").delete().in("id", ids);
  if (error) throw error;
}

/** İzin ya da rapor günü: yoklama ve rapor aktarımı bunların üzerine yazmaz */
export const LEAVE_STATUSES: TimesheetStatus[] = ["annual_leave", "excused_leave", "sick_leave", "unpaid_leave"];

export function isLeaveEntry(entry: Pick<TimesheetEntry, "status" | "leaveRequestId">) {
  return !!entry.leaveRequestId || LEAVE_STATUSES.includes(entry.status);
}

type AttendanceRow = Pick<ReportAttendance, "personnelId" | "name" | "status" | "hours" | "overtimeHours">;

function attendanceToUpsert(row: AttendanceRow, workDate: string, storeId: string): TimesheetUpsert {
  return {
    personnelId: row.personnelId,
    workDate,
    status: row.status,
    hours: row.status === "absent" ? 0 : row.hours,
    overtimeHours: row.status === "absent" ? 0 : row.overtimeHours,
    storeId,
    notes: "Günlük şantiye raporundan",
  };
}

/**
 * Günlük rapordaki isimli yoklamayı o günün puantajına yazar. İzinli / raporlu
 * günlerin üzerine yazılmaz (atlananlar döner). Ay kapatılmışsa hata fırlatır.
 */
export async function syncAttendanceToTimesheet(options: {
  storeId: string;
  date: string;
  attendance: AttendanceRow[];
}): Promise<{ written: number; skipped: string[] }> {
  const { storeId, date, attendance } = options;
  if (attendance.length === 0) return { written: 0, skipped: [] };
  const existing = await fetchTimesheet(date, date);
  const onLeave = new Set(existing.filter(isLeaveEntry).map((entry) => entry.personnelId));
  const skipped = attendance.filter((row) => onLeave.has(row.personnelId)).map((row) => row.name);
  const saved = await upsertTimesheetEntries(
    attendance.filter((row) => !onLeave.has(row.personnelId)).map((row) => attendanceToUpsert(row, date, storeId))
  );
  return { written: saved.length, skipped };
}

/**
 * Ayın günlük raporlarındaki yoklamaları puantaja aktarır; yalnızca boş günler
 * doldurulur (elle girilen ya da izin günü değişmez). Aynı kişi aynı gün birden
 * çok raporda varsa ilk rapor geçerlidir.
 */
export async function planReportAttendanceImport(
  month: string,
  isFilled: (personnelId: string, date: string) => boolean
): Promise<{ upserts: TimesheetUpsert[]; reportCount: number }> {
  const days = monthDays(month);
  const { data, error } = await fetchAllRows<Record<string, unknown>>((start, end) =>
    supabase
      .from("site_reports")
      .select("id, store_id, report_date, data")
      .gte("report_date", days[0])
      .lte("report_date", days[days.length - 1])
      .order("report_date")
      .order("created_at")
      .order("id")
      .range(start, end)
  );
  if (error) throw error;
  const planned = new Map<string, TimesheetUpsert>();
  let reportCount = 0;
  for (const report of data) {
    const rows = attendanceRows((report.data as Record<string, unknown> | null)?.attendance);
    if (rows.length === 0) continue;
    reportCount += 1;
    const date = String(report.report_date);
    for (const row of rows) {
      const key = `${row.personnelId}|${date}`;
      if (planned.has(key) || isFilled(row.personnelId, date)) continue;
      planned.set(key, attendanceToUpsert(row, date, String(report.store_id)));
    }
  }
  return { upserts: [...planned.values()], reportCount };
}

export type TimesheetSummary = {
  workedDays: number;
  hours: number;
  overtime: number;
  annualLeave: number;
  otherLeave: number;
  sick: number;
  absent: number;
  rest: number;
};

export function summarizeTimesheet(entries: TimesheetEntry[]): TimesheetSummary {
  const summary: TimesheetSummary = {
    workedDays: 0,
    hours: 0,
    overtime: 0,
    annualLeave: 0,
    otherLeave: 0,
    sick: 0,
    absent: 0,
    rest: 0,
  };
  for (const entry of entries) {
    summary.hours += entry.hours;
    summary.overtime += entry.overtimeHours;
    switch (entry.status) {
      case "worked":
        summary.workedDays += 1;
        break;
      case "half_day":
        summary.workedDays += 0.5;
        break;
      case "annual_leave":
        summary.annualLeave += 1;
        break;
      case "excused_leave":
      case "unpaid_leave":
        summary.otherLeave += 1;
        break;
      case "sick_leave":
        summary.sick += 1;
        break;
      case "absent":
        summary.absent += 1;
        break;
      case "weekly_rest":
      case "public_holiday":
        summary.rest += 1;
        break;
    }
  }
  return summary;
}

export function formatHours(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}

/** Aylık puantaj cetvelini Excel'e aktarır (bordro için) */
export async function exportTimesheetXlsx(options: {
  month: string;
  personnel: Personnel[];
  entries: TimesheetEntry[];
  storeName: (id?: string) => string | undefined;
}) {
  const XLSX = await import("xlsx");
  const { month, personnel, entries } = options;
  const days = monthDays(month);
  const byKey = new Map(entries.map((entry) => [`${entry.personnelId}|${entry.workDate}`, entry]));

  const header = [
    "Sicil no",
    "Ad soyad",
    "Çalışma tipi",
    "Taşeron firma",
    "Görev yeri",
    ...days.map((day) => Number(day.slice(8))),
    "Çalışılan gün",
    "Çalışma saati",
    "Fazla mesai (saat)",
    "Yıllık izin",
    "Diğer izin",
    "Rapor",
    "Devamsız",
    "Hafta / resmi tatil",
  ];
  const rows = personnel.map((person) => {
    const own = entries.filter((entry) => entry.personnelId === person.id);
    const summary = summarizeTimesheet(own);
    return [
      person.code,
      person.fullName,
      EMPLOYMENT_TYPE_LABELS[person.employmentType],
      person.subcontractorCompany,
      options.storeName(person.storeId) ?? "",
      ...days.map((day) => {
        const entry = byKey.get(`${person.id}|${day}`);
        return entry ? TIMESHEET_STATUS[entry.status].code : "";
      }),
      summary.workedDays,
      summary.hours,
      summary.overtime,
      summary.annualLeave,
      summary.otherLeave,
      summary.sick,
      summary.absent,
      summary.rest,
    ];
  });
  const legend = [
    [],
    ["Kodlar"],
    ...TIMESHEET_STATUSES.map((status) => [TIMESHEET_STATUS[status].code, TIMESHEET_STATUS[status].label]),
  ];

  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows, ...legend]);
  sheet["!cols"] = [{ wch: 10 }, { wch: 24 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, ...days.map(() => ({ wch: 4 }))];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, `Puantaj ${month}`);
  const buffer = XLSX.write(book, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `puantaj_${month}.xlsx`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

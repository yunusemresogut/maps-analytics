import { addYears, differenceInYears, eachDayOfInterval, format, getDay, parseISO, subDays } from "date-fns";
import { supabase } from "@/lib/supabase";
import { fetchAllRows } from "@/lib/supabase-query";
import type { EmploymentType } from "@/lib/hr";

/**
 * İzin talepleri (supabase/migrations/20261028090000_hr_leaves.sql).
 * Akış: talep → yönetici onayı (personnel.manager_id varsa) → İK onayı.
 * Son onayda günler puantaja yazılır; karar ve iptal sunucu fonksiyonlarıyla yapılır.
 */

export const LEAVES_SOURCE = "leave_requests_list";

export type LeaveType = "annual" | "excused" | "sick" | "unpaid";
export type LeaveStatus = "pending_manager" | "pending_hr" | "approved" | "rejected" | "cancelled";

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  annual: "Yıllık izin",
  excused: "Mazeret izni (ücretli)",
  sick: "Rapor (hastalık / iş kazası)",
  unpaid: "Ücretsiz izin",
};

/** Formda gösterilen kısa yasal bilgi */
export const LEAVE_TYPE_HINTS: Partial<Record<LeaveType, string>> = {
  excused:
    "İş Kanunu ek md. 2: evlenme 3 gün, eşin doğumu 5 gün, ana-baba, eş, kardeş ya da çocuğun ölümü 3 gün ücretli izin.",
  sick: "Açıklamaya teşhis ya da hastalık bilgisi yazmayın; rapor tarihi ve süresi yeterlidir.",
  unpaid: "Ücretsiz izin süresince SGK primi yatmaz; personelin yazılı talebinin alınması önerilir.",
};

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending_manager: "Yönetici onayında",
  pending_hr: "İK onayında",
  approved: "Onaylandı",
  rejected: "Reddedildi",
  cancelled: "İptal edildi",
};

export const LEAVE_STATUS_STYLES: Record<LeaveStatus, string> = {
  pending_manager: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  pending_hr: "bg-sky-500/10 text-sky-300 border-sky-500/25",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
  rejected: "bg-red-500/10 text-red-400 border-red-500/25",
  cancelled: "bg-zinc-800/60 text-zinc-500 border-zinc-700",
};

export const PENDING_STATUSES: LeaveStatus[] = ["pending_manager", "pending_hr"];

export type LeaveRequestInput = {
  personnelId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  dayCount: number;
  reason: string;
};

export type LeaveRequest = LeaveRequestInput & {
  id: string;
  status: LeaveStatus;
  personnelName: string;
  personnelCode: string;
  employmentType: EmploymentType;
  personnelUserId?: string;
  managerId?: string;
  managerDecidedByName?: string;
  managerDecidedAt?: string;
  managerNote: string;
  hrDecidedByName?: string;
  hrDecidedAt?: string;
  hrNote: string;
  createdByName: string;
  createdAt: string;
};

const text = (value: unknown) => (typeof value === "string" ? value : "");
const optional = (value: unknown) => (typeof value === "string" && value ? value : undefined);

export function mapLeaveRow(row: Record<string, unknown>): LeaveRequest {
  return {
    id: String(row.id),
    personnelId: String(row.personnel_id),
    personnelName: text(row.personnel_name),
    personnelCode: text(row.personnel_code),
    employmentType: (text(row.employment_type) || "office") as EmploymentType,
    personnelUserId: optional(row.personnel_user_id),
    managerId: optional(row.manager_id),
    type: text(row.type) as LeaveType,
    startDate: text(row.start_date),
    endDate: text(row.end_date),
    dayCount: Number(row.day_count) || 0,
    reason: text(row.reason),
    status: text(row.status) as LeaveStatus,
    managerDecidedByName: optional(row.manager_decided_by_name),
    managerDecidedAt: optional(row.manager_decided_at),
    managerNote: text(row.manager_note),
    hrDecidedByName: optional(row.hr_decided_by_name),
    hrDecidedAt: optional(row.hr_decided_at),
    hrNote: text(row.hr_note),
    createdByName: text(row.created_by_name),
    createdAt: text(row.created_at),
  };
}

// ---------------------------------------------------------------------------
// Gün sayımı ve yıllık izin hakkı
// ---------------------------------------------------------------------------

const FIXED_HOLIDAYS = new Set(["01-01", "04-23", "05-01", "05-19", "07-15", "08-30", "10-29"]);

/** Sabit tarihli resmî tatil mi (dini bayramlar her yıl değiştiği için dahil değil) */
export function isFixedHoliday(date: string) {
  return FIXED_HOLIDAYS.has(date.slice(5));
}

/**
 * İzinden düşülecek iş günü: Pazar, sabit resmî tatiller ve (Cumartesi
 * çalışılmıyorsa) Cumartesi sayılmaz (İş Kanunu md. 56). Sunucudaki
 * apply_leave_to_timesheet ile aynı kural.
 */
export function countLeaveDays(startDate: string, endDate: string, saturdayWorking: boolean): number {
  if (!startDate || !endDate || endDate < startDate) return 0;
  return eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) }).filter((day) => {
    const weekday = getDay(day);
    if (weekday === 0) return false;
    if (weekday === 6 && !saturdayWorking) return false;
    return !isFixedHoliday(format(day, "yyyy-MM-dd"));
  }).length;
}

/** İş Kanunu md. 53: hizmet yılına göre yıllık izin günü; 18 yaş ve altı ile 50 yaş ve üstü en az 20 gün */
export function entitlementForYear(serviceYears: number, age?: number) {
  const base = serviceYears <= 5 ? 14 : serviceYears < 15 ? 20 : 26;
  return age !== undefined && (age <= 18 || age >= 50) ? Math.max(base, 20) : base;
}

export type LeaveBalance = {
  /** Tamamlanan hizmet yılı */
  serviceYears: number;
  /** Bugüne kadar hak edilen toplam gün */
  earned: number;
  adjustment: number;
  used: number;
  pending: number;
  remaining: number;
  /** Bir sonraki hak ediş tarihi ve gün sayısı */
  nextAccrual?: { date: string; days: number };
  /** Yaş kuralı doğum tarihi olmadan uygulanamadı */
  ageUnknown: boolean;
};

export function computeLeaveBalance(options: {
  startDate: string;
  birthDate?: string;
  adjustment: number;
  requests: Pick<LeaveRequest, "type" | "status" | "dayCount">[];
  today?: Date;
}): LeaveBalance | null {
  const { startDate, birthDate, adjustment, requests } = options;
  if (!startDate) return null;
  const today = options.today ?? new Date();
  const start = parseISO(startDate);
  const birth = birthDate ? parseISO(birthDate) : null;
  const ageAt = (date: Date) => (birth ? differenceInYears(date, birth) : undefined);

  let earned = 0;
  let serviceYears = 0;
  for (let year = 1; year <= 60; year += 1) {
    const anniversary = addYears(start, year);
    if (anniversary > today) break;
    serviceYears = year;
    earned += entitlementForYear(year, ageAt(anniversary));
  }
  const nextDate = addYears(start, serviceYears + 1);
  const annual = requests.filter((request) => request.type === "annual");
  const used = annual.filter((r) => r.status === "approved").reduce((sum, r) => sum + r.dayCount, 0);
  const pending = annual.filter((r) => PENDING_STATUSES.includes(r.status)).reduce((sum, r) => sum + r.dayCount, 0);

  return {
    serviceYears,
    earned,
    adjustment,
    used,
    pending,
    remaining: earned + adjustment - used,
    nextAccrual: { date: format(nextDate, "yyyy-MM-dd"), days: entitlementForYear(serviceYears + 1, ageAt(nextDate)) },
    ageUnknown: !birth,
  };
}

// ---------------------------------------------------------------------------
// İşlemler
// ---------------------------------------------------------------------------

/** Verilen aralıkla çakışan talepler; personnelId verilirse yalnızca onun tüm talepleri */
export async function fetchLeaveRequests(
  options: { from?: string; to?: string; personnelId?: string; statuses?: LeaveStatus[] } = {}
): Promise<LeaveRequest[]> {
  const { data, error } = await fetchAllRows<Record<string, unknown>>((start, end) => {
    let query = supabase.from(LEAVES_SOURCE).select("*");
    if (options.to) query = query.lte("start_date", options.to);
    if (options.from) query = query.gte("end_date", options.from);
    if (options.personnelId) query = query.eq("personnel_id", options.personnelId);
    if (options.statuses) query = query.in("status", options.statuses);
    return query.order("start_date", { ascending: false }).order("id").range(start, end);
  });
  if (error) throw error;
  return data.map(mapLeaveRow);
}

/** Bildirimler: bekleyen talepler (RLS: yetkili / yönetici olduğu) ve kişinin son 14 günde sonuçlanan talepleri */
export async function fetchLeaveNotifications(userId: string): Promise<LeaveRequest[]> {
  const since = subDays(new Date(), 14).toISOString();
  const [pending, decided] = await Promise.all([
    supabase.from(LEAVES_SOURCE).select("*").in("status", PENDING_STATUSES).order("created_at").limit(200),
    supabase
      .from(LEAVES_SOURCE)
      .select("*")
      .eq("personnel_user_id", userId)
      .in("status", ["approved", "rejected"])
      .or(`hr_decided_at.gte.${since},manager_decided_at.gte.${since}`)
      .limit(50),
  ]);
  if (pending.error) throw pending.error;
  if (decided.error) throw decided.error;
  return [...(pending.data ?? []), ...(decided.data ?? [])].map((row) => mapLeaveRow(row as Record<string, unknown>));
}

export async function createLeaveRequest(input: LeaveRequestInput): Promise<void> {
  const { error } = await supabase.from("leave_requests").insert({
    personnel_id: input.personnelId,
    type: input.type,
    start_date: input.startDate,
    end_date: input.endDate,
    day_count: input.dayCount,
    reason: input.reason.trim(),
  });
  if (error) throw error;
}

/** İK düzeltmesi: gün sayısı ve açıklama (onaylı iznin tarihi değiştirilemez) */
export async function updateLeaveRequest(id: string, input: Pick<LeaveRequestInput, "dayCount" | "reason" | "startDate" | "endDate" | "type">) {
  const { error } = await supabase
    .from("leave_requests")
    .update({
      type: input.type,
      start_date: input.startDate,
      end_date: input.endDate,
      day_count: input.dayCount,
      reason: input.reason.trim(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function decideLeaveRequest(id: string, approve: boolean, note: string): Promise<LeaveStatus> {
  const { data, error } = await supabase.rpc("decide_leave_request", { p_id: id, p_approve: approve, p_note: note.trim() });
  if (error) throw error;
  return data as LeaveStatus;
}

export async function cancelLeaveRequest(id: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_leave_request", { p_id: id });
  if (error) throw error;
}

export async function deleteLeaveRequest(id: string): Promise<void> {
  const { error } = await supabase.from("leave_requests").delete().eq("id", id);
  if (error) throw error;
}

/** Kullanıcı bu talebi şimdi onaylayabilir / reddedebilir mi (sunucu da denetler) */
export function canDecide(
  request: Pick<LeaveRequest, "status" | "managerId" | "personnelUserId">,
  user: { id: string; role: string },
  isHr: boolean
) {
  if (request.personnelUserId === user.id && user.role !== "admin") return false;
  if (request.status === "pending_hr") return isHr;
  if (request.status === "pending_manager") return isHr || request.managerId === user.id;
  return false;
}

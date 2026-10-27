import { subDays } from "date-fns";
import { supabase } from "@/lib/supabase";
import { fetchAllRows } from "@/lib/supabase-query";
import type { UserRole } from "@/types";
import { localizedRecord } from "@/i18n/runtime";

/**
 * İK idari işler (supabase/migrations/20261029090000_hr_admin.sql):
 * duyurular ve personel talep kutusu.
 */

/** İK bildirim verisini hemen yeniden çeker (okuma, onay gibi işlemlerden sonra) */
export const HR_NOTIFICATIONS_REFRESH_EVENT = "hr-notifications-refresh";

export function refreshHrNotifications() {
  window.dispatchEvent(new Event(HR_NOTIFICATIONS_REFRESH_EVENT));
}

// ---------------------------------------------------------------------------
// Duyurular
// ---------------------------------------------------------------------------

export type AnnouncementInput = {
  title: string;
  body: string;
  /** Boş: herkes */
  audienceRoles: UserRole[];
  pinned: boolean;
  requiresAck: boolean;
  publishAt: string;
  expiresAt: string;
};

export type Announcement = AnnouncementInput & {
  id: string;
  createdByName: string;
  createdAt: string;
  updatedAt?: string;
  /** Oturumdaki kullanıcı okudu mu, ne zaman */
  readAt?: string;
};

export type AnnouncementRead = { userId: string; userName: string; readAt: string };

const text = (value: unknown) => (typeof value === "string" ? value : "");
const optional = (value: unknown) => (typeof value === "string" && value ? value : undefined);

function mapAnnouncement(row: Record<string, unknown>, readAt?: string): Announcement {
  return {
    id: String(row.id),
    title: text(row.title),
    body: text(row.body),
    audienceRoles: (Array.isArray(row.audience_roles) ? row.audience_roles : []) as UserRole[],
    pinned: row.pinned === true,
    requiresAck: row.requires_ack === true,
    publishAt: text(row.publish_at),
    expiresAt: text(row.expires_at),
    createdByName: text(row.created_by_name),
    createdAt: text(row.created_at),
    updatedAt: optional(row.updated_at),
    readAt,
  };
}

/** Duyurunun durumu: zamanlanmış, yayında, süresi dolmuş */
export function announcementState(announcement: Pick<Announcement, "publishAt" | "expiresAt">, now = new Date()) {
  if (new Date(announcement.publishAt) > now) return "scheduled" as const;
  if (announcement.expiresAt && new Date(announcement.expiresAt) <= now) return "expired" as const;
  return "live" as const;
}

/** Görülebilen duyurular (RLS) ve kullanıcının okuma kayıtları; sabitlenen ve yeni olan önce */
export async function fetchAnnouncements(userId: string): Promise<Announcement[]> {
  const [{ data, error }, reads] = await Promise.all([
    fetchAllRows<Record<string, unknown>>((from, to) =>
      supabase
        .from("announcements")
        .select("*")
        .order("pinned", { ascending: false })
        .order("publish_at", { ascending: false })
        .order("id")
        .range(from, to)
    ),
    supabase.from("announcement_reads").select("announcement_id, read_at").eq("user_id", userId),
  ]);
  if (error) throw error;
  if (reads.error) throw reads.error;
  const readMap = new Map((reads.data ?? []).map((row) => [String(row.announcement_id), String(row.read_at)]));
  return data.map((row) => mapAnnouncement(row, readMap.get(String(row.id))));
}

/** Bildirimler: son 60 günde yayınlanan, yayında olan ve okunmamış duyurular */
export async function fetchUnreadAnnouncements(userId: string): Promise<Announcement[]> {
  const since = subDays(new Date(), 60).toISOString();
  const now = new Date().toISOString();
  const [{ data, error }, reads] = await Promise.all([
    supabase
      .from("announcements")
      .select("*")
      .gte("publish_at", since)
      .lte("publish_at", now)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .limit(100),
    supabase.from("announcement_reads").select("announcement_id").eq("user_id", userId),
  ]);
  if (error) throw error;
  if (reads.error) throw reads.error;
  const read = new Set((reads.data ?? []).map((row) => String(row.announcement_id)));
  return (data ?? [])
    .map((row) => mapAnnouncement(row as Record<string, unknown>))
    .filter((announcement) => !read.has(announcement.id));
}

function announcementToDb(input: AnnouncementInput) {
  return {
    title: input.title.trim(),
    body: input.body.trim(),
    audience_roles: input.audienceRoles,
    pinned: input.pinned,
    requires_ack: input.requiresAck,
    publish_at: new Date(input.publishAt).toISOString(),
    expires_at: input.expiresAt ? new Date(input.expiresAt).toISOString() : null,
  };
}

export async function createAnnouncement(input: AnnouncementInput): Promise<void> {
  const { error } = await supabase.from("announcements").insert(announcementToDb(input));
  if (error) throw error;
}

export async function updateAnnouncement(id: string, input: AnnouncementInput): Promise<void> {
  const { error } = await supabase.from("announcements").update(announcementToDb(input)).eq("id", id);
  if (error) throw error;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) throw error;
}

/** Okundu / "okudum, anladım" kaydı (tekrar basılırsa değişmez) */
export async function markAnnouncementRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("announcement_reads")
    .upsert({ announcement_id: id }, { onConflict: "announcement_id,user_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function fetchAnnouncementReads(id: string): Promise<AnnouncementRead[]> {
  const { data, error } = await supabase
    .from("announcement_reads")
    .select("user_id, user_name, read_at")
    .eq("announcement_id", id)
    .order("read_at");
  if (error) throw error;
  return (data ?? []).map((row) => ({ userId: String(row.user_id), userName: text(row.user_name), readAt: text(row.read_at) }));
}

// ---------------------------------------------------------------------------
// Talep kutusu
// ---------------------------------------------------------------------------

export const REQUESTS_SOURCE = "personnel_requests_list";

export type RequestType = "advance" | "document" | "equipment" | "training" | "other";
export type RequestStatus = "pending" | "approved" | "rejected" | "completed" | "cancelled";

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = localizedRecord({
  advance: "hr.requestType.advance",
  document: "hr.requestType.document",
  equipment: "hr.requestType.equipment",
  training: "hr.requestType.training",
  other: "hr.requestType.other",
});

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = localizedRecord({
  pending: "hr.requestStatus.pending",
  approved: "hr.requestStatus.approved",
  rejected: "hr.requestStatus.rejected",
  completed: "hr.requestStatus.completed",
  cancelled: "hr.requestStatus.cancelled",
});

/** Onaylanan talep tamamlanınca kullanılan ifade */
export const REQUEST_COMPLETE_LABELS: Record<RequestType, string> = localizedRecord({
  advance: "hr.requestComplete.advance",
  document: "hr.requestComplete.document",
  equipment: "hr.requestComplete.equipment",
  training: "hr.requestComplete.training",
  other: "hr.requestComplete.other",
});

export const REQUEST_STATUS_STYLES: Record<RequestStatus, string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  approved: "bg-sky-500/10 text-sky-300 border-sky-500/25",
  rejected: "bg-red-500/10 text-red-400 border-red-500/25",
  completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
  cancelled: "bg-zinc-800/60 text-zinc-500 border-zinc-700",
};

export type PersonnelRequestInput = {
  personnelId: string;
  type: RequestType;
  title: string;
  description: string;
  amount: number | null;
};

export type PersonnelRequest = PersonnelRequestInput & {
  id: string;
  status: RequestStatus;
  personnelName: string;
  personnelCode: string;
  personnelUserId?: string;
  decisionNote: string;
  decidedByName?: string;
  decidedAt?: string;
  completedByName?: string;
  completedAt?: string;
  createdByName: string;
  createdAt: string;
};

export function mapRequestRow(row: Record<string, unknown>): PersonnelRequest {
  return {
    id: String(row.id),
    personnelId: String(row.personnel_id),
    personnelName: text(row.personnel_name),
    personnelCode: text(row.personnel_code),
    personnelUserId: optional(row.personnel_user_id),
    type: text(row.type) as RequestType,
    title: text(row.title),
    description: text(row.description),
    amount: row.amount === null || row.amount === undefined ? null : Number(row.amount),
    status: text(row.status) as RequestStatus,
    decisionNote: text(row.decision_note),
    decidedByName: optional(row.decided_by_name),
    decidedAt: optional(row.decided_at),
    completedByName: optional(row.completed_by_name),
    completedAt: optional(row.completed_at),
    createdByName: text(row.created_by_name),
    createdAt: text(row.created_at),
  };
}

export async function fetchPersonnelRequests(options: { year?: number; statuses?: RequestStatus[]; personnelId?: string } = {}) {
  const { data, error } = await fetchAllRows<Record<string, unknown>>((from, to) => {
    let query = supabase.from(REQUESTS_SOURCE).select("*");
    if (options.year) {
      query = query.gte("created_at", `${options.year}-01-01`).lt("created_at", `${options.year + 1}-01-01`);
    }
    if (options.statuses) query = query.in("status", options.statuses);
    if (options.personnelId) query = query.eq("personnel_id", options.personnelId);
    return query.order("created_at", { ascending: false }).order("id").range(from, to);
  });
  if (error) throw error;
  return data.map(mapRequestRow);
}

/** Bildirimler: bekleyen talepler (RLS) ve kullanıcının son 14 günde sonuçlanan talepleri */
export async function fetchRequestNotifications(userId: string): Promise<PersonnelRequest[]> {
  const since = subDays(new Date(), 14).toISOString();
  const [pending, decided] = await Promise.all([
    supabase.from(REQUESTS_SOURCE).select("*").eq("status", "pending").order("created_at").limit(200),
    supabase
      .from(REQUESTS_SOURCE)
      .select("*")
      .eq("personnel_user_id", userId)
      .in("status", ["approved", "rejected", "completed"])
      .or(`decided_at.gte.${since},completed_at.gte.${since}`)
      .limit(50),
  ]);
  if (pending.error) throw pending.error;
  if (decided.error) throw decided.error;
  return [...(pending.data ?? []), ...(decided.data ?? [])].map((row) => mapRequestRow(row as Record<string, unknown>));
}

/** Talebin düzenlenebilen alanları (personel sonradan değiştirilemez) */
function requestFieldsToDb(input: PersonnelRequestInput) {
  return {
    type: input.type,
    title: input.title.trim(),
    description: input.description.trim(),
    amount: input.type === "advance" ? input.amount : null,
  };
}

export async function createPersonnelRequest(input: PersonnelRequestInput): Promise<void> {
  const { error } = await supabase
    .from("personnel_requests")
    .insert({ personnel_id: input.personnelId, ...requestFieldsToDb(input) });
  if (error) throw error;
}

export async function updatePersonnelRequest(id: string, input: PersonnelRequestInput): Promise<void> {
  const { error } = await supabase.from("personnel_requests").update(requestFieldsToDb(input)).eq("id", id);
  if (error) throw error;
}

export async function setPersonnelRequestStatus(id: string, status: RequestStatus, note = ""): Promise<void> {
  const { error } = await supabase.rpc("set_personnel_request_status", { p_id: id, p_status: status, p_note: note.trim() });
  if (error) throw error;
}

export async function deletePersonnelRequest(id: string): Promise<void> {
  const { error } = await supabase.from("personnel_requests").delete().eq("id", id);
  if (error) throw error;
}

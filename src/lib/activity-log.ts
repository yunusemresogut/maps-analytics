import { STORAGE_KEYS } from "@/lib/storage-keys";
import { supabase } from "@/lib/supabase";
import type { ActivityCategory, ActivityLogEntry } from "@/types";

export const MAX_LOGS = 500;
const EVENT_NAME = "activity-log-updated";

export type ActivityLogEvent =
  | { type: "append"; entry: ActivityLogEntry }
  | { type: "clear" };

export type ActivityAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "approve"
  | "revoke"
  | "open"
  | "close"
  | "restrict"
  | "unrestrict"
  | "import"
  | "clear"
  | "upload";

export type ActivityLogInput = {
  category: ActivityCategory;
  action: ActivityAction | string;
  message: string;
  actorId?: string;
  actorName?: string;
  targetId?: string;
  targetLabel?: string;
};

async function getSessionActor(): Promise<{
  actorId: string;
  actorName: string;
}> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      return { actorId: "system", actorName: "Sistem" };
    }
    // Avoid extra profile query when email is enough for fallback
    return {
      actorId: session.user.id,
      actorName:
        (session.user.user_metadata?.name as string | undefined) ||
        session.user.email ||
        "Bilinmeyen",
    };
  } catch {
    return { actorId: "system", actorName: "Sistem" };
  }
}

/**
 * Low-cost activity log:
 * - Prefer passing actorId/actorName (skips session lookup)
 * - Local first, then fire-and-forget Supabase insert
 */
export async function appendActivityLog(input: ActivityLogInput) {
  if (typeof window === "undefined") return;

  let actorId = input.actorId;
  let actorName = input.actorName;

  if (!actorId || !actorName) {
    const sessionActor = await getSessionActor();
    actorId = actorId || sessionActor.actorId;
    actorName = actorName || sessionActor.actorName;
  }

  const entry: ActivityLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    category: input.category,
    action: input.action,
    message: input.message,
    actorId: actorId!,
    actorName: actorName!,
    targetId: input.targetId,
    targetLabel: input.targetLabel,
    createdAt: new Date().toISOString(),
  };

  // Yerel depoya yazılmaz: aynı tarayıcıdaki farklı hesaplar arasında
  // log paylaşılmasın. Açık ekranlar olayla güncellenir.
  window.dispatchEvent(
    new CustomEvent<ActivityLogEvent>(EVENT_NAME, { detail: { type: "append", entry } })
  );

  // Cloud write: non-blocking (don't await cost on UI path)
  void supabase
    .from("activity_logs")
    .insert({
      id: entry.id,
      category: entry.category,
      action: entry.action,
      message: entry.message,
      actor_id: entry.actorId,
      actor_name: entry.actorName,
      target_id: entry.targetId ?? null,
      target_label: entry.targetLabel ?? null,
      created_at: entry.createdAt,
    })
    .then(({ error }) => {
      if (error) console.error("Bulut log kaydı başarısız:", error);
    });
}

/** Convenience: always pass actor when known */
export function logActivity(
  input: ActivityLogInput & { actorId: string; actorName: string }
) {
  void appendActivityLog(input);
}

export async function clearActivityLogs() {
  if (typeof window === "undefined") return;
  // Eski sürümlerin bıraktığı yerel kopyayı da temizle
  localStorage.removeItem(STORAGE_KEYS.activityLogs);

  try {
    // RLS yalnızca oturumdaki firmanın loglarını siler
    await supabase.from("activity_logs").delete().neq("id", "");
  } catch (err) {
    console.error("Bulut log temizleme başarısız:", err);
  }

  window.dispatchEvent(
    new CustomEvent<ActivityLogEvent>(EVENT_NAME, { detail: { type: "clear" } })
  );
}

export function subscribeActivityLogs(callback: (event: ActivityLogEvent) => void) {
  if (typeof window === "undefined") return () => undefined;
  const listener = (event: Event) =>
    callback((event as CustomEvent<ActivityLogEvent>).detail);
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}

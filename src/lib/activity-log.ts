import { STORAGE_KEYS } from "@/lib/storage-keys";
import { supabase } from "@/lib/supabase";
import type { ActivityCategory, ActivityLogEntry } from "@/types";

const MAX_LOGS = 500;
const EVENT_NAME = "activity-log-updated";

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

export function loadActivityLogs(): ActivityLogEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEYS.activityLogs);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ActivityLogEntry[];
  } catch {
    return [];
  }
}

function saveActivityLogs(logs: ActivityLogEntry[]) {
  localStorage.setItem(STORAGE_KEYS.activityLogs, JSON.stringify(logs));
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

  const logs = [entry, ...loadActivityLogs()].slice(0, MAX_LOGS);
  saveActivityLogs(logs);
  window.dispatchEvent(new CustomEvent(EVENT_NAME));

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
  localStorage.removeItem(STORAGE_KEYS.activityLogs);

  try {
    await supabase.from("activity_logs").delete().neq("id", "");
  } catch (err) {
    console.error("Bulut log temizleme başarısız:", err);
  }

  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function subscribeActivityLogs(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(EVENT_NAME, callback);
  return () => window.removeEventListener(EVENT_NAME, callback);
}

import { STORAGE_KEYS } from "@/lib/storage-keys";
import type { ActivityCategory, ActivityLogEntry } from "@/types";

const MAX_LOGS = 500;
const EVENT_NAME = "activity-log-updated";

export type ActivityLogInput = {
  category: ActivityCategory;
  action: string;
  message: string;
  actorId?: string;
  actorName?: string;
  targetId?: string;
  targetLabel?: string;
};

function getSessionActor(): { actorId: string; actorName: string } {
  if (typeof window === "undefined") {
    return { actorId: "system", actorName: "Sistem" };
  }
  const sessionId = localStorage.getItem(STORAGE_KEYS.session);
  if (!sessionId) {
    return { actorId: "system", actorName: "Sistem" };
  }
  const usersRaw = localStorage.getItem(STORAGE_KEYS.users);
  if (!usersRaw) {
    return { actorId: sessionId, actorName: "Bilinmeyen" };
  }
  try {
    const users = JSON.parse(usersRaw) as { id: string; name: string }[];
    const found = users.find((u) => u.id === sessionId);
    return {
      actorId: sessionId,
      actorName: found?.name ?? "Bilinmeyen",
    };
  } catch {
    return { actorId: sessionId, actorName: "Bilinmeyen" };
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

export function appendActivityLog(input: ActivityLogInput) {
  if (typeof window === "undefined") return;

  const actor = getSessionActor();
  const entry: ActivityLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    category: input.category,
    action: input.action,
    message: input.message,
    actorId: input.actorId ?? actor.actorId,
    actorName: input.actorName ?? actor.actorName,
    targetId: input.targetId,
    targetLabel: input.targetLabel,
    createdAt: new Date().toISOString(),
  };

  const logs = [entry, ...loadActivityLogs()].slice(0, MAX_LOGS);
  saveActivityLogs(logs);
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function clearActivityLogs() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEYS.activityLogs);
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function subscribeActivityLogs(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(EVENT_NAME, callback);
  return () => window.removeEventListener(EVENT_NAME, callback);
}

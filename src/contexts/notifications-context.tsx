"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useStores } from "@/contexts/stores-context";
import { computeStoreNotifications } from "@/lib/notifications";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import type { AppNotification } from "@/types";

type NotificationsContextValue = {
  notifications: AppNotification[];
  dismissedIds: string[];
  dismiss: (id: string) => void;
  dismissAll: (ids: string[]) => void;
  undismiss: (id: string) => void;
  allNotifications: AppNotification[];
};

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null
);

function loadDismissed(): string[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEYS.dismissedNotifications);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function saveDismissed(ids: string[]) {
  localStorage.setItem(STORAGE_KEYS.dismissedNotifications, JSON.stringify(ids));
}

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { stores } = useStores();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    setDismissedIds(loadDismissed());
  }, []);

  const dismiss = useCallback((id: string) => {
    setDismissedIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveDismissed(next);
      return next;
    });
  }, []);

  const dismissAll = useCallback((ids: string[]) => {
    setDismissedIds((prev) => {
      const next = [...new Set([...prev, ...ids])];
      saveDismissed(next);
      return next;
    });
  }, []);

  const undismiss = useCallback((id: string) => {
    setDismissedIds((prev) => {
      const next = prev.filter((d) => d !== id);
      saveDismissed(next);
      return next;
    });
  }, []);

  const allNotifications = useMemo(
    () => computeStoreNotifications(stores),
    [stores]
  );

  const notifications = useMemo(() => {
    const dismissed = new Set(dismissedIds);
    return allNotifications.filter((n) => !dismissed.has(n.id));
  }, [allNotifications, dismissedIds]);

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        dismissedIds,
        dismiss,
        dismissAll,
        undismiss,
        allNotifications,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return ctx;
}

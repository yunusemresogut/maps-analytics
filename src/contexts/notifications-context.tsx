"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useAuth } from "@/contexts/auth-context";
import { useDb } from "@/contexts/db-context";
import { useSettings } from "@/contexts/settings-context";
import { useTeamChat } from "@/contexts/team-chat-context";
import { computeNotifications, notificationHref } from "@/lib/notifications";
import { NOTIFICATION_META } from "@/lib/notification-meta";
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

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const { stores, contracts, tickets, progressPayments, invoices, users } = useDb();
  const { messages } = useTeamChat();
  const { org, prefs, prefsLoaded, dismissedIds, updateDismissed } = useSettings();

  const dismiss = useCallback(
    (id: string) => updateDismissed((prev) => (prev.includes(id) ? prev : [...prev, id])),
    [updateDismissed]
  );

  const dismissAll = useCallback(
    (ids: string[]) => updateDismissed((prev) => [...new Set([...prev, ...ids])]),
    [updateDismissed]
  );

  const undismiss = useCallback(
    (id: string) => updateDismissed((prev) => prev.filter((d) => d !== id)),
    [updateDismissed]
  );

  const allNotifications = useMemo(
    () =>
      user && prefsLoaded
        ? computeNotifications({
            user,
            org,
            prefs,
            stores,
            contracts,
            tickets,
            progressPayments,
            invoices,
            teamMessages: messages,
            users,
          })
        : [],
    [user, prefsLoaded, org, prefs, stores, contracts, tickets, progressPayments, invoices, messages, users]
  );

  const notifications = useMemo(() => {
    const dismissed = new Set(dismissedIds);
    return allNotifications.filter((n) => !dismissed.has(n.id));
  }, [allNotifications, dismissedIds]);

  // Masaüstü bildirimi: yalnızca oturum sırasında yeni ortaya çıkanlar için
  const seenIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!prefsLoaded) return;
    const ids = new Set(notifications.map((n) => n.id));
    const seen = seenIds.current;
    seenIds.current = ids;
    // İlk hesaplamada mevcutları gösterme, yalnızca sonrasında gelenleri
    if (!seen || !prefs.notifications.desktop) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted" || document.visibilityState === "visible") return;
    for (const notification of notifications) {
      if (seen.has(notification.id)) continue;
      const desktop = new Notification(NOTIFICATION_META[notification.type].label, {
        body: notification.message,
        tag: notification.id,
      });
      desktop.onclick = () => {
        window.focus();
        window.location.assign(notificationHref(notification));
      };
    }
  }, [notifications, prefsLoaded, prefs.notifications.desktop]);

  useEffect(() => {
    if (!user) seenIds.current = null;
  }, [user]);

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

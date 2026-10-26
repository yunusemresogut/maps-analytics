"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { format, addDays } from "date-fns";
import { useAuth } from "@/contexts/auth-context";
import { useDb } from "@/contexts/db-context";
import { useSettings } from "@/contexts/settings-context";
import { useTeamChat } from "@/contexts/team-chat-context";
import { computeNotifications, notificationHref } from "@/lib/notifications";
import { NOTIFICATION_META } from "@/lib/notification-meta";
import { fetchExpiringCertificates, fetchPendingCertificates, type Certificate } from "@/lib/hr";
import { fetchLeaveNotifications, type LeaveRequest } from "@/lib/leaves";
import {
  HR_NOTIFICATIONS_REFRESH_EVENT,
  fetchRequestNotifications,
  fetchUnreadAnnouncements,
  type Announcement,
  type PersonnelRequest,
} from "@/lib/hr-admin";
import { fetchExpiringVehicles, type InventoryItem } from "@/lib/inventory";
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
  const hrData = useHrNotificationData(
    user?.id,
    org.modules.hr,
    org.notifications.certificateExpiryDays,
    org.notifications.vehicleExpiryDays
  );

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
            ...hrData,
          })
        : [],
    [user, prefsLoaded, org, prefs, stores, contracts, tickets, progressPayments, invoices, messages, users, hrData]
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

const HR_REFRESH_MS = 5 * 60 * 1000;

type HrNotificationData = {
  certificates: Certificate[];
  leaves: LeaveRequest[];
  announcements: Announcement[];
  requests: PersonnelRequest[];
  vehicles: InventoryItem[];
};
const NO_HR_DATA: HrNotificationData = { certificates: [], leaves: [], announcements: [], requests: [], vehicles: [] };

/**
 * İK bildirimleri için veri: eşik gününe kadar süresi dolan ve onay bekleyen
 * belgeler, bekleyen ve sonuçlanan izinler. Diğer modüller gibi ortak veriden
 * gelmediği için ayrıca, aralıklarla çekilir. Bir kaynak yüklenemezse (ör. Faz 2
 * migration'ı uygulanmadı) diğerinin bildirimleri yine üretilir.
 */
function useHrNotificationData(userId: string | undefined, hrEnabled: boolean, expiryDays: number, vehicleDays: number) {
  const [data, setData] = useState<HrNotificationData>(NO_HR_DATA);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = () => {
      const until = (days: number) => format(addDays(new Date(), days), "yyyy-MM-dd");
      const warn = (label: string) => (err: unknown) => {
        console.warn(`${label} yüklenemedi:`, err);
        return [];
      };
      const hr = <T,>(task: () => Promise<T[]>, label: string) => (hrEnabled ? task().catch(warn(label)) : Promise.resolve([] as T[]));
      Promise.all([
        hr(
          () =>
            Promise.all([fetchExpiringCertificates(until(expiryDays)), fetchPendingCertificates()]).then(([expiring, pending]) => [
              ...expiring,
              ...pending,
            ]),
          "Belge bildirimleri"
        ),
        hr(() => fetchLeaveNotifications(userId), "İzin bildirimleri"),
        hr(() => fetchUnreadAnnouncements(userId), "Duyuru bildirimleri"),
        hr(() => fetchRequestNotifications(userId), "Talep bildirimleri"),
        // Araç belgeleri envanterden gelir; İK modülünden bağımsızdır
        fetchExpiringVehicles(until(vehicleDays)).catch(warn("Araç bildirimleri")),
      ]).then(
        ([certificates, leaves, announcements, requests, vehicles]) =>
          !cancelled && setData({ certificates, leaves, announcements, requests, vehicles })
      );
    };
    load();
    const id = window.setInterval(load, HR_REFRESH_MS);
    window.addEventListener(HR_NOTIFICATIONS_REFRESH_EVENT, load);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener(HR_NOTIFICATIONS_REFRESH_EVENT, load);
    };
  }, [userId, hrEnabled, expiryDays, vehicleDays]);

  return userId ? data : NO_HR_DATA;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return ctx;
}

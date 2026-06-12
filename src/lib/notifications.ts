import type { AppNotification, Store } from "@/types";
import { getOpeningAlert } from "@/lib/opening-dates";
import { supportsOrderReminder } from "@/lib/project-status";

/** Bildirim altyapısı — şimdilik pasif, sadece hesaplama yapar */
export const NOTIFICATIONS_ENABLED = false;

export function computeStoreNotifications(stores: Store[]): AppNotification[] {
  const notifications: AppNotification[] = [];
  const now = new Date().toISOString();

  for (const store of stores) {
    const alert = getOpeningAlert(store.openingDate);

    if (alert.isOpeningSoon) {
      notifications.push({
        id: `notif-soon-${store.id}`,
        type: "opening_soon",
        storeId: store.id,
        storeName: store.name,
        message: `${store.name}: ${alert.label}`,
        createdAt: now,
        read: false,
      });
    }

    if (alert.isOverdue && store.projectStatus !== "acilis") {
      notifications.push({
        id: `notif-overdue-${store.id}`,
        type: "opening_overdue",
        storeId: store.id,
        storeName: store.name,
        message: `${store.name}: Açılış tarihi ${alert.daysSinceOpening} gün geçti`,
        createdAt: now,
        read: false,
      });
    }

    if (supportsOrderReminder(store.projectStatus)) {
      notifications.push({
        id: `notif-ihale-${store.id}`,
        type: "ihale_order_reminder",
        storeId: store.id,
        storeName: store.name,
        message: `${store.name}: İhale kaydı — sipariş kontrolü gerekebilir`,
        createdAt: now,
        read: false,
      });
    }
  }

  return notifications;
}

export function getNotificationCount(stores: Store[]): number {
  return computeStoreNotifications(stores).length;
}

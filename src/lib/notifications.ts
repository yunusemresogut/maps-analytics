import type { AppNotification, Contract, Store } from "@/types";
import { getOpeningAlert } from "@/lib/opening-dates";
import { needsContractWarning } from "@/lib/module-finance";

/** Bildirim altyapısı */
export const NOTIFICATIONS_ENABLED = true;

export function computeStoreNotifications(
  stores: Store[],
  contracts: Contract[] = []
): AppNotification[] {
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

    if (needsContractWarning(store.projectStatus, store.id, contracts)) {
      notifications.push({
        id: `notif-ihale-contract-${store.id}`,
        type: "ihale_contract_reminder",
        storeId: store.id,
        storeName: store.name,
        message: `${store.name}: İhale durumunda — sözleşmenizi oluşturun`,
        createdAt: now,
        read: false,
        actionHref: `/contracts/new?storeId=${store.id}`,
      });
    }
  }

  return notifications;
}

export function getNotificationCount(
  stores: Store[],
  contracts: Contract[] = []
): number {
  return computeStoreNotifications(stores, contracts).length;
}

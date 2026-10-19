export const STORAGE_KEYS = {
  stores: "maps-analytics-stores-v3",
  users: "maps-analytics-users-v2",
  regions: "maps-analytics-regions-v1",
  storeData: "maps-analytics-store-data",
  session: "maps-analytics-session",
  dismissedNotifications: "maps-analytics-dismissed-notifications",
  activityLogs: "maps-analytics-activity-logs",
  sidebarPinned: "maps-analytics-sidebar-pinned",
  locale: "maps-analytics-locale",
} as const;

/** Harita tercihleri cihaz başına tutulur (her harita hareketinde veritabanına yazılmaz) */
export function getMapViewKey(userId: string) {
  return `maps-analytics-map-view:${userId}`;
}

export function getHiddenRegionsKey(userId: string) {
  return `maps-analytics-map-regions:${userId}`;
}

export function getStoreDataKey(userId: string) {
  return `${STORAGE_KEYS.storeData}:${userId}`;
}

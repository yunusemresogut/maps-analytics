export const STORAGE_KEYS = {
  stores: "maps-analytics-stores-v3",
  users: "maps-analytics-users-v2",
  regions: "maps-analytics-regions-v1",
  storeData: "maps-analytics-store-data",
  session: "maps-analytics-session",
  dismissedNotifications: "maps-analytics-dismissed-notifications",
  activityLogs: "maps-analytics-activity-logs",
} as const;

export function getStoreDataKey(userId: string) {
  return `${STORAGE_KEYS.storeData}:${userId}`;
}

"use client";

import { useEffect } from "react";
import { useDb } from "@/contexts/db-context";
import { loadActivityLogs, subscribeActivityLogs } from "@/lib/activity-log";

export function useActivityLogs() {
  const { activityLogs, setActivityLogs } = useDb();

  useEffect(() => {
    // Tam DB refetch yerine sadece log listesini güncelle — stores state'i ezilmesin
    return subscribeActivityLogs(() => {
      void setActivityLogs(loadActivityLogs());
    });
  }, [setActivityLogs]);

  return activityLogs;
}

"use client";

import { useEffect } from "react";
import { useDb } from "@/contexts/db-context";
import { subscribeActivityLogs } from "@/lib/activity-log";

export function useActivityLogs() {
  const { activityLogs, refetch } = useDb();

  useEffect(() => {
    // Local log event triggers a refetch from DB
    return subscribeActivityLogs(() => {
      refetch();
    });
  }, [refetch]);

  return activityLogs;
}

"use client";

import { useEffect, useRef } from "react";
import { useDb } from "@/contexts/db-context";
import { MAX_LOGS, subscribeActivityLogs } from "@/lib/activity-log";

export function useActivityLogs() {
  const { activityLogs, setActivityLogs } = useDb();
  const logsRef = useRef(activityLogs);

  useEffect(() => {
    logsRef.current = activityLogs;
  }, [activityLogs]);

  useEffect(() => {
    // Tam DB refetch yerine sadece log listesini güncelle — stores state'i ezilmesin
    return subscribeActivityLogs((event) => {
      const next =
        event.type === "clear"
          ? []
          : [event.entry, ...logsRef.current].slice(0, MAX_LOGS);
      logsRef.current = next;
      void setActivityLogs(next);
    });
  }, [setActivityLogs]);

  return activityLogs;
}

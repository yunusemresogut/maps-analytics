"use client";

import { useEffect, useState } from "react";
import {
  loadActivityLogs,
  subscribeActivityLogs,
} from "@/lib/activity-log";
import type { ActivityLogEntry } from "@/types";

export function useActivityLogs() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);

  useEffect(() => {
    setLogs(loadActivityLogs());
    return subscribeActivityLogs(() => setLogs(loadActivityLogs()));
  }, []);

  return logs;
}

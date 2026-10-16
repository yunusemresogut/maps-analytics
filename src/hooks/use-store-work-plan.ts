"use client";

import { useEffect, useState } from "react";
import { fetchStoreWorkPlan } from "@/lib/store-details";
import type { StoreWorkPlanItem } from "@/types";

/**
 * Mağazanın tüm iş planını çeker (Gantt ve öncül seçimi bütün kalemlere ihtiyaç
 * duyar). Yalnızca `enabled` iken yüklenir; `version` değişince tazelenir.
 */
export function useStoreWorkPlan(storeId: string, enabled: boolean, version: number) {
  const [state, setState] = useState<{
    key: string;
    items: StoreWorkPlanItem[];
  } | null>(null);
  const key = `${storeId}|${version}`;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetchStoreWorkPlan(storeId)
      .then((items) => {
        if (!cancelled) setState({ key, items });
      })
      .catch((err) => {
        console.error("İş planı yüklenemedi:", err);
        if (!cancelled) setState({ key, items: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, enabled, key]);

  // Eski mağaza/sürüme ait veri gösterilmez; yeni veri gelene kadar yükleniyor sayılır
  const current = state?.key === key ? state.items : null;
  return { items: current ?? [], isLoading: enabled && current === null };
}

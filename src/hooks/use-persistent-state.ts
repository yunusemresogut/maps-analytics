"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useSettings } from "@/contexts/settings-context";
import { readTableMemory, writeTableMemory } from "@/lib/table-memory";

/**
 * useState gibi çalışır; memoryKey verilmişse ve kullanıcı "tablo hafızası"nı
 * açık tuttuysa değer sekme oturumu boyunca hatırlanır. memoryKey sayfayı,
 * field o sayfadaki alanı (arama, filtre, sayfa…) belirtir.
 */
export function usePersistentState<T>(
  memoryKey: string | undefined,
  field: string,
  initial: T | (() => T)
): [T, Dispatch<SetStateAction<T>>] {
  const { user } = useAuth();
  const { prefs } = useSettings();
  const scope = user?.id;
  const enabled = Boolean(memoryKey && scope && prefs.tableMemory);

  const [value, setValue] = useState<T>(() => {
    const fallback = typeof initial === "function" ? (initial as () => T)() : initial;
    if (!enabled) return fallback;
    const stored = readTableMemory<T>(scope!, memoryKey!, field);
    // Kayıtlı değerin türü değiştiyse (eski sürüm) varsayılana dön
    return stored !== undefined && typeof stored === typeof fallback ? stored : fallback;
  });

  useEffect(() => {
    if (enabled) writeTableMemory(scope!, memoryKey!, field, value);
  }, [enabled, scope, memoryKey, field, value]);

  return [value, setValue];
}

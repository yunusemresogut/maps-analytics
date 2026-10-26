"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { fetchMyPersonnelId } from "@/lib/hr";

// Menü ve sayfalar aynı sonucu paylaşsın diye kullanıcı başına tek istek
const cache = new Map<string, Promise<string | null>>();

/** Oturumdaki kullanıcının bağlı olduğu personel kartı; bağlı değilse null */
export function useMyPersonnelId() {
  const { user } = useAuth();
  const userId = user?.id;
  const [result, setResult] = useState<{ userId: string; id: string | null } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let request = cache.get(userId);
    if (!request) {
      request = fetchMyPersonnelId(userId).catch((err) => {
        // Tablo yoksa (migration uygulanmadı) ya da hata: bağlı kart yok sayılır
        console.warn("Personel kartı okunamadı:", err);
        cache.delete(userId);
        return null;
      });
      cache.set(userId, request);
    }
    void request.then((id) => !cancelled && setResult({ userId, id }));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const current = result && result.userId === userId ? result : null;
  return { myPersonnelId: current?.id ?? null, loaded: !!current };
}

/** Personel kartı bir kullanıcıya bağlanınca / bağ kaldırılınca önbelleği temizler */
export function resetMyPersonnelCache() {
  cache.clear();
}

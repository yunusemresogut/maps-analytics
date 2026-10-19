"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase";

/**
 * Kullanıcının bir mağaza için kendi özel notu. Veritabanı kuralı gereği
 * yalnızca oturumdaki kullanıcının notu okunur/yazılır; başkasınınki görünmez.
 */
export function usePrivateNote(storeId: string) {
  const { user } = useAuth();
  const userId = user?.id;
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void supabase
      .from("store_private_notes")
      .select("note")
      .eq("store_id", storeId)
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error("Özel not yüklenemedi:", error);
        setLoadError(!!error);
        setNote(data?.note ?? "");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, userId]);

  /** Boş not satırı siler; aksi hâlde ekler/günceller */
  const save = useCallback(
    async (next: string) => {
      if (!userId) return false;
      const text = next.trim() ? next : "";
      const { error } = text
        ? await supabase
            .from("store_private_notes")
            .upsert(
              { user_id: userId, store_id: storeId, note: text, updated_at: new Date().toISOString() },
              { onConflict: "user_id,store_id" }
            )
        : await supabase.from("store_private_notes").delete().eq("store_id", storeId).eq("user_id", userId);
      if (error) {
        console.error("Özel not kaydedilemedi:", error);
        return false;
      }
      setNote(text);
      return true;
    },
    [storeId, userId]
  );

  return { note, loading, loadError, save };
}

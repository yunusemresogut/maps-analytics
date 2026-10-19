"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { useSettings } from "@/contexts/settings-context";
import { getHiddenRegionsKey } from "@/lib/storage-keys";
import { appendActivityLog } from "@/lib/activity-log";
import type { Region } from "@/types";

type RegionsContextValue = {
  regions: Region[];
  addRegion: (data: Omit<Region, "id">) => Region;
  updateRegion: (id: string, data: Partial<Region>) => void;
  deleteRegion: (id: string) => void;
  addCityToRegion: (regionId: string, city: string) => void;
  removeCityFromRegion: (regionId: string, city: string) => void;
  visibleRegions: Record<string, boolean>;
  toggleRegion: (regionId: string) => void;
  setRegionVisibility: (regionId: string, visible: boolean) => void;
  showAllRegions: () => void;
  hideAllRegions: () => void;
  isRegionVisible: (regionId: string) => boolean;
  isPanelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
};

const RegionsContext = createContext<RegionsContextValue | null>(null);

function buildVisibility(regions: Region[]): Record<string, boolean> {
  return Object.fromEntries(regions.map((r) => [r.id, true]));
}

export function RegionsProvider({ children }: { children: React.ReactNode }) {
  const [regions, setRegions] = useState<Region[]>([]);
  const [visibleRegions, setVisibleRegions] = useState<Record<string, boolean>>({});
  const [isPanelOpen, setPanelOpen] = useState(false);
  const { user } = useAuth();
  const { prefs, prefsLoaded } = useSettings();
  const hiddenKey = user ? getHiddenRegionsKey(user.id) : null;
  const rememberRegions = prefs.map.rememberRegions;
  const [restoredKey, setRestoredKey] = useState<string | null>(null);

  // Bölgeler yüklenince kullanıcının gizlediği bölgeler bir kez geri yüklenir
  if (hiddenKey && prefsLoaded && regions.length > 0 && restoredKey !== hiddenKey) {
    setRestoredKey(hiddenKey);
    if (rememberRegions) {
      try {
        const hidden: unknown = JSON.parse(localStorage.getItem(hiddenKey) ?? "[]");
        if (Array.isArray(hidden) && hidden.length > 0) {
          setVisibleRegions((prev) => {
            const next = { ...prev };
            for (const id of hidden) if (typeof id === "string" && id in next) next[id] = false;
            return next;
          });
        }
      } catch {
        // bozuk kayıt: tüm bölgeler görünür
      }
    }
  }

  useEffect(() => {
    if (!hiddenKey || restoredKey !== hiddenKey) return;
    try {
      if (rememberRegions) {
        const hidden = Object.entries(visibleRegions).filter(([, visible]) => !visible).map(([id]) => id);
        localStorage.setItem(hiddenKey, JSON.stringify(hidden));
      } else {
        localStorage.removeItem(hiddenKey);
      }
    } catch {
      // depolama yoksa hatırlamadan devam et
    }
  }, [visibleRegions, hiddenKey, restoredKey, rememberRegions]);

  useEffect(() => {
    let cancelled = false;

    const fetchRegions = async () => {
      try {
        const { data, error } = await supabase.from("regions").select("*");
        if (error) throw error;
        if (cancelled) return;
        // Her firma kendi bölgelerini oluşturur; yeni hesap boş başlar
        setRegions(data ?? []);
        setVisibleRegions(buildVisibility(data ?? []));
      } catch (err) {
        console.error("Regions fetch error:", err);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setTimeout(() => {
        if (cancelled) return;
        if (event === "SIGNED_OUT") {
          setRegions([]);
          setVisibleRegions({});
          return;
        }
        if (
          (event === "INITIAL_SESSION" && session) ||
          event === "SIGNED_IN"
        ) {
          void fetchRegions();
        }
      }, 0);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const persist = useCallback((next: Region[], idToSync?: string) => {
    setRegions(next);
    setVisibleRegions((prev) => {
      const nextVis: Record<string, boolean> = {};
      for (const r of next) {
        nextVis[r.id] = prev[r.id] ?? true;
      }
      return nextVis;
    });

    if (idToSync) {
      const targetRegion = next.find((r) => r.id === idToSync);
      if (targetRegion) {
        supabase
          .from("regions")
          .update({
            name: targetRegion.name,
            cities: targetRegion.cities,
            color: targetRegion.color,
          })
          .eq("id", idToSync)
          .then(({ error }) => {
            if (error) console.error("Error updating region in Supabase:", error);
          });
      }
    }
  }, []);

  const addRegion = useCallback(
    (data: Omit<Region, "id">) => {
      const region: Region = { ...data, id: `region-${crypto.randomUUID()}` };
      const next = [...regions, region];
      
      // Update local state immediately
      setRegions(next);
      setVisibleRegions((prev) => ({ ...prev, [region.id]: true }));

      // Insert to Supabase in background
      supabase
        .from("regions")
        .insert(region)
        .then(({ error }) => {
          if (error) console.error("Error adding region to Supabase:", error);
        });

      appendActivityLog({
        category: "region",
        action: "create",
        message: `Bölge oluşturuldu: ${region.name}`,
        targetId: region.id,
        targetLabel: region.name,
      });
      return region;
    },
    [regions]
  );

  const updateRegion = useCallback(
    (id: string, data: Partial<Region>) => {
      const next = regions.map((r) => (r.id === id ? { ...r, ...data } : r));
      persist(next, id);
    },
    [regions, persist]
  );

  const deleteRegion = useCallback(
    (id: string) => {
      const target = regions.find((r) => r.id === id);
      const next = regions.filter((r) => r.id !== id);
      
      setRegions(next);
      setVisibleRegions((prev) => {
        const nextVis = { ...prev };
        delete nextVis[id];
        return nextVis;
      });

      // Delete from Supabase in background
      supabase
        .from("regions")
        .delete()
        .eq("id", id)
        .then(({ error }) => {
          if (error) console.error("Error deleting region from Supabase:", error);
        });

      if (target) {
        appendActivityLog({
          category: "region",
          action: "delete",
          message: `Bölge silindi: ${target.name}`,
          targetId: id,
          targetLabel: target.name,
        });
      }
    },
    [regions]
  );

  const addCityToRegion = useCallback(
    (regionId: string, city: string) => {
      const region = regions.find((r) => r.id === regionId);
      const next = regions.map((r) =>
        r.id === regionId && !r.cities.includes(city)
          ? { ...r, cities: [...r.cities, city] }
          : r
      );
      persist(next, regionId);
      if (region) {
        appendActivityLog({
          category: "region",
          action: "add_city",
          message: `${city} şehri ${region.name} bölgesine eklendi`,
          targetId: regionId,
          targetLabel: region.name,
        });
      }
    },
    [regions, persist]
  );

  const removeCityFromRegion = useCallback(
    (regionId: string, city: string) => {
      const region = regions.find((r) => r.id === regionId);
      const next = regions.map((r) =>
        r.id === regionId
          ? { ...r, cities: r.cities.filter((c) => c !== city) }
          : r
      );
      persist(next, regionId);
      if (region) {
        appendActivityLog({
          category: "region",
          action: "remove_city",
          message: `${city} şehri ${region.name} bölgesinden kaldırıldı`,
          targetId: regionId,
          targetLabel: region.name,
        });
      }
    },
    [regions, persist]
  );

  const toggleRegion = useCallback((regionId: string) => {
    setVisibleRegions((prev) => ({
      ...prev,
      [regionId]: !prev[regionId],
    }));
  }, []);

  const setRegionVisibility = useCallback(
    (regionId: string, visible: boolean) => {
      setVisibleRegions((prev) => ({ ...prev, [regionId]: visible }));
    },
    []
  );

  const showAllRegions = useCallback(() => {
    setVisibleRegions(buildVisibility(regions));
  }, [regions]);

  const hideAllRegions = useCallback(() => {
    setVisibleRegions(Object.fromEntries(regions.map((r) => [r.id, false])));
  }, [regions]);

  const isRegionVisible = useCallback(
    (regionId: string) => visibleRegions[regionId] !== false,
    [visibleRegions]
  );

  return (
    <RegionsContext.Provider
      value={{
        regions,
        addRegion,
        updateRegion,
        deleteRegion,
        addCityToRegion,
        removeCityFromRegion,
        visibleRegions,
        toggleRegion,
        setRegionVisibility,
        showAllRegions,
        hideAllRegions,
        isRegionVisible,
        isPanelOpen,
        setPanelOpen,
      }}
    >
      {children}
    </RegionsContext.Provider>
  );
}

export function useRegions() {
  const ctx = useContext(RegionsContext);
  if (!ctx) throw new Error("useRegions must be used within RegionsProvider");
  return ctx;
}

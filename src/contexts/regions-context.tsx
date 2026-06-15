"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { defaultRegions } from "@/data/regions";
import { appendActivityLog } from "@/lib/activity-log";
import { STORAGE_KEYS } from "@/lib/storage-keys";
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

function loadRegions(): Region[] {
  if (typeof window === "undefined") return defaultRegions;
  const stored = localStorage.getItem(STORAGE_KEYS.regions);
  if (stored) return JSON.parse(stored);
  localStorage.setItem(STORAGE_KEYS.regions, JSON.stringify(defaultRegions));
  return defaultRegions;
}

function saveRegions(regions: Region[]) {
  localStorage.setItem(STORAGE_KEYS.regions, JSON.stringify(regions));
}

function buildVisibility(regions: Region[]): Record<string, boolean> {
  return Object.fromEntries(regions.map((r) => [r.id, true]));
}

export function RegionsProvider({ children }: { children: React.ReactNode }) {
  const [regions, setRegions] = useState<Region[]>(defaultRegions);
  const [visibleRegions, setVisibleRegions] = useState<Record<string, boolean>>(
    {}
  );
  const [isPanelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    const loaded = loadRegions();
    setRegions(loaded);
    setVisibleRegions(buildVisibility(loaded));
  }, []);

  const persist = useCallback((next: Region[]) => {
    setRegions(next);
    saveRegions(next);
    setVisibleRegions((prev) => {
      const nextVis: Record<string, boolean> = {};
      for (const r of next) {
        nextVis[r.id] = prev[r.id] ?? true;
      }
      return nextVis;
    });
  }, []);

  const addRegion = useCallback(
    (data: Omit<Region, "id">) => {
      const region: Region = { ...data, id: `region-${Date.now()}` };
      persist([...regions, region]);
      appendActivityLog({
        category: "region",
        action: "create",
        message: `Bölge oluşturuldu: ${region.name}`,
        targetId: region.id,
        targetLabel: region.name,
      });
      return region;
    },
    [regions, persist]
  );

  const updateRegion = useCallback(
    (id: string, data: Partial<Region>) => {
      persist(regions.map((r) => (r.id === id ? { ...r, ...data } : r)));
    },
    [regions, persist]
  );

  const deleteRegion = useCallback(
    (id: string) => {
      const target = regions.find((r) => r.id === id);
      persist(regions.filter((r) => r.id !== id));
      setVisibleRegions((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
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
    [regions, persist]
  );

  const addCityToRegion = useCallback(
    (regionId: string, city: string) => {
      const region = regions.find((r) => r.id === regionId);
      persist(
        regions.map((r) =>
          r.id === regionId && !r.cities.includes(city)
            ? { ...r, cities: [...r.cities, city] }
            : r
        )
      );
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
      persist(
        regions.map((r) =>
          r.id === regionId
            ? { ...r, cities: r.cities.filter((c) => c !== city) }
            : r
        )
      );
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

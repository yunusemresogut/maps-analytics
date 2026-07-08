"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Map, { NavigationControl } from "react-map-gl/maplibre";
import type { MapMouseEvent, MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { Plus, X } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { findRegionForCity } from "@/data/regions";
import { useRegions } from "@/contexts/regions-context";
import { useStores } from "@/contexts/stores-context";
import { usePermissions } from "@/hooks/use-permissions";
import { StoreMarker } from "@/components/map/store-marker";
import { StoreDetailPanel } from "@/components/map/store-detail-panel";
import { AddStorePanel } from "@/components/map/add-store-panel";
import { RegionFilterPanel } from "@/components/map/region-filter-panel";
import { StoreListPanel } from "@/components/map/store-list-panel";
import { getOpeningAlert } from "@/lib/opening-dates";
import { projectStatusConfig } from "@/lib/project-status";
import { Button } from "@/components/ui/button";
import type { ProjectStatus } from "@/types";

const LIGHT_MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

const DARK_MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const TURKEY_CENTER = { longitude: 35.2433, latitude: 38.9637, zoom: 5.5 };

export function StoreMap() {
  const { theme } = useTheme();
  const searchParams = useSearchParams();
  const mapRef = useRef<MapRef>(null);
  const { canAdd } = usePermissions();
  const { stores, getStore } = useStores();
  const { regions, isRegionVisible } = useRegions();

  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const visibleStores = useMemo(() => {
    return stores.filter((store) => {
      const region = findRegionForCity(store.city, regions);
      if (!region) return true;
      return isRegionVisible(region.id);
    });
  }, [stores, regions, isRegionVisible]);

  const selectedStore = selectedStoreId ? getStore(selectedStoreId) : null;

  const statusCounts = visibleStores.reduce(
    (acc, store) => {
      acc[store.projectStatus] = (acc[store.projectStatus] ?? 0) + 1;
      return acc;
    },
    {} as Record<ProjectStatus, number>
  );

  const openingSoonCount = visibleStores.filter(
    (s) => getOpeningAlert(s.openingDate).isOpeningSoon
  ).length;

  const focusStore = useCallback(
    (storeId: string) => {
      const store = getStore(storeId);
      if (!store) return;

      setAddMode(false);
      setPendingCoords(null);
      setSelectedStoreId(storeId);

      mapRef.current?.flyTo({
        center: [store.longitude, store.latitude],
        zoom: 12,
        duration: 1200,
      });
    },
    [getStore]
  );

  useEffect(() => {
    const storeId = searchParams.get("store");
    if (storeId && getStore(storeId)) {
      focusStore(storeId);
    }
  }, [searchParams, getStore, focusStore]);

  const handleMapClick = useCallback(
    (e: MapMouseEvent) => {
      if (addMode && canAdd) {
        setPendingCoords({
          latitude: e.lngLat.lat,
          longitude: e.lngLat.lng,
        });
        setSelectedStoreId(null);
        return;
      }
      setSelectedStoreId(null);
      setPendingCoords(null);
    },
    [addMode, canAdd]
  );

  const exitAddMode = () => {
    setAddMode(false);
    setPendingCoords(null);
  };

  return (
    <div
      className={`relative h-full w-full ${addMode ? "cursor-crosshair" : ""}`}
    >
      <Map
        ref={mapRef}
        initialViewState={TURKEY_CENTER}
        mapStyle={theme === "light" ? LIGHT_MAP_STYLE : DARK_MAP_STYLE}
        onClick={handleMapClick}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {visibleStores.map((store) => (
          <StoreMarker
            key={store.id}
            store={store}
            isSelected={selectedStoreId === store.id}
            onClick={() => {
              if (addMode) return;
              setPendingCoords(null);
              setSelectedStoreId(store.id);
            }}
          />
        ))}
      </Map>

      {addMode && (
        <div className="pointer-events-none absolute inset-0 z-[5] border-2 border-dashed border-cyan-500/40 bg-cyan-500/5" />
      )}

      <div className="pointer-events-none absolute left-2 top-2 z-10 flex w-[min(220px,calc(100vw-1rem))] flex-col gap-2 sm:left-4 sm:top-4">
        <div className="pointer-events-auto rounded-xl border border-zinc-700/60 bg-zinc-950/80 p-4 backdrop-blur-md">
          <h2 className="text-sm font-semibold text-zinc-100">
            Mağaza Haritası
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            {visibleStores.length} / {stores.length} görünür
          </p>
          <div className="scrollbar-themed mt-3 max-h-52 space-y-1.5 overflow-y-auto pr-1">
            {(Object.keys(projectStatusConfig) as ProjectStatus[]).map(
              (status) => (
                <div
                  key={status}
                  className="flex items-center gap-1.5 text-xs text-zinc-400"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: projectStatusConfig[status].marker,
                    }}
                  />
                  {projectStatusConfig[status].label} (
                  {statusCounts[status] ?? 0})
                </div>
              )
            )}
            {openingSoonCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-red-400">
                <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
                Yakında Açılıyor ({openingSoonCount})
              </div>
            )}
          </div>
        </div>

        {canAdd && (
          <div className="pointer-events-auto">
            {addMode ? (
              <Button
                variant="outline"
                size="sm"
                onClick={exitAddMode}
                className="w-full border-cyan-500/50 text-cyan-300"
              >
                <X className="h-3.5 w-3.5" />
                Konum Seçimini İptal Et
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setAddMode(true)}
                className="w-full"
              >
                <Plus className="h-3.5 w-3.5" />
                Yeni Konum Ekle
              </Button>
            )}
          </div>
        )}

        {addMode && !pendingCoords && (
          <p className="pointer-events-none rounded-lg border border-cyan-500/30 bg-zinc-950/90 px-3 py-2 text-xs text-cyan-300 backdrop-blur-md">
            Haritada bir noktaya tıklayın
          </p>
        )}
      </div>

      {selectedStore && !addMode && (
        <StoreDetailPanel
          store={selectedStore}
          onClose={() => setSelectedStoreId(null)}
        />
      )}

      {pendingCoords && addMode && (
        <AddStorePanel
          coords={pendingCoords}
          onClose={() => setPendingCoords(null)}
          onSaved={(id) => {
            setAddMode(false);
            setPendingCoords(null);
            setSelectedStoreId(id);
          }}
        />
      )}

      <RegionFilterPanel />

      <StoreListPanel
        stores={visibleStores}
        selectedStoreId={selectedStoreId}
        onSelect={focusStore}
      />
    </div>
  );
}

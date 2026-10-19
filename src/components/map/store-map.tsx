"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Map, { Marker, NavigationControl } from "react-map-gl/maplibre";
import type { MapMouseEvent, MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { Plus, X } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useAuth } from "@/contexts/auth-context";
import { useSettings } from "@/contexts/settings-context";
import { getMapViewKey } from "@/lib/storage-keys";
import { findRegionForCity } from "@/data/regions";
import { useRegions } from "@/contexts/regions-context";
import { useStores } from "@/contexts/stores-context";
import { usePermissions } from "@/hooks/use-permissions";
import { StoreMarker } from "@/components/map/store-marker";
import { StoreDetailPanel } from "@/components/map/store-detail-panel";
import { AddStorePanel } from "@/components/map/add-store-panel";
import { RegionFilterPanel } from "@/components/map/region-filter-panel";
import { StoreListPanel } from "@/components/map/store-list-panel";
import { DraftPin } from "@/components/location/location-picker-map";
import type { Coords, MapPick } from "@/lib/geocode";
import { useT } from "@/contexts/i18n-context";
import { getOpeningAlert } from "@/lib/opening-dates";
import {
  getProjectStatusLabel,
  projectStatusConfig,
} from "@/lib/project-status";
import { Button } from "@/components/ui/button";
import type { ProjectStatus } from "@/types";

const LIGHT_MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

const DARK_MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const TURKEY_CENTER = { longitude: 35.2433, latitude: 38.9637, zoom: 5.5 };

type MapView = typeof TURKEY_CENTER;

function readSavedView(key: string): MapView | null {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "null") as Partial<MapView> | null;
    if (!saved || ![saved.longitude, saved.latitude, saved.zoom].every((n) => typeof n === "number")) return null;
    return saved as MapView;
  } catch {
    return null;
  }
}

export function StoreMap() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { prefs } = useSettings();
  const viewKey = user ? getMapViewKey(user.id) : null;
  const rememberView = prefs.map.rememberView;
  // Harita yeniden açıldığında son konumdan başlar
  const [initialView] = useState<MapView>(
    () => (rememberView && viewKey ? readSavedView(viewKey) : null) ?? TURKEY_CENTER
  );
  const t = useT();
  const searchParams = useSearchParams();
  const mapRef = useRef<MapRef>(null);
  const { canAdd } = usePermissions("map");
  const { stores, getStore } = useStores();
  const { regions, isRegionVisible } = useRegions();

  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [addMode, setAddMode] = useState(false);
  // Açık panel (ekleme/düzenleme) konum seçimi istiyor mu, taslak pin nerede,
  // haritadan gelen son seçim ne: konumun sahibi paneldir, harita yalnızca iletir
  const [pickActive, setPickActive] = useState(false);
  // Panelde kaydedilmemiş düzenleme varken haritaya tıklamak onu kapatmasın
  const [panelEditing, setPanelEditing] = useState(false);
  const [draftCoords, setDraftCoords] = useState<Coords | null>(null);
  const [mapPick, setMapPick] = useState<MapPick | null>(null);
  const pickNonce = useRef(0);
  const emitPick = useCallback((coords: Coords, source: MapPick["source"]) => {
    pickNonce.current += 1;
    setMapPick({ coords, nonce: pickNonce.current, source });
  }, []);

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
      // Konum seçilirken tıklama pini taşır; seçili mağaza kapanmaz
      if (pickActive) {
        emitPick({ latitude: e.lngLat.lat, longitude: e.lngLat.lng }, "click");
        return;
      }
      if (addMode || panelEditing) return;
      setSelectedStoreId(null);
    },
    [addMode, panelEditing, pickActive, emitPick]
  );

  // Taslak pin ekranın dışına düşerse (ör. adres aramasıyla) harita oraya gider
  const draftKey = draftCoords ? `${draftCoords.latitude},${draftCoords.longitude}` : "";
  useEffect(() => {
    const map = mapRef.current;
    if (!draftCoords || !map) return;
    if (!map.getBounds().contains([draftCoords.longitude, draftCoords.latitude])) {
      map.flyTo({
        center: [draftCoords.longitude, draftCoords.latitude],
        zoom: Math.max(map.getZoom(), 14),
        duration: 900,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  const exitAddMode = () => {
    setAddMode(false);
  };

  return (
    <div
      className="relative h-full w-full"
    >
      <Map
        ref={mapRef}
        initialViewState={initialView}
        onMoveEnd={(event) => {
          if (!rememberView || !viewKey) return;
          const { longitude, latitude, zoom } = event.viewState;
          try {
            localStorage.setItem(viewKey, JSON.stringify({ longitude, latitude, zoom }));
          } catch {
            // depolama yoksa hatırlamadan devam et
          }
        }}
        mapStyle={theme === "light" ? LIGHT_MAP_STYLE : DARK_MAP_STYLE}
        onClick={handleMapClick}
        cursor={pickActive ? "crosshair" : undefined}
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
              if (addMode || pickActive || panelEditing) return;
              setSelectedStoreId(store.id);
            }}
            onDoubleClick={() => {
              if (addMode || pickActive || panelEditing) return;
              router.push(`/stores/${store.id}`);
            }}
          />
        ))}

        {draftCoords && (
          <Marker
            longitude={draftCoords.longitude}
            latitude={draftCoords.latitude}
            anchor="bottom"
            draggable
            onDragEnd={(e) => emitPick({ latitude: e.lngLat.lat, longitude: e.lngLat.lng }, "drag")}
          >
            <DraftPin />
          </Marker>
        )}
      </Map>

      {pickActive && (
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
                  {getProjectStatusLabel(status, t)} (
                  {statusCounts[status] ?? 0})
                </div>
              )
            )}
            {openingSoonCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-red-400">
                <span className="h-2 w-2 rounded-full bg-red-400 animate-pulse" />
                {t("status.yakinda_aciliyor")} ({openingSoonCount})
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
      </div>

      {selectedStore && !addMode && (
        <StoreDetailPanel
          store={selectedStore}
          onClose={() => setSelectedStoreId(null)}
          mapPick={mapPick}
          onPickModeChange={setPickActive}
          onDraftChange={setDraftCoords}
          onEditingChange={setPanelEditing}
        />
      )}

      {addMode && (
        <AddStorePanel
          mapPick={mapPick}
          onPickModeChange={setPickActive}
          onDraftChange={setDraftCoords}
          onClose={exitAddMode}
          onSaved={(id) => {
            setAddMode(false);
            setSelectedStoreId(id);
          }}
        />
      )}

      <RegionFilterPanel />

      <StoreListPanel
        stores={visibleStores}
        selectedStoreId={selectedStoreId}
        onSelect={(id) => {
          // Kaydedilmemiş düzenleme varken başka mağazaya geçilmez
          if (panelEditing) return;
          focusStore(id);
        }}
      />
    </div>
  );
}

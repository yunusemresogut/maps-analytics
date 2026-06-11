"use client";

import { useCallback, useState } from "react";
import Map, { NavigationControl } from "react-map-gl/maplibre";
import type { MapMouseEvent } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { Plus, X } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { useStores } from "@/contexts/stores-context";
import { StoreMarker } from "@/components/map/store-marker";
import { StoreDetailPanel } from "@/components/map/store-detail-panel";
import { AddStorePanel } from "@/components/map/add-store-panel";
import { projectStatusConfig } from "@/lib/project-status";
import { getOpeningStatus } from "@/lib/store-status";
import { Button } from "@/components/ui/button";
import type { ProjectStatus } from "@/types";

const DARK_MAP_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const TURKEY_CENTER = { longitude: 35.2433, latitude: 38.9637, zoom: 5.5 };

export function StoreMap() {
  const { user } = useAuth();
  const { stores, getStore } = useStores();
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const selectedStore = selectedStoreId ? getStore(selectedStoreId) : null;

  const statusCounts = stores.reduce(
    (acc, store) => {
      acc[store.projectStatus]++;
      return acc;
    },
    { tamamlandi: 0, santiye: 0, proje: 0, beklemede: 0 } as Record<
      ProjectStatus,
      number
    >
  );

  const openingSoonCount = stores.filter(
    (s) => getOpeningStatus(s.openingDate) === "opening_soon"
  ).length;

  const handleMapClick = useCallback(
    (e: MapMouseEvent) => {
      if (addMode && user) {
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
    [addMode, user]
  );

  const exitAddMode = () => {
    setAddMode(false);
    setPendingCoords(null);
  };

  return (
    <div className={`relative h-full w-full ${addMode ? "cursor-crosshair" : ""}`}>
      <Map
        initialViewState={TURKEY_CENTER}
        mapStyle={DARK_MAP_STYLE}
        onClick={handleMapClick}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {stores.map((store) => (
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

      <div className="pointer-events-none absolute left-4 top-4 z-10 flex flex-col gap-2">
        <div className="pointer-events-auto rounded-xl border border-zinc-700/60 bg-zinc-950/80 p-4 backdrop-blur-md">
          <h2 className="text-sm font-semibold text-zinc-100">
            LC Waikiki Mağazaları
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            {stores.length} mağaza · Türkiye
          </p>
          <div className="mt-3 space-y-1.5">
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
                  {projectStatusConfig[status].label} ({statusCounts[status]})
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

        <div className="pointer-events-auto">
          {user ? (
            addMode ? (
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
              <Button size="sm" onClick={() => setAddMode(true)} className="w-full">
                <Plus className="h-3.5 w-3.5" />
                Yeni Konum Ekle
              </Button>
            )
          ) : (
            <Link href="/login">
              <Button size="sm" variant="outline" className="w-full">
                <Plus className="h-3.5 w-3.5" />
                Eklemek için Giriş Yap
              </Button>
            </Link>
          )}
        </div>

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
    </div>
  );
}

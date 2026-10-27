"use client";

import { useEffect, useRef } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTheme } from "@/contexts/theme-context";
import type { Coords } from "@/lib/geocode";
import { useT } from "@/contexts/i18n-context";

const LIGHT_MAP_STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const DARK_MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const TURKEY_CENTER = { longitude: 35.2433, latitude: 38.9637, zoom: 5 };

/** Küçük konum seçici: tıkla ya da pini sürükle. Ana harita olmayan sayfalarda kullanılır. */
export function LocationPickerMap({
  coords,
  onPick,
}: {
  coords: Coords | null;
  onPick: (coords: Coords) => void;
}) {
  const { theme } = useTheme();
  const mapRef = useRef<MapRef>(null);
  const key = coords ? `${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}` : "";

  // Pin aramayla başka yere taşınırsa harita da oraya gider
  useEffect(() => {
    if (!coords) return;
    const map = mapRef.current;
    if (!map) return;
    const bounds = map.getBounds();
    if (!bounds.contains([coords.longitude, coords.latitude])) {
      map.flyTo({ center: [coords.longitude, coords.latitude], zoom: Math.max(map.getZoom(), 14), duration: 800 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div className="h-56 overflow-hidden rounded-lg border border-zinc-800">
      <Map
        ref={mapRef}
        initialViewState={coords ? { ...coords, zoom: 15 } : TURKEY_CENTER}
        mapStyle={theme === "light" ? LIGHT_MAP_STYLE : DARK_MAP_STYLE}
        onClick={(e) => onPick({ latitude: e.lngLat.lat, longitude: e.lngLat.lng })}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
        cursor="crosshair"
      >
        <NavigationControl position="top-right" showCompass={false} />
        {coords && (
          <Marker
            longitude={coords.longitude}
            latitude={coords.latitude}
            anchor="bottom"
            draggable
            onDragEnd={(e) => onPick({ latitude: e.lngLat.lat, longitude: e.lngLat.lng })}
          >
            <DraftPin />
          </Marker>
        )}
      </Map>
    </div>
  );
}

/** Seçilmekte olan (henüz kaydedilmemiş) konumun pini */
export function DraftPin() {
  const t = useT();
  return (
    <div className="flex cursor-grab flex-col items-center active:cursor-grabbing" title={t("site.location.dragToMove")}>
      <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-cyan-600 shadow-md">
        <span className="h-2 w-2 rounded-full bg-white" />
      </span>
      <span className="-mt-0.5 h-2.5 w-0.5 bg-cyan-600" />
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import type { Coords, MapPick } from "@/lib/geocode";
import type { StoreLocationController } from "@/hooks/use-store-location";

/**
 * Harita sayfasındaki panel (ekleme/düzenleme) ile ana harita arasındaki köprü:
 * - Seçim modu açıkken haritaya tıklamak pini taşır (adres/il yeniden bulunur)
 * - Taslak pin her zaman sürüklenebilir
 * - Panelin taslak konumu haritada gösterilir; panel kapanınca temizlenir
 */
export function useMapPickBridge({
  mapPick,
  controller,
  pickActive,
  showDraft,
  onPickModeChange,
  onDraftChange,
}: {
  mapPick: MapPick | null;
  controller: StoreLocationController;
  pickActive: boolean;
  showDraft: boolean;
  onPickModeChange: (active: boolean) => void;
  onDraftChange: (coords: Coords | null) => void;
}) {
  // Panel açılmadan önceki seçimler uygulanmasın
  const handled = useRef(mapPick?.nonce ?? 0);
  const { setFromMap } = controller;

  useEffect(() => {
    if (!mapPick || mapPick.nonce === handled.current) return;
    handled.current = mapPick.nonce;
    if (pickActive || mapPick.source === "drag") void setFromMap(mapPick.coords);
  }, [mapPick, pickActive, setFromMap]);

  useEffect(() => {
    onPickModeChange(pickActive);
  }, [pickActive, onPickModeChange]);

  const coords = controller.location.coords;
  const lat = coords?.latitude;
  const lng = coords?.longitude;
  useEffect(() => {
    onDraftChange(showDraft && lat !== undefined && lng !== undefined ? { latitude: lat, longitude: lng } : null);
  }, [showDraft, lat, lng, onDraftChange]);

  useEffect(
    () => () => {
      onPickModeChange(false);
      onDraftChange(null);
    },
    [onPickModeChange, onDraftChange]
  );
}

"use client";

import { Marker } from "react-map-gl/maplibre";
import { projectStatusConfig } from "@/lib/project-status";
import { getOpeningStatus } from "@/lib/store-status";
import type { Store } from "@/types";

type StoreMarkerProps = {
  store: Store;
  isSelected: boolean;
  onClick: () => void;
};

export function StoreMarker({ store, isSelected, onClick }: StoreMarkerProps) {
  const projectConfig = projectStatusConfig[store.projectStatus];
  const openingStatus = getOpeningStatus(store.openingDate);
  const isOpeningSoon = openingStatus === "opening_soon";

  const markerColor = isOpeningSoon ? "#f87171" : projectConfig.marker;

  return (
    <Marker
      longitude={store.longitude}
      latitude={store.latitude}
      anchor="center"
      onClick={(e) => {
        e.originalEvent.stopPropagation();
        onClick();
      }}
    >
      <button
        type="button"
        onClick={onClick}
        className="group relative flex items-center justify-center"
        aria-label={store.name}
      >
        {isOpeningSoon && (
          <span
            className="absolute h-10 w-10 rounded-full opacity-50 animate-pulse"
            style={{ backgroundColor: "#f87171" }}
          />
        )}
        <span
          className="absolute h-8 w-8 rounded-full opacity-30"
          style={{ backgroundColor: markerColor }}
        />
        <span
          className={`relative h-4 w-4 rounded-full border-2 border-white/80 transition-transform group-hover:scale-125 ${
            isSelected ? "scale-150 ring-2 ring-white/50" : ""
          } ${store.isCustom ? "border-dashed" : ""}`}
          style={{
            backgroundColor: markerColor,
            boxShadow: `0 0 ${isSelected ? 16 : 10}px ${markerColor}`,
          }}
        />
      </button>
    </Marker>
  );
}

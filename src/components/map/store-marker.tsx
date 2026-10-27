"use client";

import { Marker } from "react-map-gl/maplibre";
import { getOpeningAlert, shouldHighlightRed } from "@/lib/opening-dates";
import { projectStatusConfig } from "@/lib/project-status";
import type { Store } from "@/types";
import { useT } from "@/contexts/i18n-context";

type StoreMarkerProps = {
  store: Store;
  isSelected: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
};

export function StoreMarker({
  store,
  isSelected,
  onClick,
  onDoubleClick,
}: StoreMarkerProps) {
  const t = useT();
  const projectConfig = projectStatusConfig[store.projectStatus];
  const openingAlert = getOpeningAlert(store.openingDate);
  const isRed = shouldHighlightRed(store.openingDate);

  const markerColor = isRed ? "#cf6660" : projectConfig.marker;

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
        onDoubleClick={(e) => {
          e.stopPropagation();
          onDoubleClick?.();
        }}
        className="group relative flex items-center justify-center"
        aria-label={`${store.name}${openingAlert.isOpeningSoon ? t("site.opening.markerSoon") : ""}`}
        title={openingAlert.label}
      >
        {isRed && (
          <span
            className="absolute h-9 w-9 rounded-full opacity-25 animate-pulse"
            style={{ backgroundColor: markerColor }}
          />
        )}
        <span
          className="absolute h-7 w-7 rounded-full opacity-20"
          style={{ backgroundColor: markerColor }}
        />
        <span
          className={`relative h-4 w-4 rounded-full border-2 border-white transition-transform group-hover:scale-125 ${
            isSelected ? "scale-150 ring-2 ring-zinc-950/40" : ""
          } ${store.isCustom ? "border-dashed" : ""}`}
          style={{
            backgroundColor: markerColor,
            // Işıma yerine sade gölge: zemin üzerinde okunur, göz yormaz
            boxShadow: isSelected
              ? "0 2px 8px rgba(0, 0, 0, 0.35)"
              : "0 1px 3px rgba(0, 0, 0, 0.3)",
          }}
        />
      </button>
    </Marker>
  );
}

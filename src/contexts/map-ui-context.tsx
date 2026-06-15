"use client";

import { createContext, useContext, useState } from "react";

type MapUiContextValue = {
  isStoreListOpen: boolean;
  setStoreListOpen: (open: boolean) => void;
};

const MapUiContext = createContext<MapUiContextValue | null>(null);

export function MapUiProvider({ children }: { children: React.ReactNode }) {
  const [isStoreListOpen, setStoreListOpen] = useState(false);

  return (
    <MapUiContext.Provider value={{ isStoreListOpen, setStoreListOpen }}>
      {children}
    </MapUiContext.Provider>
  );
}

export function useMapUi() {
  const ctx = useContext(MapUiContext);
  if (!ctx) throw new Error("useMapUi must be used within MapUiProvider");
  return ctx;
}

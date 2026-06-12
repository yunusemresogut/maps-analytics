"use client";

import { X } from "lucide-react";
import { useRegions } from "@/contexts/regions-context";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export function RegionFilterPanel() {
  const {
    regions,
    visibleRegions,
    setRegionVisibility,
    showAllRegions,
    hideAllRegions,
    isPanelOpen,
    setPanelOpen,
  } = useRegions();

  if (!isPanelOpen) return null;

  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 z-20 w-full max-w-xs slide-in-from-left">
      <div className="rounded-xl border border-zinc-700/60 bg-zinc-950/95 p-4 shadow-[0_0_40px_rgba(0,0,0,0.5)] backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-200">Bölgeler</span>
          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            className="rounded-lg p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 text-xs"
            onClick={showAllRegions}
          >
            Tümünü Aç
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 text-xs"
            onClick={hideAllRegions}
          >
            Tümünü Kapat
          </Button>
        </div>

        <ul className="scrollbar-themed max-h-64 space-y-2 overflow-y-auto pr-1">
          {regions.map((region) => {
            const visible = visibleRegions[region.id] !== false;
            return (
              <li
                key={region.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: region.color }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-zinc-300">{region.name}</p>
                    <p className="text-xs text-zinc-600">
                      {region.cities.length} şehir
                    </p>
                  </div>
                </div>
                <Switch
                  checked={visible}
                  onChange={(checked) => setRegionVisibility(region.id, checked)}
                  label={visible ? "Açık" : "Kapalı"}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

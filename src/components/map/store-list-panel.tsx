"use client";

import { useMemo, useState } from "react";
import { Search, Store, X } from "lucide-react";
import { useMapUi } from "@/contexts/map-ui-context";
import { getOpeningAlert, shouldHighlightRed } from "@/lib/opening-dates";
import { projectStatusConfig } from "@/lib/project-status";
import { Input } from "@/components/ui/input";
import type { ProjectStatus, Store as StoreType } from "@/types";

type StoreListPanelProps = {
  stores: StoreType[];
  selectedStoreId: string | null;
  onSelect: (storeId: string) => void;
};

type StatusFilter = "all" | "opening_soon" | ProjectStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "opening_soon", label: "Yakında Açılıyor" },
  ...(Object.keys(projectStatusConfig) as ProjectStatus[]).map((status) => ({
    value: status as StatusFilter,
    label: projectStatusConfig[status].label,
  })),
];

function getStoreMarkerColor(store: StoreType): string {
  if (shouldHighlightRed(store.openingDate)) return "#f87171";
  return projectStatusConfig[store.projectStatus].marker;
}

export function StoreListPanel({
  stores,
  selectedStoreId,
  onSelect,
}: StoreListPanelProps) {
  const { isStoreListOpen, setStoreListOpen } = useMapUi();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    let list = stores.filter((store) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "opening_soon") {
        return getOpeningAlert(store.openingDate).isOpeningSoon;
      }
      return store.projectStatus === statusFilter;
    });

    if (q) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q) ||
          s.address.toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      const aSoon = getOpeningAlert(a.openingDate).isOpeningSoon ? 0 : 1;
      const bSoon = getOpeningAlert(b.openingDate).isOpeningSoon ? 0 : 1;
      if (aSoon !== bSoon) return aSoon - bSoon;
      return a.name.localeCompare(b.name, "tr");
    });
  }, [stores, query, statusFilter]);

  if (!isStoreListOpen) return null;

  return (
    <div className="pointer-events-auto absolute bottom-4 right-2 z-20 w-[min(360px,calc(100vw-1rem))] slide-in-from-right sm:right-4">
      <div className="flex max-h-[min(32rem,calc(100vh-8rem))] flex-col overflow-hidden rounded-xl border border-zinc-700/60 bg-zinc-950/95 shadow-[0_0_40px_rgba(0,0,0,0.5)] backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-medium text-zinc-200">Mağazalar</span>
            <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-500">
              {filtered.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setStoreListOpen(false)}
            className="rounded-lg p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 border-b border-zinc-800 px-3 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Mağaza, şehir ara..."
              className="pl-8 text-sm"
            />
          </div>

          <div className="scrollbar-themed flex gap-1 overflow-x-auto pb-0.5">
            {STATUS_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatusFilter(value)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs transition-colors ${
                  statusFilter === value
                    ? value === "opening_soon"
                      ? "bg-red-500/20 text-red-300 ring-1 ring-red-500/30"
                      : "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/25"
                    : "bg-zinc-900 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <ul className="scrollbar-themed flex-1 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <li className="px-3 py-8 text-center text-sm text-zinc-600">
              Mağaza bulunamadı
            </li>
          )}
          {filtered.map((store) => {
            const status = projectStatusConfig[store.projectStatus];
            const openingAlert = getOpeningAlert(store.openingDate);
            const isOpeningSoon = openingAlert.isOpeningSoon;
            const markerColor = getStoreMarkerColor(store);
            const isSelected = selectedStoreId === store.id;

            return (
              <li key={store.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(store.id);
                    setStoreListOpen(false);
                  }}
                  className={`mb-1 w-full rounded-lg border px-3 py-2.5 text-left transition-colors last:mb-0 ${
                    isSelected
                      ? "border-cyan-500/40 bg-cyan-500/10"
                      : isOpeningSoon
                        ? "border-red-500/20 bg-red-500/5 hover:border-red-500/30 hover:bg-red-500/10"
                        : "border-zinc-800/60 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/80"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="relative mt-1.5 shrink-0">
                      {isOpeningSoon && (
                        <span
                          className="absolute -inset-1 rounded-full opacity-40 animate-pulse"
                          style={{ backgroundColor: markerColor }}
                        />
                      )}
                      <span
                        className="relative block h-2 w-2 rounded-full"
                        style={{ backgroundColor: markerColor }}
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-200">
                        {store.name}
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {store.city} · {status.label}
                      </p>
                      {isOpeningSoon && (
                        <p className="mt-0.5 text-xs font-medium text-red-400">
                          {openingAlert.label}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

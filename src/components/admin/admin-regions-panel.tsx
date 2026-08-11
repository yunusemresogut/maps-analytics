"use client";

import { useCallback, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { ALL_TURKEY_CITIES } from "@/data/regions";
import { useRegions } from "@/contexts/regions-context";
import { TablePagination } from "@/components/modules/module-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useTableState } from "@/hooks/use-table-state";
import type { Region } from "@/types";

const REGION_COLORS = [
  "#22d3ee",
  "#a78bfa",
  "#34d399",
  "#fbbf24",
  "#60a5fa",
  "#fb923c",
  "#f472b6",
];

type SortKey = "name" | "cities";

export function AdminRegionsPanel() {
  const {
    regions,
    addRegion,
    deleteRegion,
    addCityToRegion,
    removeCityFromRegion,
  } = useRegions();

  const [newName, setNewName] = useState("");
  const [selectedCity, setSelectedCity] = useState<Record<string, string>>({});

  const getSortValue = useCallback((region: Region, key: SortKey) => {
    if (key === "cities") return region.cities.length;
    return region.name;
  }, []);

  const table = useTableState<Region, SortKey>({
    items: regions,
    initialSort: { key: "name", direction: "asc" },
    getSortValue,
    initialPageSize: 6,
  });

  const handleAddRegion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    addRegion({
      name: newName.trim(),
      cities: [],
      color: REGION_COLORS[regions.length % REGION_COLORS.length],
    });
    setNewName("");
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleAddRegion}
        className="flex gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
      >
        <Input
          placeholder="Yeni bölge adı"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1"
        />
        <Button type="submit">
          <Plus className="h-4 w-4" />
          Bölge Ekle
        </Button>
      </form>

      <div className="flex justify-end">
        <Select
          value={table.sort.key}
          onChange={(e) => {
            const key = e.target.value as SortKey;
            if (table.sort.key !== key) table.toggleSort(key);
          }}
          className="h-9 w-auto min-w-[160px]"
        >
          <option value="name">Ada göre</option>
          <option value="cities">Şehir sayısına göre</option>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {table.pageItems.map((region) => (
          <div
            key={region.id}
            className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: region.color }}
                />
                <h3 className="font-medium text-zinc-200">{region.name}</h3>
                <span className="text-xs text-zinc-600">
                  ({region.cities.length} şehir)
                </span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  if (confirm(`"${region.name}" silinsin mi?`)) {
                    deleteRegion(region.id);
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5 text-red-400/70" />
              </Button>
            </div>

            <div className="mb-3 flex gap-2">
              <Select
                value={selectedCity[region.id] ?? ""}
                onChange={(e) =>
                  setSelectedCity((prev) => ({
                    ...prev,
                    [region.id]: e.target.value,
                  }))
                }
                className="flex-1"
              >
                <option value="">Şehir ekle...</option>
                {ALL_TURKEY_CITIES.filter(
                  (c) => !region.cities.includes(c)
                ).map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                disabled={!selectedCity[region.id]}
                onClick={() => {
                  const city = selectedCity[region.id];
                  if (city) {
                    addCityToRegion(region.id, city);
                    setSelectedCity((prev) => ({ ...prev, [region.id]: "" }));
                  }
                }}
              >
                Ekle
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {region.cities.map((city) => (
                <span
                  key={city}
                  className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300"
                >
                  {city}
                  <button
                    type="button"
                    onClick={() => removeCityFromRegion(region.id, city)}
                    className="text-zinc-500 hover:text-red-400"
                    aria-label={`${city} kaldır`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {region.cities.length === 0 && (
                <span className="text-xs text-zinc-600">Şehir yok</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800">
        <TablePagination
          page={table.page}
          totalPages={table.totalPages}
          totalItems={table.totalItems}
          rangeStart={table.rangeStart}
          rangeEnd={table.rangeEnd}
          onPageChange={table.setPage}
          pageSize={table.pageSize}
          onPageSizeChange={table.setPageSize}
          pageSizeOptions={[6, 12, 24]}
        />
      </div>
    </div>
  );
}

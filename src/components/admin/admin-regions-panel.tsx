"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { ALL_TURKEY_CITIES } from "@/data/regions";
import { useRegions } from "@/contexts/regions-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const REGION_COLORS = [
  "#22d3ee",
  "#a78bfa",
  "#34d399",
  "#fbbf24",
  "#60a5fa",
  "#fb923c",
  "#f472b6",
];

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

      <div className="grid gap-4 md:grid-cols-2">
        {regions.map((region) => (
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

            <ul className="flex flex-wrap gap-1.5">
              {region.cities.length === 0 && (
                <li className="text-xs text-zinc-600">Henüz şehir yok</li>
              )}
              {region.cities.map((city) => (
                <li
                  key={city}
                  className="flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-950/50 px-2 py-0.5 text-xs text-zinc-300"
                >
                  {city}
                  <button
                    type="button"
                    onClick={() => removeCityFromRegion(region.id, city)}
                    className="text-zinc-600 hover:text-red-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

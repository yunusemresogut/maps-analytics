"use client";

import { useEffect, useState } from "react";
import { MapPin, Search, X } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useStores } from "@/contexts/stores-context";
import { useT } from "@/contexts/i18n-context";
import {
  StoreFormFields,
  emptyStoreForm,
  formToStoreData,
  type StoreFormData,
} from "@/components/map/store-form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormError } from "@/components/ui/field-error";
import { cn } from "@/lib/utils";
import {
  hasErrors,
  validateStoreForm,
  type FieldErrors,
} from "@/lib/validation";

type GeocodeResult = {
  id: string;
  label: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
};

type AddStorePanelProps = {
  coords: { latitude: number; longitude: number } | null;
  onCoordsChange: (coords: { latitude: number; longitude: number }) => void;
  onClose: () => void;
  onSaved: (storeId: string) => void;
};

export function AddStorePanel({
  coords,
  onCoordsChange,
  onClose,
  onSaved,
}: AddStorePanelProps) {
  const { user } = useAuth();
  const { addStore } = useStores();
  const t = useT();
  const [mode, setMode] = useState<"map" | "search">(
    coords ? "map" : "search"
  );
  const [form, setForm] = useState<StoreFormData>(emptyStoreForm);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode !== "search" || query.trim().length < 3) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/geocode/search?q=${encodeURIComponent(query.trim())}`
        );
        const data = await res.json();
        setResults(data.results || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query, mode]);

  const applyResult = (item: GeocodeResult) => {
    onCoordsChange({ latitude: item.latitude, longitude: item.longitude });
    setForm((prev) => ({
      ...prev,
      address: item.address,
      city: item.city || prev.city,
    }));
    setResults([]);
    setQuery(item.label);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!user) return;

    if (!coords) {
      setFormError("Önce haritadan konum seçin veya adres arayın");
      return;
    }

    const errors = validateStoreForm(form);
    setFieldErrors(errors);
    if (hasErrors(errors)) return;

    setSaving(true);
    try {
      const store = addStore(formToStoreData(form, coords), {
        userId: user.id,
        userName: user.name,
      });
      onSaved(store.id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute bottom-4 right-4 z-20 w-full max-w-md animate-in slide-in-from-right">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-xl border border-cyan-500/30 bg-zinc-950/95 backdrop-blur-md shadow-[0_0_40px_rgba(34,211,238,0.15)]"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <div>
            <h3 className="font-semibold text-zinc-100">Yeni Konum Ekle</h3>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500">
              <MapPin className="h-3 w-3" />
              {coords
                ? `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`
                : "Konum seçilmedi"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-zinc-800 p-3">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-900 p-1">
            <button
              type="button"
              onClick={() => setMode("map")}
              className={cn(
                "rounded-md px-2 py-1.5 text-xs",
                mode === "map"
                  ? "bg-cyan-500/20 text-cyan-200"
                  : "text-zinc-500"
              )}
            >
              {t("geocode.mapPick")}
            </button>
            <button
              type="button"
              onClick={() => setMode("search")}
              className={cn(
                "rounded-md px-2 py-1.5 text-xs",
                mode === "search"
                  ? "bg-cyan-500/20 text-cyan-200"
                  : "text-zinc-500"
              )}
            >
              {t("geocode.addressSearch")}
            </button>
          </div>

          {mode === "search" && (
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("geocode.searchPlaceholder")}
                className="pl-9"
              />
              {(searching || results.length > 0) && (
                <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-950 shadow-xl">
                  {searching && (
                    <li className="px-3 py-2 text-xs text-zinc-500">
                      {t("geocode.searching")}
                    </li>
                  )}
                  {!searching && results.length === 0 && query.length >= 3 && (
                    <li className="px-3 py-2 text-xs text-zinc-500">
                      {t("geocode.noResults")}
                    </li>
                  )}
                  {results.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => applyResult(item)}
                        className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-900"
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {mode === "map" && !coords && (
            <p className="mt-3 text-xs text-cyan-300/90">
              Haritada bir noktaya tıklayın
            </p>
          )}
        </div>

        <div className="scrollbar-themed flex-1 overflow-y-auto p-4">
          <StoreFormFields
            form={form}
            onChange={setForm}
            errors={fieldErrors}
            onErrorsChange={setFieldErrors}
          />
        </div>

        <div className="space-y-2 border-t border-zinc-800 p-4">
          <FormError message={formError} />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={onClose}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" className="flex-1" loading={saving}>
              {t("common.save")}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useState } from "react";
import { MapPin, X } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useStores } from "@/contexts/stores-context";
import { useT } from "@/contexts/i18n-context";
import { StoreFormFields } from "@/components/map/store-form-fields";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field-error";
import { StoreLocationFields } from "@/components/location/store-location-fields";
import { useStoreForm } from "@/hooks/use-store-form";
import { useMapPickBridge } from "@/hooks/use-map-pick-bridge";
import type { Coords, MapPick } from "@/lib/geocode";
import { cn } from "@/lib/utils";
import {
  MAP_PANEL_HEIGHT_CLASS,
  MAP_PANEL_SHELL_CLASS,
  MAP_PANEL_BOTTOM_CLASS,
} from "@/lib/map-panel-styles";

type AddStorePanelProps = {
  /** Ana haritadan gelen son seçim (tıklama ya da taslak pini sürükleme) */
  mapPick: MapPick | null;
  onPickModeChange: (active: boolean) => void;
  onDraftChange: (coords: Coords | null) => void;
  onClose: () => void;
  onSaved: (storeId: string) => void;
};

export function AddStorePanel({
  mapPick,
  onPickModeChange,
  onDraftChange,
  onClose,
  onSaved,
}: AddStorePanelProps) {
  const { user } = useAuth();
  const { addStore } = useStores();
  const t = useT();
  const { form, setForm, errors, setErrors, location, prepare } = useStoreForm();
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Mağaza eklerken haritaya tıklamak her zaman pini taşır
  useMapPickBridge({
    mapPick,
    controller: location,
    pickActive: true,
    showDraft: true,
    onPickModeChange,
    onDraftChange,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!user) return;

    const prepared = prepare();
    if (!prepared.ok) {
      setFormError(prepared.message);
      return;
    }

    setSaving(true);
    try {
      const store = addStore(prepared.data, {
        userId: user.id,
        userName: user.name,
      });
      onSaved(store.id);
    } finally {
      setSaving(false);
    }
  };

  const { city, district, country } = location.location;

  return (
    <div className={cn(MAP_PANEL_BOTTOM_CLASS, "absolute right-4 z-20 w-full max-w-md animate-in slide-in-from-right")}>
      <form
        onSubmit={handleSubmit}
        className={cn(
          "flex flex-col",
          MAP_PANEL_HEIGHT_CLASS,
          MAP_PANEL_SHELL_CLASS,
          "border-cyan-500/30"
        )}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <div>
            <h3 className="font-semibold text-zinc-100">Yeni Konum Ekle</h3>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500">
              <MapPin className="h-3 w-3" />
              {city
                ? [[district, city].filter(Boolean).join(" / "), country && country !== "Türkiye" ? country : ""]
                    .filter(Boolean)
                    .join(", ")
                : "Konum seçilmedi"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="scrollbar-themed flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            <StoreLocationFields
              controller={location}
              mapPick={{
                active: true,
                hint: "Haritaya tıklayın; pini sürükleyerek ince ayar yapın",
              }}
              errors={{ city: errors.city, address: errors.address }}
            />
            <StoreFormFields
              form={form}
              onChange={setForm}
              errors={errors}
              onErrorsChange={setErrors}
            />
          </div>
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

"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Crosshair, Loader2, Lock, MapPin, RefreshCw } from "lucide-react";
import { AddressSearch } from "@/components/location/address-search";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { StoreLocationController } from "@/hooks/use-store-location";
import { useT } from "@/contexts/i18n-context";

type Props = {
  controller: StoreLocationController;
  /** Ana haritadan seçim (harita sayfası): etkin mi ve aç/kapat */
  mapPick?: { active: boolean; onToggle?: () => void; hint: string };
  /** Harita sayfası dışında gömülü küçük harita */
  mapSlot?: ReactNode;
  errors?: { city?: string; address?: string };
};

/**
 * Mağazanın konum bölümü: pin, il ve adres her zaman birlikte değişir.
 * İl elle yazılamaz; adres detay için düzenlenebilir.
 */
export function StoreLocationFields({ controller, mapPick, mapSlot, errors = {} }: Props) {
  const t = useT();
  const { location, status, addressEdited, mismatchCity, setFromSearch, editAddress, locateAddress, resolveCurrent } =
    controller;
  const resolving = status.kind === "resolving";
  const abroad = !!location.country && location.country !== "Türkiye";
  // Eski kayıtlarda şehir boş ya da konumla uyuşmayan bir metin olabilir
  const cityProblem = !!location.coords && !resolving && (!!mismatchCity || !location.city.trim());

  return (
    <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium text-zinc-200">
          <MapPin className="h-4 w-4 text-cyan-400" />
          {t("site.location.title")}
        </p>
        <span className="text-[11px] tabular-nums text-zinc-500">
          {location.coords
            ? `${location.coords.latitude.toFixed(5)}, ${location.coords.longitude.toFixed(5)}`
            : t("site.location.notSelected")}
        </span>
      </div>

      <AddressSearch onSelect={setFromSearch} placeholder={t("site.location.searchPlaceholder")} />

      {mapPick &&
        (mapPick.onToggle && !mapPick.active ? (
          // Düzenlemede: konumu haritadan değiştirmeyi açan belirgin düğme
          <Button type="button" variant="outline" className="w-full border-cyan-500/40 text-cyan-300 hover:border-cyan-500/70 hover:bg-cyan-500/10 hover:text-cyan-200" onClick={mapPick.onToggle}>
            <Crosshair className="h-4 w-4" />
            {t("site.location.changeFromMap")}
          </Button>
        ) : (
          <div
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm",
              mapPick.active
                ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
                : "border-zinc-800 bg-zinc-900 text-zinc-400"
            )}
            role="status"
          >
            <span className="flex items-center gap-2">
              <Crosshair className="h-4 w-4 shrink-0 text-cyan-400" />
              {mapPick.hint}
            </span>
            {mapPick.onToggle && (
              <Button type="button" size="sm" onClick={mapPick.onToggle}>
                {t("site.location.done")}
              </Button>
            )}
          </div>
        ))}

      {mapSlot}

      {resolving && (
        <p className="flex items-center gap-1.5 text-xs text-zinc-400" role="status">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("site.location.resolving")}
        </p>
      )}
      {status.kind === "error" && (
        <p className="flex items-start gap-1.5 text-xs text-red-400" role="alert">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {status.message}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <FormField
          label={abroad ? t("site.location.city") : t("site.location.province")}
          required
          error={errors.city}
          hint={t("site.location.autoDetected")}
        >
          <div
            className={cn(
              "flex h-10 items-center gap-2 rounded-lg border bg-zinc-900/60 px-3 text-sm",
              cityProblem ? "border-amber-500/50 text-amber-300" : "border-zinc-800 text-zinc-200"
            )}
            aria-live="polite"
          >
            <Lock className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
            <span className="truncate">{location.city || (resolving ? "…" : "—")}</span>
          </div>
        </FormField>
        <FormField label={abroad ? t("site.location.neighbourhood") : t("site.location.district")}>
          <div className="flex h-10 items-center rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 text-sm text-zinc-300">
            <span className="truncate">{location.district || (resolving ? "…" : "—")}</span>
          </div>
        </FormField>
      </div>
      {location.country && (
        <p className="-mt-1 text-xs text-zinc-500">
          {t("site.location.country")} <span className="text-zinc-300">{location.country}</span>
        </p>
      )}

      {cityProblem && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-300">
          <span>
            {mismatchCity
              ? t("site.location.cityMismatch", {
                  city: location.city || t("site.location.empty"),
                  actual: mismatchCity,
                })
              : t("site.location.cityMissing")}
          </span>
          <Button type="button" size="sm" variant="outline" onClick={() => void resolveCurrent()}>
            <RefreshCw className="h-3.5 w-3.5" />
            {t("site.location.fixCity")}
          </Button>
        </div>
      )}

      <FormField
        label={t("site.location.address")}
        required
        error={errors.address}
        hint={t("site.location.addressHint")}
      >
        <Textarea
          value={location.address}
          onChange={(e) => editAddress(e.target.value)}
          placeholder={t("site.location.addressPlaceholder")}
          className="min-h-[60px]"
          aria-invalid={!!errors.address}
        />
      </FormField>

      {addressEdited && location.address.trim().length >= 3 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-zinc-900 px-2.5 py-2 text-xs text-zinc-400">
          <span>{t("site.location.addressEdited")}</span>
          <Button type="button" size="sm" variant="outline" disabled={resolving} onClick={() => void locateAddress()}>
            <MapPin className="h-3.5 w-3.5" />
            {t("site.location.moveToAddress")}
          </Button>
        </div>
      )}
    </div>
  );
}

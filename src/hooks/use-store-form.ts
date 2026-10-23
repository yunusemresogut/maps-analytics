"use client";

import { useState } from "react";
import {
  emptyStoreForm,
  formToStoreData,
  storeToForm,
  type StoreFormData,
} from "@/components/map/store-form-fields";
import { useStoreLocation } from "@/hooks/use-store-location";
import { useLocationTypes } from "@/hooks/use-location-types";
import { canonicalProvince } from "@/data/regions";
import { hasErrors, validateStoreForm, type FieldErrors } from "@/lib/validation";
import type { Store, StoreInput } from "@/types";

/**
 * Mağaza ekleme/düzenleme formu: genel alanlar + konum (pin, il, adres).
 * Kayıt verisi her zaman konumdan üretilir; il ve adres formda serbest değildir.
 */
export function useStoreForm(store?: Store) {
  const { types: locationTypes } = useLocationTypes();
  const [form, setForm] = useState<StoreFormData>(() =>
    store ? storeToForm(store) : emptyStoreForm(locationTypes[0]?.key ?? "")
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const location = useStoreLocation(
    store
      ? {
          coords: { latitude: store.latitude, longitude: store.longitude },
          city: store.city,
          district: store.district ?? "",
          country: store.country ?? "",
          address: store.address,
        }
      : { coords: null, city: "", district: "", country: "", address: "" },
    // Mevcut mağazada kayıtlı şehir pinle bir kez karşılaştırılır
    { verifyInitial: !!store }
  );

  /** Doğrular; geçerliyse kaydedilecek veriyi, değilse kullanıcıya gösterilecek nedeni döner */
  const prepare = (): { ok: true; data: StoreInput } | { ok: false; message: string } => {
    const merged: StoreFormData = {
      ...form,
      // "istanbul" gibi farklı yazımlar resmî il adına çevrilir
      city: canonicalProvince(location.location.city) ?? location.location.city,
      address: location.location.address.trim(),
    };
    const nextErrors = validateStoreForm(merged);
    setErrors(nextErrors);
    if (location.blocker) return { ok: false, message: location.blocker };
    if (hasErrors(nextErrors) || !location.location.coords) {
      return { ok: false, message: "Lütfen zorunlu alanları kontrol edin." };
    }
    return {
      ok: true,
      data: {
        ...formToStoreData(merged, location.location.coords),
        district: location.location.district.trim(),
        country: location.location.country.trim(),
      },
    };
  };

  return { form, setForm, errors, setErrors, location, prepare };
}

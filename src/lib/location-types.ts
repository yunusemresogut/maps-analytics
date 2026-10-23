import type { LocationTypeOption, Organization } from "@/types";

/** Firma listesi tanımlanmamışsa kullanılan varsayılan saha türleri (migration ile aynı) */
export const DEFAULT_LOCATION_TYPES: LocationTypeOption[] = [
  { key: "magaza", label: "Mağaza" },
  { key: "ofis", label: "Ofis" },
  { key: "kafe", label: "Kafe" },
  { key: "konut", label: "Konut" },
  { key: "otel", label: "Otel" },
  { key: "endustriyel", label: "Endüstriyel" },
];

// Eski sabit değerler; migration uygulanmadan önceki kayıtlar okunabilsin
const LEGACY_LABELS: Record<string, string> = { avm: "AVM", cadde: "Cadde", outdoor: "Outdoor" };

/** Veritabanındaki guard_organization_location_types ile aynı biçim */
export const LOCATION_TYPE_KEY_PATTERN = /^[a-z0-9_]{2,40}$/;

export function newLocationTypeKey(): string {
  const random = Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => (byte % 36).toString(36)).join("");
  return `tur_${random}`;
}

/** Ham jsonb listesini doğrular; dizi değilse (sütun yoksa) undefined döner */
export function normalizeLocationTypes(raw: unknown): LocationTypeOption[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.flatMap((item): LocationTypeOption[] => {
    if (!item || typeof item !== "object") return [];
    const type = item as Record<string, unknown>;
    const key = typeof type.key === "string" ? type.key : "";
    const label = typeof type.label === "string" ? type.label.trim() : "";
    if (!LOCATION_TYPE_KEY_PATTERN.test(key) || !label) return [];
    return [{ key, label }];
  });
}

export function organizationLocationTypes(
  org?: Pick<Organization, "locationTypes"> | null
): LocationTypeOption[] {
  return org?.locationTypes ?? DEFAULT_LOCATION_TYPES;
}

export function getLocationTypeLabel(key: string, types: LocationTypeOption[]): string {
  return types.find((type) => type.key === key)?.label ?? LEGACY_LABELS[key] ?? key;
}

/** Anahtar ya da ad ile eşleştirir (asistan "Ofis" de yazabilir) */
export function matchLocationType(value: string, types: LocationTypeOption[]): LocationTypeOption | undefined {
  const needle = value.trim().toLocaleLowerCase("tr-TR");
  if (!needle) return undefined;
  return types.find((type) => type.key === needle || type.label.toLocaleLowerCase("tr-TR") === needle);
}

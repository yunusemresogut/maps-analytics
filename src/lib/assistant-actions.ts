import { canModule } from "@/lib/permissions";
import { canonicalProvince } from "@/data/regions";
import type {
  LocationTypeOption,
  ProjectStatus,
  Store,
  StoreInput,
  TicketPriority,
  User,
  WorkPlanStatus,
} from "@/types";
import type { ParsedMaterialRow } from "@/lib/excel-materials";
import type { ParsedWorkPlanRow } from "@/lib/excel-work-plan";
import { materialLineTotal } from "@/lib/material-totals";
import { formatMoney, formatMoneyTotals, parseCurrency, sumMoney, type CurrencyCode } from "@/lib/currency";
import { matchLocationType } from "@/lib/location-types";

/**
 * Asistanın önerdiği kayıt ekleme eylemleri.
 * Model cevabın sonuna ```action bloğu koyar; istemci bloğu ayrıştırır,
 * doğrular, önizler ve yalnızca kullanıcı onaylarsa mevcut context
 * fonksiyonlarıyla (log, RLS, bildirim dahil) uygular.
 */

const MAX_ITEMS = 100;

const PROJECT_STATUSES: ProjectStatus[] = [
  "proje",
  "ihale",
  "santiye",
  "acilis",
  "hakedis",
  "fatura",
  "yakinda_aciliyor",
];
const PRIORITIES: TicketPriority[] = ["low", "medium", "high"];
const WORK_PLAN_STATUSES: WorkPlanStatus[] = ["yapilacak", "devam_ediyor", "tamamlandi"];

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  proje: "Proje",
  ihale: "İhale",
  santiye: "Şantiye",
  acilis: "Açılış",
  hakedis: "Hakediş",
  fatura: "Fatura",
  yakinda_aciliyor: "Yakında Açılıyor",
};
const PRIORITY_LABELS: Record<TicketPriority, string> = { low: "Düşük", medium: "Orta", high: "Yüksek" };
const WORK_PLAN_STATUS_LABELS: Record<WorkPlanStatus, string> = {
  yapilacak: "Yapılacak",
  devam_ediyor: "Devam ediyor",
  tamamlandi: "Tamamlandı",
};

/** Uygulamaya hazır, doğrulanmış eylem */
export type ResolvedAction =
  | { type: "create_store"; store: StoreInput }
  | {
      type: "create_ticket";
      ticket: { title: string; description: string; priority: TicketPriority; storeId?: string };
    }
  | { type: "add_work_plan"; storeId: string; rows: ParsedWorkPlanRow[] }
  | { type: "add_materials"; storeId: string; rows: ParsedMaterialRow[] };

export type ActionPreview = {
  title: string;
  fields: { label: string; value: string }[];
  table?: { columns: string[]; rows: string[][] };
  warnings: string[];
  errors: string[];
  /** Hata yoksa uygulanacak eylem */
  resolved?: ResolvedAction;
};

type GeocodeHit = {
  address: string;
  city: string;
  district: string;
  country: string;
  latitude: number;
  longitude: number;
};

type BuildContext = {
  user: Pick<User, "role" | "permissions"> | null;
  stores: Store[];
  geocode: (query: string) => Promise<GeocodeHit | null>;
  /** Firma ayarlarında kapatılan modüllere kayıt eklenmez */
  isModuleEnabled: (module: string) => boolean;
  /** Para birimi belirtilmeyen tutarlar için firmanın varsayılanı */
  defaultCurrency: CurrencyCode;
  /** Firmanın saha türleri */
  locationTypes: LocationTypeOption[];
};

const ACTION_BLOCK = /```action\s*([\s\S]*?)```/;

/** Görüntülenecek metin: action bloğu (akış sırasında yarım hali de) gizlenir */
export function stripActionBlock(text: string): string {
  const start = text.indexOf("```action");
  return (start === -1 ? text : text.slice(0, start)).trimEnd();
}

/** Cevaptaki action bloğunun ham eylemleri; blok yoksa null, bozuksa [] */
export function extractActions(text: string): Record<string, unknown>[] | null {
  const match = text.match(ACTION_BLOCK);
  if (!match) return null;
  try {
    const parsed: unknown = JSON.parse(match[1].trim());
    const list = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { actions?: unknown }).actions)
        ? (parsed as { actions: unknown[] }).actions
        : [parsed];
    return list.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
  } catch {
    return [];
  }
}

function normalizeName(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/['’`".,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function pick<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  const text = str(value) as T;
  return allowed.includes(text) ? text : fallback;
}

export function formatDate(value: string): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

/** Mağaza adını firma mağazalarıyla eşleştirir: önce tam, sonra kısmi eşleşme */
function resolveStore(stores: Store[], rawName: unknown): { store?: Store; error?: string } {
  const name = str(rawName);
  if (!name) return { error: "Saha belirtilmemiş." };
  const target = normalizeName(name);
  const exact = stores.filter((store) => normalizeName(store.name) === target);
  if (exact.length === 1) return { store: exact[0] };
  const partial = exact.length > 1
    ? exact
    : stores.filter((store) => {
        const candidate = normalizeName(store.name);
        return candidate.includes(target) || target.includes(candidate);
      });
  if (partial.length === 1) return { store: partial[0] };
  if (partial.length > 1) {
    return {
      error: `"${name}" birden fazla sahayla eşleşiyor: ${partial
        .slice(0, 5)
        .map((store) => `${store.name} (${store.city})`)
        .join(", ")}. Hangisi olduğunu belirtin.`,
    };
  }
  return { error: `"${name}" adında bir saha bulunamadı.` };
}

function itemsOf(raw: Record<string, unknown>, errors: string[]): Record<string, unknown>[] {
  const items = Array.isArray(raw.items) ? raw.items : [];
  const valid = items.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
  if (valid.length === 0) errors.push("Eklenecek kalem yok.");
  if (valid.length > MAX_ITEMS) errors.push(`Tek seferde en fazla ${MAX_ITEMS} kalem eklenebilir.`);
  return valid.slice(0, MAX_ITEMS);
}

async function buildStore(raw: Record<string, unknown>, ctx: BuildContext): Promise<ActionPreview> {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!canModule(ctx.user, "map", "add") && !canModule(ctx.user, "stores", "add")) {
    errors.push("Saha ekleme yetkiniz yok.");
  }

  const name = str(raw.name);
  const rawCity = str(raw.city);
  // Türkiye ili yazıldıysa adres o ilde bulunmalı; yurt dışı ya da ilçe adı da
  // yazılabilir, kaydedilen şehir/ilçe/ülke her zaman bulunan konumdan gelir
  const expectedProvince = canonicalProvince(rawCity);
  const address = str(raw.address);
  const openingDate = str(raw.openingDate);
  const acceptanceDate = str(raw.acceptanceDate);
  const projectStatus = pick(raw.projectStatus, PROJECT_STATUSES, "proje");
  const locationType =
    matchLocationType(str(raw.locationType), ctx.locationTypes) ?? ctx.locationTypes[0] ?? { key: "", label: "—" };
  if (str(raw.locationType) && !matchLocationType(str(raw.locationType), ctx.locationTypes)) {
    warnings.push(`"${str(raw.locationType)}" saha türü tanınmadı; ${locationType.label} olarak kaydedilecek.`);
  }
  const grossM2 = num(raw.grossM2) ?? 0;
  const floorCount = Math.max(1, Math.round(num(raw.floorCount) ?? 1));
  const totalBudget = num(raw.totalBudget);
  const budgetCurrency = parseCurrency(raw.budgetCurrency) ?? ctx.defaultCurrency;
  if (str(raw.budgetCurrency) && !parseCurrency(raw.budgetCurrency)) {
    warnings.push(`"${str(raw.budgetCurrency)}" para birimi tanınmadı; bütçe ${ctx.defaultCurrency} olarak kaydedilecek.`);
  }

  if (!name) errors.push("Saha adı eksik.");
  if (!rawCity) errors.push("Şehir eksik.");
  if (address.length < 5) errors.push("Adres eksik ya da çok kısa.");
  if (!isIsoDate(openingDate)) errors.push("Açılış tarihi eksik ya da geçersiz.");
  if (acceptanceDate && !isIsoDate(acceptanceDate)) warnings.push("Kabul tarihi geçersiz olduğu için eklenmeyecek.");
  if (grossM2 < 0) errors.push("Brüt m² negatif olamaz.");
  if (name && ctx.stores.some((store) => normalizeName(store.name) === normalizeName(name))) {
    warnings.push(`"${name}" adında bir saha zaten var; yine de yeni kayıt oluşturulacak.`);
  }

  // Adres başka bir ilde bulunduysa pin ile yazılan il çelişir
  const fits = (hit: GeocodeHit | null) =>
    hit && hit.city && (!expectedProvince || hit.city === expectedProvince) ? hit : null;
  let location: GeocodeHit | null = null;
  if (rawCity && address.length >= 5) {
    location = fits(await ctx.geocode(`${address}, ${expectedProvince ?? rawCity}`));
    if (!location) {
      location = fits(await ctx.geocode(expectedProvince ? `${expectedProvince}, Türkiye` : rawCity));
      if (location) {
        warnings.push("Adres haritada bulunamadı; konum şehir merkezine yerleştirilecek, sonradan düzeltebilirsiniz.");
      } else {
        errors.push(`"${address}, ${rawCity}" için harita konumu bulunamadı.`);
      }
    }
  }
  const city = location?.city ?? expectedProvince ?? rawCity;

  const fields = [
    { label: "Ad", value: name || "—" },
    {
      label: "Konum",
      value:
        [[location?.district, city].filter(Boolean).join(" / "), location && location.country !== "Türkiye" ? location.country : ""]
          .filter(Boolean)
          .join(", ") || "—",
    },
    { label: "Adres", value: address || "—" },
    { label: "Durum", value: PROJECT_STATUS_LABELS[projectStatus] },
    { label: "Açılış", value: openingDate ? formatDate(openingDate) : "—" },
    { label: "Saha türü", value: locationType.label },
    { label: "Brüt m²", value: String(grossM2) },
    { label: "Kat", value: String(floorCount) },
    ...(totalBudget ? [{ label: "Bütçe", value: formatMoney(totalBudget, budgetCurrency) }] : []),
    ...(str(raw.contractorCompany) ? [{ label: "Yüklenici", value: str(raw.contractorCompany) }] : []),
    ...(str(raw.siteManager) ? [{ label: "Şantiye şefi", value: str(raw.siteManager) }] : []),
    ...(str(raw.phone) ? [{ label: "Telefon", value: str(raw.phone) }] : []),
  ];

  return {
    title: "Yeni saha",
    fields,
    warnings,
    errors,
    resolved:
      errors.length === 0 && location
        ? {
            type: "create_store",
            store: {
              name,
              city: location.city,
              district: location.district || undefined,
              country: location.country || undefined,
              address,
              latitude: location.latitude,
              longitude: location.longitude,
              projectStatus,
              openingDate,
              acceptanceDate: acceptanceDate && isIsoDate(acceptanceDate) ? acceptanceDate : undefined,
              contractorCompany: str(raw.contractorCompany) || undefined,
              siteManager: str(raw.siteManager) || undefined,
              locationType: locationType.key,
              grossM2,
              floorCount,
              phone: str(raw.phone) || undefined,
              ...(totalBudget && totalBudget > 0 ? { totalBudget, budgetCurrency } : {}),
            },
          }
        : undefined,
  };
}

function buildTicket(raw: Record<string, unknown>, ctx: BuildContext): ActionPreview {
  const errors: string[] = [];
  if (!ctx.isModuleEnabled("tickets")) errors.push("Tadilat talepleri modülü firma ayarlarından kapatılmış.");
  else if (!canModule(ctx.user, "tickets", "add")) errors.push("Ticket oluşturma yetkiniz yok.");
  const title = str(raw.title);
  const description = str(raw.description);
  const priority = pick(raw.priority, PRIORITIES, "medium");
  if (!title) errors.push("Başlık eksik.");

  let store: Store | undefined;
  if (str(raw.storeName)) {
    const result = resolveStore(ctx.stores, raw.storeName);
    if (result.error) errors.push(result.error);
    store = result.store;
  }

  return {
    title: "Yeni ticket",
    fields: [
      { label: "Başlık", value: title || "—" },
      { label: "Saha", value: store ? `${store.name} (${store.city})` : str(raw.storeName) || "—" },
      { label: "Öncelik", value: PRIORITY_LABELS[priority] },
      { label: "Açıklama", value: description || "—" },
    ],
    warnings: [],
    errors,
    resolved:
      errors.length === 0
        ? { type: "create_ticket", ticket: { title, description, priority, storeId: store?.id } }
        : undefined,
  };
}

function buildWorkPlan(raw: Record<string, unknown>, ctx: BuildContext): ActionPreview {
  const errors: string[] = [];
  if (!canModule(ctx.user, "stores", "edit") && !canModule(ctx.user, "map", "edit")) {
    errors.push("İş planı ekleme yetkiniz yok.");
  }
  const { store, error } = resolveStore(ctx.stores, raw.storeName);
  if (error) errors.push(error);

  const rows: ParsedWorkPlanRow[] = itemsOf(raw, errors).map((item, index) => {
    const label = `${index + 1}. kalem`;
    const description = str(item.description);
    const startDate = str(item.startDate);
    const endDate = str(item.endDate);
    const status = pick(item.status, WORK_PLAN_STATUSES, "yapilacak");
    const percent = num(item.percentComplete);
    if (!description) errors.push(`${label}: iş tanımı eksik.`);
    if (!isIsoDate(startDate)) errors.push(`${label}: başlangıç tarihi eksik ya da geçersiz.`);
    if (endDate && !isIsoDate(endDate)) errors.push(`${label}: bitiş tarihi geçersiz.`);
    if (isIsoDate(startDate) && isIsoDate(endDate) && endDate < startDate) {
      errors.push(`${label}: bitiş tarihi başlangıçtan önce olamaz.`);
    }
    return {
      description,
      startDate,
      endDate,
      responsible: str(item.responsible),
      status,
      percentComplete:
        percent === null
          ? undefined
          : Math.min(100, Math.max(0, Math.round(percent))),
    };
  });

  return {
    title: `İş planına ${rows.length} kalem`,
    fields: [{ label: "Saha", value: store ? `${store.name} (${store.city})` : str(raw.storeName) || "—" }],
    table: {
      columns: ["İş", "Başlangıç", "Bitiş", "Sorumlu", "Durum"],
      rows: rows.map((row) => [
        row.description || "—",
        formatDate(row.startDate),
        formatDate(row.endDate),
        row.responsible || "—",
        `${WORK_PLAN_STATUS_LABELS[row.status as WorkPlanStatus]}${row.percentComplete !== undefined ? ` · %${row.percentComplete}` : ""}`,
      ]),
    },
    warnings: [],
    errors,
    resolved: errors.length === 0 && store ? { type: "add_work_plan", storeId: store.id, rows } : undefined,
  };
}

function buildMaterials(raw: Record<string, unknown>, ctx: BuildContext): ActionPreview {
  const errors: string[] = [];
  if (!canModule(ctx.user, "stores", "edit") && !canModule(ctx.user, "map", "edit")) {
    errors.push("Keşif ekleme yetkiniz yok.");
  }
  const { store, error } = resolveStore(ctx.stores, raw.storeName);
  if (error) errors.push(error);

  // Birim belirtilmezse keşfin karşılaştırıldığı bütçenin birimi
  const defaultCurrency = store?.budgetCurrency ?? ctx.defaultCurrency;
  const rows: (ParsedMaterialRow & { currency: CurrencyCode })[] = itemsOf(raw, errors).map((item, index) => {
    const label = `${index + 1}. kalem`;
    const name = str(item.name);
    const quantity = num(item.quantity);
    const unitPrice = num(item.unitPrice) ?? 0;
    const currency = parseCurrency(item.currency);
    if (!name) errors.push(`${label}: malzeme adı eksik.`);
    if (quantity === null || quantity <= 0) errors.push(`${label}: miktar eksik ya da geçersiz.`);
    if (unitPrice < 0) errors.push(`${label}: birim fiyat negatif olamaz.`);
    if (str(item.currency) && !currency) errors.push(`${label}: "${str(item.currency)}" para birimi tanınmadı.`);
    return {
      pozNo: str(item.pozNo),
      name,
      quantity: quantity ?? 0,
      unit: str(item.unit) || "adet",
      unitPrice,
      currency: currency ?? defaultCurrency,
    };
  });
  const totals = sumMoney(rows, (row) => row.currency, materialLineTotal);

  return {
    title: `Keşfe ${rows.length} kalem`,
    fields: [
      { label: "Saha", value: store ? `${store.name} (${store.city})` : str(raw.storeName) || "—" },
      { label: "Toplam", value: formatMoneyTotals(totals, defaultCurrency) },
    ],
    table: {
      columns: ["Poz no", "Malzeme", "Miktar", "Birim fiyat", "Tutar"],
      rows: rows.map((row) => [
        row.pozNo || "—",
        row.name || "—",
        `${row.quantity.toLocaleString("tr-TR")} ${row.unit}`,
        formatMoney(row.unitPrice, row.currency),
        formatMoney(materialLineTotal(row), row.currency),
      ]),
    },
    warnings: rows.some((row) => row.unitPrice === 0) ? ["Birim fiyatı belirtilmeyen kalemler 0 tutarla eklenecek."] : [],
    errors,
    resolved: errors.length === 0 && store ? { type: "add_materials", storeId: store.id, rows } : undefined,
  };
}

/** Ham eylemleri doğrular, mağaza adlarını çözer ve önizlemeleri üretir */
export async function buildActionPreviews(
  rawActions: Record<string, unknown>[],
  ctx: BuildContext
): Promise<ActionPreview[]> {
  if (rawActions.length === 0) {
    return [{ title: "Eylem okunamadı", fields: [], warnings: [], errors: ["Asistanın önerisi anlaşılamadı. İsteği tekrar yazmayı deneyin."] }];
  }
  return Promise.all(
    rawActions.slice(0, 5).map((raw) => {
      switch (raw.type) {
        case "create_store":
          return buildStore(raw, ctx);
        case "create_ticket":
          return buildTicket(raw, ctx);
        case "add_work_plan":
          return buildWorkPlan(raw, ctx);
        case "add_materials":
          return buildMaterials(raw, ctx);
        default:
          return {
            title: "Desteklenmeyen işlem",
            fields: [],
            warnings: [],
            errors: [`"${str(raw.type) || "?"}" işlemi asistan üzerinden yapılamıyor.`],
          };
      }
    })
  );
}

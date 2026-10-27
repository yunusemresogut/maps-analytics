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
import { getIntlLocale, localizedRecord, t } from "@/i18n/runtime";

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

const PROJECT_STATUS_LABELS = localizedRecord<ProjectStatus>({
  proje: "status.proje",
  ihale: "status.ihale",
  santiye: "status.santiye",
  acilis: "status.acilis",
  hakedis: "status.hakedis",
  fatura: "status.fatura",
  yakinda_aciliyor: "status.yakinda_aciliyor",
});
const PRIORITY_LABELS = localizedRecord<TicketPriority>({
  low: "assistant.priority.low",
  medium: "assistant.priority.medium",
  high: "assistant.priority.high",
});
const WORK_PLAN_STATUS_LABELS = localizedRecord<WorkPlanStatus>({
  yapilacak: "assistant.workPlanStatus.yapilacak",
  devam_ediyor: "assistant.workPlanStatus.devam_ediyor",
  tamamlandi: "assistant.workPlanStatus.tamamlandi",
});

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
  if (!name) return { error: t("assistant.actions.storeNotSpecified") };
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
      error: t("assistant.actions.storeAmbiguous", {
        name,
        matches: partial
          .slice(0, 5)
          .map((store) => `${store.name} (${store.city})`)
          .join(", "),
      }),
    };
  }
  return { error: t("assistant.actions.storeNotFound", { name }) };
}

function itemsOf(raw: Record<string, unknown>, errors: string[]): Record<string, unknown>[] {
  const items = Array.isArray(raw.items) ? raw.items : [];
  const valid = items.filter((item): item is Record<string, unknown> => !!item && typeof item === "object");
  if (valid.length === 0) errors.push(t("assistant.actions.noItems"));
  if (valid.length > MAX_ITEMS) errors.push(t("assistant.actions.tooManyItems", { max: MAX_ITEMS }));
  return valid.slice(0, MAX_ITEMS);
}

async function buildStore(raw: Record<string, unknown>, ctx: BuildContext): Promise<ActionPreview> {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!canModule(ctx.user, "map", "add") && !canModule(ctx.user, "stores", "add")) {
    errors.push(t("assistant.actions.store.noPermission"));
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
    warnings.push(
      t("assistant.actions.store.unknownLocationType", { value: str(raw.locationType), fallback: locationType.label })
    );
  }
  const grossM2 = num(raw.grossM2) ?? 0;
  const floorCount = Math.max(1, Math.round(num(raw.floorCount) ?? 1));
  const totalBudget = num(raw.totalBudget);
  const budgetCurrency = parseCurrency(raw.budgetCurrency) ?? ctx.defaultCurrency;
  if (str(raw.budgetCurrency) && !parseCurrency(raw.budgetCurrency)) {
    warnings.push(
      t("assistant.actions.store.unknownCurrency", { value: str(raw.budgetCurrency), fallback: ctx.defaultCurrency })
    );
  }

  if (!name) errors.push(t("assistant.actions.store.nameMissing"));
  if (!rawCity) errors.push(t("assistant.actions.store.cityMissing"));
  if (address.length < 5) errors.push(t("assistant.actions.store.addressMissing"));
  if (!isIsoDate(openingDate)) errors.push(t("assistant.actions.store.openingDateInvalid"));
  if (acceptanceDate && !isIsoDate(acceptanceDate)) warnings.push(t("assistant.actions.store.acceptanceDateInvalid"));
  if (grossM2 < 0) errors.push(t("assistant.actions.store.negativeArea"));
  if (name && ctx.stores.some((store) => normalizeName(store.name) === normalizeName(name))) {
    warnings.push(t("assistant.actions.store.duplicateName", { name }));
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
        warnings.push(t("assistant.actions.store.cityCenterFallback"));
      } else {
        errors.push(t("assistant.actions.store.locationNotFound", { address: `${address}, ${rawCity}` }));
      }
    }
  }
  const city = location?.city ?? expectedProvince ?? rawCity;

  const fields = [
    { label: t("assistant.actions.store.fieldName"), value: name || "—" },
    {
      label: t("assistant.actions.store.fieldLocation"),
      value:
        [[location?.district, city].filter(Boolean).join(" / "), location && location.country !== "Türkiye" ? location.country : ""]
          .filter(Boolean)
          .join(", ") || "—",
    },
    { label: t("assistant.actions.store.fieldAddress"), value: address || "—" },
    { label: t("assistant.actions.store.fieldStatus"), value: PROJECT_STATUS_LABELS[projectStatus] },
    { label: t("assistant.actions.store.fieldOpening"), value: openingDate ? formatDate(openingDate) : "—" },
    { label: t("assistant.actions.store.fieldLocationType"), value: locationType.label },
    { label: t("assistant.actions.store.fieldGrossArea"), value: String(grossM2) },
    { label: t("assistant.actions.store.fieldFloors"), value: String(floorCount) },
    ...(totalBudget ? [{ label: t("assistant.actions.store.fieldBudget"), value: formatMoney(totalBudget, budgetCurrency) }] : []),
    ...(str(raw.contractorCompany) ? [{ label: t("assistant.actions.store.fieldContractor"), value: str(raw.contractorCompany) }] : []),
    ...(str(raw.siteManager) ? [{ label: t("assistant.actions.store.fieldSiteManager"), value: str(raw.siteManager) }] : []),
    ...(str(raw.phone) ? [{ label: t("assistant.actions.store.fieldPhone"), value: str(raw.phone) }] : []),
  ];

  return {
    title: t("assistant.actions.store.title"),
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
  if (!ctx.isModuleEnabled("tickets")) errors.push(t("assistant.actions.ticket.moduleDisabled"));
  else if (!canModule(ctx.user, "tickets", "add")) errors.push(t("assistant.actions.ticket.noPermission"));
  const title = str(raw.title);
  const description = str(raw.description);
  const priority = pick(raw.priority, PRIORITIES, "medium");
  if (!title) errors.push(t("assistant.actions.ticket.titleMissing"));

  let store: Store | undefined;
  if (str(raw.storeName)) {
    const result = resolveStore(ctx.stores, raw.storeName);
    if (result.error) errors.push(result.error);
    store = result.store;
  }

  return {
    title: t("assistant.actions.ticket.title"),
    fields: [
      { label: t("assistant.actions.ticket.fieldTitle"), value: title || "—" },
      { label: t("assistant.actions.ticket.fieldStore"), value: store ? `${store.name} (${store.city})` : str(raw.storeName) || "—" },
      { label: t("assistant.actions.ticket.fieldPriority"), value: PRIORITY_LABELS[priority] },
      { label: t("assistant.actions.ticket.fieldDescription"), value: description || "—" },
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
    errors.push(t("assistant.actions.workPlan.noPermission"));
  }
  const { store, error } = resolveStore(ctx.stores, raw.storeName);
  if (error) errors.push(error);

  const rows: ParsedWorkPlanRow[] = itemsOf(raw, errors).map((item, index) => {
    const label = t("assistant.actions.itemLabel", { index: index + 1 });
    const description = str(item.description);
    const startDate = str(item.startDate);
    const endDate = str(item.endDate);
    const status = pick(item.status, WORK_PLAN_STATUSES, "yapilacak");
    const percent = num(item.percentComplete);
    if (!description) errors.push(t("assistant.actions.workPlan.descriptionMissing", { label }));
    if (!isIsoDate(startDate)) errors.push(t("assistant.actions.workPlan.startDateInvalid", { label }));
    if (endDate && !isIsoDate(endDate)) errors.push(t("assistant.actions.workPlan.endDateInvalid", { label }));
    if (isIsoDate(startDate) && isIsoDate(endDate) && endDate < startDate) {
      errors.push(t("assistant.actions.workPlan.endBeforeStart", { label }));
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
    title: t(rows.length === 1 ? "assistant.actions.workPlan.titleOne" : "assistant.actions.workPlan.titleOther", {
      count: rows.length,
    }),
    fields: [{ label: t("assistant.actions.workPlan.fieldStore"), value: store ? `${store.name} (${store.city})` : str(raw.storeName) || "—" }],
    table: {
      columns: [
        t("assistant.actions.workPlan.columnTask"),
        t("assistant.actions.workPlan.columnStart"),
        t("assistant.actions.workPlan.columnEnd"),
        t("assistant.actions.workPlan.columnResponsible"),
        t("assistant.actions.workPlan.columnStatus"),
      ],
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
    errors.push(t("assistant.actions.materials.noPermission"));
  }
  const { store, error } = resolveStore(ctx.stores, raw.storeName);
  if (error) errors.push(error);

  // Birim belirtilmezse keşfin karşılaştırıldığı bütçenin birimi
  const defaultCurrency = store?.budgetCurrency ?? ctx.defaultCurrency;
  const rows: (ParsedMaterialRow & { currency: CurrencyCode })[] = itemsOf(raw, errors).map((item, index) => {
    const label = t("assistant.actions.itemLabel", { index: index + 1 });
    const name = str(item.name);
    const quantity = num(item.quantity);
    const unitPrice = num(item.unitPrice) ?? 0;
    const currency = parseCurrency(item.currency);
    if (!name) errors.push(t("assistant.actions.materials.nameMissing", { label }));
    if (quantity === null || quantity <= 0) errors.push(t("assistant.actions.materials.quantityInvalid", { label }));
    if (unitPrice < 0) errors.push(t("assistant.actions.materials.negativeUnitPrice", { label }));
    if (str(item.currency) && !currency) errors.push(t("assistant.actions.materials.unknownCurrency", { label, value: str(item.currency) }));
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
    title: t(rows.length === 1 ? "assistant.actions.materials.titleOne" : "assistant.actions.materials.titleOther", {
      count: rows.length,
    }),
    fields: [
      { label: t("assistant.actions.materials.fieldStore"), value: store ? `${store.name} (${store.city})` : str(raw.storeName) || "—" },
      { label: t("assistant.actions.materials.fieldTotal"), value: formatMoneyTotals(totals, defaultCurrency) },
    ],
    table: {
      columns: [
        t("assistant.actions.materials.columnItemCode"),
        t("assistant.actions.materials.columnMaterial"),
        t("assistant.actions.materials.columnQuantity"),
        t("assistant.actions.materials.columnUnitPrice"),
        t("assistant.actions.materials.columnAmount"),
      ],
      rows: rows.map((row) => [
        row.pozNo || "—",
        row.name || "—",
        `${row.quantity.toLocaleString(getIntlLocale())} ${row.unit}`,
        formatMoney(row.unitPrice, row.currency),
        formatMoney(materialLineTotal(row), row.currency),
      ]),
    },
    warnings: rows.some((row) => row.unitPrice === 0) ? [t("assistant.actions.materials.zeroPriceWarning")] : [],
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
    return [
      {
        title: t("assistant.actions.unreadableTitle"),
        fields: [],
        warnings: [],
        errors: [t("assistant.actions.unreadableError")],
      },
    ];
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
            title: t("assistant.actions.unsupportedTitle"),
            fields: [],
            warnings: [],
            errors: [t("assistant.actions.unsupportedError", { type: str(raw.type) || "?" })],
          };
      }
    })
  );
}

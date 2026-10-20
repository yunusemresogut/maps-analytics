import { VAT_RATE_OPTIONS } from "@/lib/module-finance";
import { DEFAULT_CURRENCY, normalizeCurrency, roundMoney, type CurrencyCode } from "@/lib/currency";
import type { NotificationType } from "@/types";

/**
 * Firma ayarları (organizations.settings, yalnızca admin yazar) ve kullanıcı
 * tercihleri (user_preferences.preferences). Veritabanındaki JSON eksik ya da
 * eski olabilir; her okuma normalize* fonksiyonlarından geçer.
 */

export type NotificationModule = "stores" | "contracts" | "tickets" | "progressPayments" | "invoices" | "team";

/** Firma genelinde kapatılabilen modüller; harita ve mağazalar çekirdektir */
export type ToggleableModule = "tickets" | "contracts" | "progressPayments" | "invoices" | "team";

export const TOGGLEABLE_MODULES: { key: ToggleableModule; label: string; description: string }[] = [
  { key: "tickets", label: "Tadilat Talepleri", description: "Ticket oluşturma ve takibi" },
  { key: "contracts", label: "Sözleşmeler", description: "Sözleşmeler ve ekleri" },
  { key: "progressPayments", label: "Hakedişler", description: "Hakediş kayıtları ve ekleri" },
  { key: "invoices", label: "Faturalar", description: "Fatura kayıtları" },
  { key: "team", label: "Ekip", description: "Firma içi mesajlaşma" },
];

export const NOTIFICATION_MODULES: { key: NotificationModule; label: string }[] = [
  { key: "stores", label: "Mağaza ve açılışlar" },
  { key: "contracts", label: "Sözleşmeler" },
  { key: "tickets", label: "Tadilat talepleri" },
  { key: "progressPayments", label: "Hakedişler" },
  { key: "invoices", label: "Faturalar" },
  { key: "team", label: "Ekip mesajları" },
];

export const NOTIFICATION_TYPES: {
  type: NotificationType;
  module: NotificationModule;
  label: string;
  description: string;
}[] = [
  { type: "opening_soon", module: "stores", label: "Yaklaşan açılış", description: "Açılışına belirlenen gün sayısı kalan mağazalar" },
  { type: "opening_overdue", module: "stores", label: "Geciken açılış", description: "Açılış tarihi geçtiği hâlde açılmamış mağazalar" },
  { type: "ihale_contract_reminder", module: "contracts", label: "Sözleşme gerekli", description: "İhale aşamasında sözleşmesi olmayan mağazalar" },
  { type: "contract_expiring", module: "contracts", label: "Bitmek üzere olan sözleşme", description: "Bitiş tarihi yaklaşan aktif sözleşmeler" },
  { type: "ticket_assigned", module: "tickets", label: "Bana atanan talepler", description: "Size atanmış, açık ya da devam eden talepler" },
  { type: "ticket_high_priority", module: "tickets", label: "Yüksek öncelikli talepler", description: "Açık durumdaki yüksek öncelikli talepler" },
  { type: "payment_pending_approval", module: "progressPayments", label: "Onay bekleyen hakedişler", description: "Gönderilmiş ve onay bekleyen hakedişler" },
  { type: "invoice_unpaid", module: "invoices", label: "Ödenmemiş faturalar", description: "Kesilmiş ama ödenmemiş faturalar" },
  { type: "team_unread", module: "team", label: "Okunmamış mesajlar", description: "Ekip sohbetinde size gelen yeni mesajlar" },
];

export const START_PAGES: { value: string; label: string; routeKey: "dashboard" | "map" | "stores" | "tickets" | "contracts" }[] = [
  { value: "/map", label: "Harita", routeKey: "map" },
  { value: "/dashboard", label: "Dashboard", routeKey: "dashboard" },
  { value: "/stores", label: "Mağazalar", routeKey: "stores" },
  { value: "/tickets", label: "Tadilat Talepleri", routeKey: "tickets" },
  { value: "/contracts", label: "Sözleşmeler", routeKey: "contracts" },
];

export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export type NotificationRule = { enabled: boolean; mandatory: boolean };

export type OrgSettings = {
  notifications: {
    rules: Record<NotificationType, NotificationRule>;
    openingSoonDays: number;
    contractExpiryDays: number;
  };
  modules: Record<ToggleableModule, boolean>;
  defaults: {
    storeBudget: number;
    /** Yeni kayıtlarda (bütçe, keşif, sözleşme, hakediş, fatura) önerilen para birimi */
    currency: CurrencyCode;
    ticketCodePrefix: string;
    contractCodePrefix: string;
    vatRate: number;
  };
  team: { retentionDays: number; fileSharing: boolean };
  assistant: { enabled: boolean; allowActions: boolean };
};

export type UserPreferences = {
  notifications: {
    modules: Record<NotificationModule, boolean>;
    types: Record<NotificationType, boolean>;
    desktop: boolean;
  };
  startPage: string;
  pageSize: number;
  tableMemory: boolean;
  map: { rememberView: boolean; rememberRegions: boolean };
  assistant: { visible: boolean; keepHistory: boolean };
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
export type OrgSettingsPatch = DeepPartial<OrgSettings>;
export type UserPreferencesPatch = DeepPartial<UserPreferences>;

const ALL_TYPES = NOTIFICATION_TYPES.map((item) => item.type);

export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  notifications: {
    rules: Object.fromEntries(ALL_TYPES.map((type) => [type, { enabled: true, mandatory: false }])) as Record<
      NotificationType,
      NotificationRule
    >,
    openingSoonDays: 7,
    contractExpiryDays: 30,
  },
  modules: { tickets: true, contracts: true, progressPayments: true, invoices: true, team: true },
  defaults: { storeBudget: 1500000, currency: DEFAULT_CURRENCY, ticketCodePrefix: "TT", contractCodePrefix: "SZ", vatRate: 20 },
  team: { retentionDays: 3, fileSharing: true },
  assistant: { enabled: true, allowActions: true },
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  notifications: {
    modules: { stores: true, contracts: true, tickets: true, progressPayments: true, invoices: true, team: true },
    types: Object.fromEntries(ALL_TYPES.map((type) => [type, true])) as Record<NotificationType, boolean>,
    desktop: false,
  },
  startPage: "/map",
  pageSize: 10,
  tableMemory: true,
  map: { rememberView: true, rememberRegions: true },
  assistant: { visible: true, keepHistory: false },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Varsayılan şablonun şekline göre birleştirir: tür uyuşmayan ya da bilinmeyen alanlar atılır */
function mergeShape<T>(base: T, raw: unknown): T {
  if (!isRecord(base) || !isRecord(raw)) {
    return typeof raw === typeof base && raw !== null ? (raw as T) : base;
  }
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(base)) {
    if (key in raw) result[key] = mergeShape((base as Record<string, unknown>)[key], raw[key]);
  }
  return result as T;
}

function clamp(value: number, min: number, max: number, fallback: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
}

function cleanPrefix(value: string, fallback: string) {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  return cleaned || fallback;
}

export function normalizeOrgSettings(raw: unknown): OrgSettings {
  const merged = mergeShape(DEFAULT_ORG_SETTINGS, raw);
  const d = DEFAULT_ORG_SETTINGS;
  return {
    ...merged,
    notifications: {
      ...merged.notifications,
      openingSoonDays: clamp(merged.notifications.openingSoonDays, 1, 90, d.notifications.openingSoonDays),
      contractExpiryDays: clamp(merged.notifications.contractExpiryDays, 1, 180, d.notifications.contractExpiryDays),
    },
    defaults: {
      storeBudget: Math.max(0, roundMoney(Number(merged.defaults.storeBudget) || 0)),
      currency: normalizeCurrency(merged.defaults.currency),
      ticketCodePrefix: cleanPrefix(merged.defaults.ticketCodePrefix, d.defaults.ticketCodePrefix),
      contractCodePrefix: cleanPrefix(merged.defaults.contractCodePrefix, d.defaults.contractCodePrefix),
      vatRate: (VAT_RATE_OPTIONS as readonly number[]).includes(merged.defaults.vatRate)
        ? merged.defaults.vatRate
        : d.defaults.vatRate,
    },
    team: {
      ...merged.team,
      retentionDays: clamp(merged.team.retentionDays, 1, 30, d.team.retentionDays),
    },
  };
}

export function normalizeUserPreferences(raw: unknown): UserPreferences {
  const merged = mergeShape(DEFAULT_USER_PREFERENCES, raw);
  return {
    ...merged,
    startPage: START_PAGES.some((page) => page.value === merged.startPage) ? merged.startPage : "/map",
    pageSize: (PAGE_SIZE_OPTIONS as readonly number[]).includes(merged.pageSize) ? merged.pageSize : 10,
  };
}

/** Kısmi değişikliği mevcut ayarların üzerine derinlemesine uygular */
export function applyPatch<T>(base: T, patch: unknown): T {
  if (!isRecord(base) || !isRecord(patch)) return (patch === undefined ? base : (patch as T));
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    result[key] = applyPatch((base as Record<string, unknown>)[key], value);
  }
  return result as T;
}

export type NotificationState = "active" | "off" | "disabled_by_org" | "mandatory";

/**
 * Bir bildirim türünün kullanıcı için durumu: firma kapattıysa hiç üretilmez,
 * zorunluysa kullanıcı kapatamaz, aksi hâlde modül ve tür tercihi birlikte belirler.
 */
export function notificationState(
  type: NotificationType,
  module: NotificationModule,
  org: OrgSettings,
  prefs: UserPreferences
): NotificationState {
  const rule = org.notifications.rules[type];
  if (!rule.enabled) return "disabled_by_org";
  if (module !== "stores" && !org.modules[module]) return "disabled_by_org";
  if (rule.mandatory) return "mandatory";
  return prefs.notifications.modules[module] && prefs.notifications.types[type] ? "active" : "off";
}

export function isNotificationShown(state: NotificationState) {
  return state === "active" || state === "mandatory";
}

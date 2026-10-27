import { VAT_RATE_OPTIONS } from "@/lib/module-finance";
import { DEFAULT_CURRENCY, normalizeCurrency, roundMoney, type CurrencyCode } from "@/lib/currency";
import { t } from "@/i18n/runtime";
import type { NotificationType } from "@/types";

/**
 * Firma ayarları (organizations.settings, yalnızca admin yazar) ve kullanıcı
 * tercihleri (user_preferences.preferences). Veritabanındaki JSON eksik ya da
 * eski olabilir; her okuma normalize* fonksiyonlarından geçer.
 */

export type NotificationModule =
  | "stores"
  | "contracts"
  | "tickets"
  | "progressPayments"
  | "invoices"
  | "team"
  | "hr"
  | "inventory";

/** Firma ayarlarından kapatılamayan bildirim modülleri */
const ALWAYS_ON_NOTIFICATION_MODULES: NotificationModule[] = ["stores", "inventory"];

export function notificationModuleDisabled(module: NotificationModule, org: OrgSettings) {
  return !ALWAYS_ON_NOTIFICATION_MODULES.includes(module) && !org.modules[module as ToggleableModule];
}

/** Firma genelinde kapatılabilen modüller; harita ve mağazalar çekirdektir */
export type ToggleableModule = "tickets" | "contracts" | "progressPayments" | "invoices" | "team" | "hr";

/** Etiket ve açıklama her okunuşta seçili dile çevrilir (settings.toggleable.<key>) */
export const TOGGLEABLE_MODULES: { key: ToggleableModule; label: string; description: string }[] = (
  ["tickets", "contracts", "progressPayments", "invoices", "team", "hr"] as const
).map((key) => ({
  key,
  get label() {
    return t(`settings.toggleable.${key}.label`);
  },
  get description() {
    return t(`settings.toggleable.${key}.description`);
  },
}));

/** Bir modüle bağlı sayfalar (modül kapalıysa menüde görünmez ve açılmaz) */
export const MODULE_ROUTES: Partial<Record<string, ToggleableModule>> = {
  personnel: "hr",
  certificates: "hr",
  timesheets: "hr",
  leaves: "hr",
  announcements: "hr",
  hrRequests: "hr",
  hrReports: "hr",
};

export const NOTIFICATION_MODULES: { key: NotificationModule; label: string }[] = (
  ["stores", "contracts", "tickets", "progressPayments", "invoices", "team", "hr", "inventory"] as const
).map((key) => ({
  key,
  get label() {
    return t(`settings.notificationModules.${key}`);
  },
}));

/** Etiket ve açıklama her okunuşta seçili dile çevrilir (settings.notificationTypes.<type>) */
export const NOTIFICATION_TYPES: {
  type: NotificationType;
  module: NotificationModule;
  label: string;
  description: string;
}[] = (
  [
    ["opening_soon", "stores"],
    ["opening_overdue", "stores"],
    ["ihale_contract_reminder", "contracts"],
    ["contract_expiring", "contracts"],
    ["ticket_assigned", "tickets"],
    ["ticket_high_priority", "tickets"],
    ["payment_pending_approval", "progressPayments"],
    ["invoice_unpaid", "invoices"],
    ["team_unread", "team"],
    ["certificate_expiring", "hr"],
    ["certificate_pending", "hr"],
    ["leave_pending", "hr"],
    ["leave_decided", "hr"],
    ["announcement_unread", "hr"],
    ["hr_request_pending", "hr"],
    ["hr_request_decided", "hr"],
    ["vehicle_expiring", "inventory"],
  ] as const
).map(([type, module]) => ({
  type,
  module,
  get label() {
    return t(`settings.notificationTypes.${type}.label`);
  },
  get description() {
    return t(`settings.notificationTypes.${type}.description`);
  },
}));

export const START_PAGES: { value: string; label: string; routeKey: "dashboard" | "map" | "stores" | "tickets" | "contracts" }[] = (
  ["map", "dashboard", "stores", "tickets", "contracts"] as const
).map((routeKey) => ({
  value: `/${routeKey}`,
  routeKey,
  get label() {
    return t(`nav.${routeKey}`);
  },
}));

export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

/** Günlük normal çalışma saati seçenekleri (haftalık 45 saat: 6 × 7,5 ya da 5 × 9) */
export const DAILY_HOUR_OPTIONS = [7.5, 8, 9] as const;

export type NotificationRule = { enabled: boolean; mandatory: boolean };

export type OrgSettings = {
  notifications: {
    rules: Record<NotificationType, NotificationRule>;
    openingSoonDays: number;
    contractExpiryDays: number;
    certificateExpiryDays: number;
    vehicleExpiryDays: number;
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
  /** İK: Cumartesi iş günü mü (izin gün sayımı ve puantaja yazım); günlük normal çalışma saati */
  hr: { saturdayWorking: boolean; dailyHours: number };
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
    certificateExpiryDays: 30,
    vehicleExpiryDays: 30,
  },
  modules: { tickets: true, contracts: true, progressPayments: true, invoices: true, team: true, hr: true },
  defaults: { storeBudget: 1500000, currency: DEFAULT_CURRENCY, ticketCodePrefix: "TT", contractCodePrefix: "SZ", vatRate: 20 },
  team: { retentionDays: 3, fileSharing: true },
  hr: { saturdayWorking: true, dailyHours: 7.5 },
  assistant: { enabled: true, allowActions: true },
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  notifications: {
    modules: { stores: true, contracts: true, tickets: true, progressPayments: true, invoices: true, team: true, hr: true, inventory: true },
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
      certificateExpiryDays: clamp(merged.notifications.certificateExpiryDays, 1, 180, d.notifications.certificateExpiryDays),
      vehicleExpiryDays: clamp(merged.notifications.vehicleExpiryDays, 1, 180, d.notifications.vehicleExpiryDays),
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
    hr: {
      ...merged.hr,
      dailyHours: (DAILY_HOUR_OPTIONS as readonly number[]).includes(merged.hr.dailyHours)
        ? merged.hr.dailyHours
        : d.hr.dailyHours,
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
  if (notificationModuleDisabled(module, org)) return "disabled_by_org";
  if (rule.mandatory) return "mandatory";
  return prefs.notifications.modules[module] && prefs.notifications.types[type] ? "active" : "off";
}

export function isNotificationShown(state: NotificationState) {
  return state === "active" || state === "mandatory";
}

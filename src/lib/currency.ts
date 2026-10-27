import { t } from "@/i18n/runtime";

/**
 * Para birimleri ve tutar biçimi. Tutar girilen her kayıt kendi para birimini
 * taşır; kur çevrimi yoktur. Farklı birimdeki tutarlar birbirine eklenmez,
 * toplamlar birim başına ayrı tutulur (MoneyTotals). Tutarlar kuruş
 * hassasiyetindedir (2 ondalık). Liste veritabanındaki CHECK kısıtıyla aynıdır
 * (supabase/migrations/20261020200000_currency.sql).
 */
export const CURRENCY_CODES = ["TRY", "USD", "EUR", "GBP", "CHF"] as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export const DEFAULT_CURRENCY: CurrencyCode = "TRY";

/** locale: tutarın o birimde alışılmış yazımı (ayraçlar, simgenin yeri) */
export const CURRENCIES: Record<CurrencyCode, { readonly label: string; symbol: string; locale: string }> = {
  TRY: { get label() { return t("shell.currency.TRY"); }, symbol: "₺", locale: "tr-TR" },
  USD: { get label() { return t("shell.currency.USD"); }, symbol: "$", locale: "en-US" },
  EUR: { get label() { return t("shell.currency.EUR"); }, symbol: "€", locale: "de-DE" },
  GBP: { get label() { return t("shell.currency.GBP"); }, symbol: "£", locale: "en-GB" },
  CHF: { get label() { return t("shell.currency.CHF"); }, symbol: "CHF", locale: "de-CH" },
};

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && (CURRENCY_CODES as readonly string[]).includes(value);
}

/** Kod dışında yazılabilen karşılıklar (Excel, asistan) */
const CURRENCY_ALIASES: Record<string, CurrencyCode> = {
  TL: "TRY",
  "₺": "TRY",
  $: "USD",
  "€": "EUR",
  "£": "GBP",
};

/** Kod, simge ya da "TL" gibi yazımı birime çevirir; tanınmazsa null */
export function parseCurrency(value: unknown): CurrencyCode | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  if (isCurrencyCode(code)) return code;
  return CURRENCY_ALIASES[code] ?? null;
}

export function normalizeCurrency(value: unknown, fallback: CurrencyCode = DEFAULT_CURRENCY): CurrencyCode {
  return parseCurrency(value) ?? fallback;
}

/** Kuruşa yuvarlar */
export function roundMoney(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(currency: CurrencyCode, withSymbol: boolean): Intl.NumberFormat {
  const key = `${currency}:${withSymbol}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(CURRENCIES[currency].locale, {
      ...(withSymbol ? { style: "currency", currency } : {}),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

/** Örn. ₺1.250,75 · $1,250.75 · 1.250,75 € */
export function formatMoney(amount: number, currency: CurrencyCode = DEFAULT_CURRENCY): string {
  return formatterFor(currency, true).format(roundMoney(amount));
}

/** Giriş alanı için simgesiz yazım: 1.250,75 (TRY) · 1,250.75 (USD) */
export function formatMoneyInput(amount: number, currency: CurrencyCode = DEFAULT_CURRENCY): string {
  return formatterFor(currency, false).format(roundMoney(amount));
}

/**
 * Yazılan sayıyı okur; yazım dilinden bağımsızdır.
 * Hem "." hem "," varsa sondaki ondalık ayracıdır (1.250,75 / 1,250.75).
 * Tek tür ayraç bir kez geçer ve ardından en çok 2 hane gelirse ondalıktır
 * (12,5 / 12.50), aksi hâlde binlik ayracıdır (1.250 / 1,250,000).
 * Boş ya da geçersizse null döner.
 */
export function parseDecimal(text: string): number | null {
  const cleaned = text.replace(/[\s'’]/g, "").replace(/[^\d.,-]/g, "");
  if (!/\d/.test(cleaned)) return null;
  const negative = cleaned.startsWith("-");
  const body = cleaned.replace(/-/g, "");

  const lastDot = body.lastIndexOf(".");
  const lastComma = body.lastIndexOf(",");
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    const at = Math.max(lastDot, lastComma);
    normalized = `${body.slice(0, at).replace(/[.,]/g, "")}.${body.slice(at + 1)}`;
  } else {
    const separator = lastDot >= 0 ? "." : lastComma >= 0 ? "," : null;
    if (!separator) {
      normalized = body;
    } else {
      const parts = body.split(separator);
      // "0,125" binlik olamaz
      const isDecimal = parts.length === 2 && (parts[1].length <= 2 || /^0?$/.test(parts[0]));
      normalized = isDecimal ? `${parts[0]}.${parts[1]}` : parts.join("");
    }
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

/** Kullanıcının yazdığı tutar, kuruşa yuvarlanmış; boş ya da geçersizse null */
export function parseMoney(text: string): number | null {
  const value = parseDecimal(text);
  return value === null ? null : roundMoney(value);
}

/** Para birimine göre toplamlar; kur çevrimi olmadığı için birimler ayrı kalır */
export type MoneyTotals = Partial<Record<CurrencyCode, number>>;

export function addMoney(totals: MoneyTotals, currency: CurrencyCode, amount: number): MoneyTotals {
  return { ...totals, [currency]: roundMoney((totals[currency] ?? 0) + amount) };
}

export function sumMoney<T>(
  items: readonly T[],
  currencyOf: (item: T) => CurrencyCode,
  amountOf: (item: T) => number
): MoneyTotals {
  return items.reduce<MoneyTotals>((totals, item) => addMoney(totals, currencyOf(item), amountOf(item)), {});
}

export function mergeMoneyTotals(...list: MoneyTotals[]): MoneyTotals {
  return list.reduce<MoneyTotals>(
    (merged, totals) =>
      moneyEntries(totals).reduce((acc, [currency, amount]) => addMoney(acc, currency, amount), merged),
    {}
  );
}

/** Sıfır olmayan toplamlar, birim listesindeki sırayla */
export function moneyEntries(totals: MoneyTotals): [CurrencyCode, number][] {
  return CURRENCY_CODES.flatMap((code) => {
    const amount = totals[code];
    return amount ? [[code, amount] as [CurrencyCode, number]] : [];
  });
}

/** Veritabanındaki {"TRY": 1250.5, "USD": 300} biçimindeki toplamları okur */
export function parseMoneyTotals(raw: unknown): MoneyTotals {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const totals: MoneyTotals = {};
  for (const [code, amount] of Object.entries(raw as Record<string, unknown>)) {
    if (isCurrencyCode(code) && Number(amount)) totals[code] = roundMoney(Number(amount));
  }
  return totals;
}

/** Örn. "₺12.500,00 + $300.00"; hiç tutar yoksa fallback biriminde sıfır */
export function formatMoneyTotals(totals: MoneyTotals, fallback: CurrencyCode = DEFAULT_CURRENCY): string {
  const entries = moneyEntries(totals);
  if (entries.length === 0) return formatMoney(0, fallback);
  return entries.map(([currency, amount]) => formatMoney(amount, currency)).join(" + ");
}

/** Grafik etiketleri için kısa yazım: ₺1,2 Mn · $350 B */
export function formatMoneyCompact(amount: number, currency: CurrencyCode = DEFAULT_CURRENCY): string {
  return new Intl.NumberFormat(CURRENCIES[currency].locale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(roundMoney(amount));
}

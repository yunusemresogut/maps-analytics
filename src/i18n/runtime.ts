import type { Locale as DateFnsLocale } from "date-fns";
import { DEFAULT_LOCALE, getDateFnsLocale, getDictionary, translate, type Locale, type TranslateParams, type TranslationKey } from "@/i18n";

/**
 * React dışındaki istemci kodu için seçili dil (lib/ altındaki etiketler,
 * bildirim metinleri, doğrulama mesajları). I18nProvider her render'da günceller;
 * dil değişince sayfa içeriği yeniden kurulduğundan okunan metinler tazelenir.
 *
 * Sunucuda (API route'ları) KULLANMAYIN: istekler arasında paylaşılır.
 * Sunucuda @/i18n/server içindeki localeFromRequest + serverTranslator kullanılır.
 */
let current: Locale = DEFAULT_LOCALE;

export function setRuntimeLocale(locale: Locale) {
  current = locale;
}

export function getLocale(): Locale {
  return current;
}

/** Modül düzeyinde (import anında) çağırmayın; o anki dil sabitlenir */
export function t(key: TranslationKey, params?: TranslateParams): string {
  return translate(getDictionary(current), key, params);
}

/** date-fns biçimlendirmesi için: format(date, "d MMMM", { locale: getDateLocale() }) */
export function getDateLocale(): DateFnsLocale {
  return getDateFnsLocale(current);
}

/** Intl / toLocaleString için: "tr-TR" ya da "en-US" */
export function getIntlLocale(): string {
  return current === "en" ? "en-US" : "tr-TR";
}

/**
 * Anahtar → çeviri anahtarı eşlemesinden, her okunuşta seçili dile çevrilen
 * etiket nesnesi. Eski `Record<K, string>` sabitlerinin yerine geçer;
 * LABELS[key], Object.entries(LABELS) gibi kullanımlar değişmeden çalışır.
 */
export function localizedRecord<K extends string>(keys: Record<K, TranslationKey>): Record<K, string> {
  const record = {} as Record<K, string>;
  for (const [name, key] of Object.entries(keys) as [K, TranslationKey][]) {
    Object.defineProperty(record, name, { enumerable: true, get: () => t(key) });
  }
  return record;
}

/**
 * Metni seçili dilden bağımsız olarak Türkçe üretir. Aktivite logları firmada
 * herkesin okuduğu kalıcı kayıtlardır ve Türkçe tutulur; içine giren etiketler
 * (izin türü, belge türü, tarih...) bu sarmalayıcıyla Türkçe kalır.
 */
export function inTurkish<T>(build: () => T): T {
  const previous = current;
  current = "tr";
  try {
    return build();
  } finally {
    current = previous;
  }
}

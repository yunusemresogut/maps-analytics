import { en } from "@/i18n/dictionaries/en";
import { tr, type Dictionary } from "@/i18n/dictionaries/tr";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locales";
import { enUS, tr as trDateLocale } from "date-fns/locale";
import type { Locale as DateFnsLocale } from "date-fns";

export const dictionaries: Record<Locale, Dictionary> = {
  tr,
  en,
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

export function getDateFnsLocale(locale: Locale): DateFnsLocale {
  return locale === "en" ? enUS : trDateLocale;
}

export type { Dictionary, Locale };
export type { TranslationKey, TranslateParams } from "@/i18n/translate";
export { translate } from "@/i18n/translate";
export { DEFAULT_LOCALE, LOCALES, isLocale } from "@/i18n/locales";

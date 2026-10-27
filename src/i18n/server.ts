import { DEFAULT_LOCALE, getDictionary, isLocale, translate, type Locale, type TranslateParams, type TranslationKey } from "@/i18n";

/** İstemcinin seçili dili: apiFetch "x-locale" başlığını gönderir, yoksa Accept-Language */
export function localeFromRequest(request: Request): Locale {
  const explicit = request.headers.get("x-locale");
  if (isLocale(explicit)) return explicit;
  const accepted = request.headers.get("accept-language")?.slice(0, 2).toLowerCase();
  return isLocale(accepted) ? accepted : DEFAULT_LOCALE;
}

/** İstek başına çevirici: const t = serverTranslator(localeFromRequest(request)) */
export function serverTranslator(locale: Locale) {
  const dictionary = getDictionary(locale);
  return (key: TranslationKey, params?: TranslateParams) => translate(dictionary, key, params);
}

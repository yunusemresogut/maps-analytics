"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_LOCALE,
  getDateFnsLocale,
  getDictionary,
  isLocale,
  type Locale,
  translate,
  type TranslateParams,
  type TranslationKey,
} from "@/i18n";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import type { Locale as DateFnsLocale } from "date-fns";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: TranslateParams) => string;
  dateLocale: DateFnsLocale;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.locale);
    if (isLocale(saved)) {
      setLocaleState(saved);
      document.documentElement.lang = saved;
      return;
    }
    document.documentElement.lang = DEFAULT_LOCALE;
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEYS.locale, next);
    document.documentElement.lang = next;
  }, []);

  const dictionary = useMemo(() => getDictionary(locale), [locale]);
  const dateLocale = useMemo(() => getDateFnsLocale(locale), [locale]);

  const t = useCallback(
    (key: TranslationKey, params?: TranslateParams) =>
      translate(dictionary, key, params),
    [dictionary]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, dateLocale }),
    [locale, setLocale, t, dateLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function useT() {
  return useI18n().t;
}

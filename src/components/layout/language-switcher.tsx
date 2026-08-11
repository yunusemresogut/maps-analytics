"use client";

import { Languages } from "lucide-react";
import { useI18n } from "@/contexts/i18n-context";
import { LOCALES, type Locale, type TranslationKey } from "@/i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LOCALE_LABEL_KEYS: Record<Locale, TranslationKey> = {
  tr: "language.tr",
  en: "language.en",
};

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  const cycleLocale = () => {
    const index = LOCALES.indexOf(locale);
    const next = LOCALES[(index + 1) % LOCALES.length] as Locale;
    setLocale(next);
  };

  const label = `${t("language.label")}: ${t(LOCALE_LABEL_KEYS[locale])}`;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleLocale}
      title={label}
      aria-label={label}
      className={cn("relative", className)}
    >
      <Languages className="h-4 w-4" />
      <span className="absolute -bottom-0.5 right-0.5 rounded bg-zinc-800 px-0.5 text-[9px] font-semibold uppercase leading-none text-zinc-300">
        {locale}
      </span>
    </Button>
  );
}

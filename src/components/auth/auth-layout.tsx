"use client";

import { CalendarDays, MapPinned, PanelsTopLeft, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { useI18n } from "@/contexts/i18n-context";
import { useTheme } from "@/contexts/theme-context";

type AuthLayoutProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();
  const features = [
    { icon: MapPinned, title: t("auth.featureMap"), description: t("auth.featureMapDescription") },
    { icon: CalendarDays, title: t("auth.featureDates"), description: t("auth.featureDatesDescription") },
    { icon: PanelsTopLeft, title: t("auth.featureModules"), description: t("auth.featureModulesDescription") },
  ];

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(26rem,0.95fr)]">
      <aside className="relative isolate flex min-h-112 flex-col justify-between overflow-hidden bg-[#0b1014] px-6 py-7 text-white sm:px-10 sm:py-9 lg:min-h-screen lg:px-14 lg:py-12">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(135deg,#102126_0%,#0b1014_52%,#111827_100%)]" />
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-25"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)",
            backgroundSize: "52px 52px",
            maskImage: "linear-gradient(135deg, black, transparent 78%)",
          }}
        />

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0f766e] text-white">
            <MapPinned className="h-5 w-5" aria-hidden />
          </div>
          <span className="text-base font-semibold tracking-wide">Maps Analytics</span>
        </div>

        <div className="my-10 max-w-xl lg:my-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5eead4]">
            {t("auth.brandEyebrow")}
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight text-white sm:text-5xl">
            {t("auth.brandHeadline")}
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/70">
            {t("auth.brandDescription")}
          </p>

          <div className="mt-8 max-w-lg divide-y divide-white/10 border-y border-white/10">
            {features.map(({ icon: Icon, title: featureTitle, description: featureDescription }) => (
              <div key={featureTitle} className="flex items-start gap-3 py-4">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-[#5eead4]">
                  <Icon className="h-4 w-4" aria-hidden />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{featureTitle}</p>
                  <p className="mt-1 text-sm leading-5 text-white/60">{featureDescription}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/45">{t("auth.brandFooter")}</p>
      </aside>

      <section className="flex min-h-152 flex-col bg-background px-5 py-5 sm:px-10 sm:py-8 lg:min-h-screen lg:px-16 lg:py-10">
        <div className="flex justify-end gap-1">
          <LanguageSwitcher />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            title={theme === "light" ? t("header.darkMode") : t("header.lightMode")}
            aria-label={theme === "light" ? t("header.darkMode") : t("header.lightMode")}
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4" aria-hidden />
            ) : (
              <Sun className="h-4 w-4" aria-hidden />
            )}
          </Button>
        </div>

        <div className="flex flex-1 items-center justify-center py-8 lg:py-12">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <p className="text-sm font-semibold text-cyan-300">Maps Analytics</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight text-zinc-100">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
            </div>
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}
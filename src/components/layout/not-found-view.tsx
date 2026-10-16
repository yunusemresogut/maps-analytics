"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Coins,
  FileText,
  LayoutDashboard,
  LogIn,
  Map,
  MapPinOff,
  MapPinned,
  Receipt,
  Store,
  Ticket,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/contexts/i18n-context";
import { canAccessRoute } from "@/lib/permissions";
import { homePathForRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/i18n";
import type { AppRouteKey } from "@/types";

const QUICK_LINKS: {
  href: string;
  labelKey: TranslationKey;
  icon: typeof Map;
  routeKey: AppRouteKey;
}[] = [
  { href: "/map", labelKey: "nav.map", icon: Map, routeKey: "map" },
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard, routeKey: "dashboard" },
  { href: "/stores", labelKey: "nav.stores", icon: Store, routeKey: "stores" },
  { href: "/tickets", labelKey: "nav.tickets", icon: Ticket, routeKey: "tickets" },
  { href: "/contracts", labelKey: "nav.contracts", icon: FileText, routeKey: "contracts" },
  { href: "/progress-payments", labelKey: "nav.progressPayments", icon: Receipt, routeKey: "progressPayments" },
  { href: "/invoices", labelKey: "nav.invoices", icon: Coins, routeKey: "invoices" },
];

export function NotFoundView() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  // Kullanıcı yalnızca yetkili olduğu sayfalara yönlendirilir
  const links = user
    ? QUICK_LINKS.filter((link) => canAccessRoute(user, link.routeKey))
    : [];

  const goBack = () => {
    if (window.history.length > 1) router.back();
    else router.push(user ? homePathForRole(user.role) : "/login");
  };

  return (
    <main className="relative flex min-h-screen flex-1 flex-col overflow-hidden">
      {/* Harita ızgarası: tema renklerinden türetilir, kenarlara doğru söner */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 text-zinc-800 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at center, black 10%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 10%, transparent 70%)",
        }}
      />

      {/* Panel dışı sayfa: üst bar yok, yalnızca marka */}
      <Link
        href={user ? homePathForRole(user.role) : "/login"}
        className="relative flex w-fit items-center gap-2.5 rounded-lg px-4 pt-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 sm:px-8 sm:pt-7"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
          <MapPinned className="h-4 w-4" aria-hidden />
        </span>
        <span className="text-sm font-semibold tracking-wide text-zinc-200">Maps Analytics</span>
      </Link>

      <div className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-12 text-center sm:px-6">
        <div className="relative mb-8 flex h-28 w-28 items-center justify-center">
          <span className="absolute inset-0 rounded-full border border-cyan-500/20" />
          <span className="absolute inset-3 animate-ping rounded-full border border-cyan-500/30 [animation-duration:2.4s] motion-reduce:animate-none" />
          <span className="absolute inset-6 rounded-full bg-cyan-500/10" />
          <MapPinOff className="relative h-10 w-10 text-cyan-300" aria-hidden />
        </div>

        <p className="font-mono text-sm font-medium tracking-[0.3em] text-cyan-400">404</p>
        <h1 className="mt-3 text-2xl font-semibold text-zinc-100 sm:text-3xl">
          {t("notFound.title")}
        </h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-zinc-400">
          {t("notFound.description")}
        </p>

        <div className="mt-5 inline-flex max-w-full items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs">
          <span className="shrink-0 text-zinc-500">{t("notFound.requestedPath")}</span>
          <code className="truncate font-mono text-zinc-300">{pathname}</code>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {user ? (
            <Link href={homePathForRole(user.role)} className={buttonVariants()}>
              <Map className="h-4 w-4" aria-hidden />
              {t("notFound.goHome")}
            </Link>
          ) : (
            <Link href="/login" className={buttonVariants()}>
              <LogIn className="h-4 w-4" aria-hidden />
              {t("notFound.signIn")}
            </Link>
          )}
          <button type="button" onClick={goBack} className={buttonVariants({ variant: "outline" })}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {t("notFound.goBack")}
          </button>
        </div>

        {links.length > 0 && (
          <nav aria-label={t("notFound.quickLinks")} className="mt-12 w-full">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              {t("notFound.quickLinks")}
            </p>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {links.map(({ href, labelKey, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 text-left text-sm text-zinc-300 transition-colors",
                      "hover:border-cyan-500/40 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                    <span className="truncate">{t(labelKey)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </main>
  );
}

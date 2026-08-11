"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  Coins,
  FileText,
  LayoutDashboard,
  Map,
  MapPin,
  Pin,
  PinOff,
  Receipt,
  ScrollText,
  Shield,
  Store,
  Ticket,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useSidebar } from "@/contexts/sidebar-context";
import { useT } from "@/contexts/i18n-context";
import { canAccessRoute } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/roles";
import type { TranslationKey } from "@/i18n";
import type { AppRouteKey, UserRole } from "@/types";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  labelKey: TranslationKey;
  icon: typeof Map;
  routeKey: AppRouteKey;
};

const MAIN_NAV: NavItem[] = [
  {
    href: "/dashboard",
    labelKey: "nav.dashboard",
    icon: LayoutDashboard,
    routeKey: "dashboard",
  },
  { href: "/map", labelKey: "nav.map", icon: Map, routeKey: "map" },
  { href: "/stores", labelKey: "nav.stores", icon: Store, routeKey: "stores" },
  {
    href: "/projects",
    labelKey: "nav.projects",
    icon: ClipboardList,
    routeKey: "projects",
  },
  {
    href: "/approvals",
    labelKey: "nav.approvals",
    icon: Shield,
    routeKey: "approvals",
  },
  { href: "/tickets", labelKey: "nav.tickets", icon: Ticket, routeKey: "tickets" },
  {
    href: "/contracts",
    labelKey: "nav.contracts",
    icon: FileText,
    routeKey: "contracts",
  },
  {
    href: "/progress-payments",
    labelKey: "nav.progressPayments",
    icon: Receipt,
    routeKey: "progressPayments",
  },
  {
    href: "/invoices",
    labelKey: "nav.invoices",
    icon: Coins,
    routeKey: "invoices",
  },
  {
    href: "/settings/profile",
    labelKey: "nav.profile",
    icon: UserCircle,
    routeKey: "profile",
  },
];

const ADMIN_NAV: NavItem[] = [
  {
    href: "/admin/dashboard",
    labelKey: "nav.dashboard",
    icon: BarChart3,
    routeKey: "adminDashboard",
  },
  {
    href: "/admin/budgets",
    labelKey: "nav.budgets",
    icon: Coins,
    routeKey: "adminBudgets",
  },
  {
    href: "/admin/users",
    labelKey: "nav.users",
    icon: Users,
    routeKey: "adminUsers",
  },
  {
    href: "/admin/regions",
    labelKey: "nav.regions",
    icon: MapPin,
    routeKey: "adminRegions",
  },
  {
    href: "/admin/permissions",
    labelKey: "nav.permissions",
    icon: Shield,
    routeKey: "adminPermissions",
  },
  {
    href: "/admin/logs",
    labelKey: "nav.logs",
    icon: ScrollText,
    routeKey: "adminLogs",
  },
];

export function AppSidebar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const { isOpen, isPinned, close, togglePin } = useSidebar();
  const t = useT();

  if (!user) return null;

  const visible = isPinned || isOpen;
  const filterNav = (items: NavItem[]) =>
    items.filter((item) => canAccessRoute(user, item.routeKey));

  const mainItems = filterNav(MAIN_NAV);
  const adminItems =
    user.role === "admin" ? filterNav(ADMIN_NAV) : [];

  const handleNavClick = () => {
    if (!isPinned) close();
  };

  const renderLink = (item: NavItem) => {
    const active =
      pathname === item.href ||
      (item.href !== "/dashboard" &&
        item.href !== "/map" &&
        pathname.startsWith(item.href));
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={handleNavClick}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
          active
            ? "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-500/25"
            : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
        )}
      >
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            active ? "text-cyan-400" : "text-zinc-500"
          )}
        />
        {t(item.labelKey)}
      </Link>
    );
  };

  return (
    <>
      {!isPinned && isOpen && (
        <button
          type="button"
          aria-label={t("nav.closeMenu")}
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[1px]"
          style={{ top: "3.5rem" }}
          onClick={close}
        />
      )}

      <aside
        className={cn(
          "z-50 flex w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950/95 backdrop-blur-md transition-transform duration-200 ease-out",
          isPinned
            ? "relative h-full translate-x-0"
            : cn(
                "fixed bottom-0 left-0 shadow-2xl",
                visible
                  ? "translate-x-0"
                  : "pointer-events-none -translate-x-full"
              )
        )}
        style={isPinned ? undefined : { top: "3.5rem" }}
        aria-hidden={!visible}
      >
        <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-3">
          <div className="min-w-0 px-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-cyan-400/90">
              {t("nav.menu")}
            </p>
            <p className="truncate text-sm font-semibold text-zinc-100">
              {user.role === "admin"
                ? t("nav.management")
                : t("nav.navigation")}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={togglePin}
              className={cn(
                "rounded-lg p-1.5 transition-colors",
                isPinned
                  ? "bg-cyan-500/15 text-cyan-300"
                  : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
              )}
              title={isPinned ? t("nav.unpinMenu") : t("nav.pinMenu")}
              aria-label={isPinned ? t("nav.unpinMenu") : t("nav.pinMenu")}
              aria-pressed={isPinned}
            >
              {isPinned ? (
                <PinOff className="h-4 w-4" />
              ) : (
                <Pin className="h-4 w-4" />
              )}
            </button>

            {!isPinned && (
              <button
                type="button"
                onClick={close}
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                aria-label={t("nav.closeMenu")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {mainItems.map(renderLink)}
          {adminItems.length > 0 && (
            <>
              <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                Admin
              </p>
              {adminItems.map(renderLink)}
            </>
          )}
        </nav>

        <div className="border-t border-zinc-800 px-4 py-3">
          <p className="truncate text-xs text-zinc-500">{user.name}</p>
          <p className="truncate text-[11px] text-zinc-600">
            {ROLE_LABELS[user.role as UserRole] ?? user.role}
          </p>
        </div>
      </aside>
    </>
  );
}

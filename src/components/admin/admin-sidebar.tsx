"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  Coins,
  LayoutDashboard,
  MapPin,
  ScrollText,
  Shield,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const ADMIN_NAV = [
  {
    href: "/admin/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/admin/budgets",
    label: "Bütçe Takibi",
    icon: Coins,
  },
  {
    href: "/admin/users",
    label: "Kullanıcılar",
    icon: Users,
  },
  {
    href: "/admin/regions",
    label: "Bölgeler",
    icon: MapPin,
  },
  {
    href: "/admin/permissions",
    label: "Yetkiler",
    icon: Shield,
  },
  {
    href: "/admin/logs",
    label: "Aktivite Logları",
    icon: ScrollText,
  },
] as const;

type AdminSidebarProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
};

export function AdminSidebar({ mobileOpen, onMobileClose }: AdminSidebarProps) {
  const pathname = usePathname();

  const navContent = (
    <>
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-4 lg:py-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-violet-400">
            Admin
          </p>
          <p className="mt-0.5 text-sm font-semibold text-zinc-100">
            Yönetim Paneli
          </p>
        </div>
        <button
          type="button"
          onClick={onMobileClose}
          className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300 lg:hidden"
          aria-label="Menüyü kapat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {ADMIN_NAV.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== "/admin/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={onMobileClose}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-violet-500/15 text-violet-200 ring-1 ring-violet-500/25"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-violet-400" : "text-zinc-500"
                )}
              />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950/80 lg:flex">
        {navContent}
      </aside>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-zinc-800 bg-zinc-950 shadow-2xl transition-transform duration-200 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ top: "3.5rem" }}
      >
        {navContent}
      </aside>
    </>
  );
}

export function AdminMobileTopBar({
  title,
  onMenuOpen,
}: {
  title: string;
  onMenuOpen: () => void;
}) {
  return (
    <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur-md lg:hidden">
      <button
        type="button"
        onClick={onMenuOpen}
        className="rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
        aria-label="Menüyü aç"
      >
        <ClipboardList className="h-4 w-4" />
      </button>
      <h1 className="truncate text-sm font-medium text-zinc-200">{title}</h1>
    </div>
  );
}

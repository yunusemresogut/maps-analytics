"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Building2, LayoutGrid, Settings2, ShieldCheck, SlidersHorizontal, UserCircle } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useAuth } from "@/contexts/auth-context";
import { isAdmin } from "@/lib/roles";
import { cn } from "@/lib/utils";

const PERSONAL_NAV = [
  { href: "/settings/profile", label: "Profil", icon: UserCircle },
  { href: "/settings/notifications", label: "Bildirimler", icon: Bell },
  { href: "/settings/preferences", label: "Tercihler", icon: SlidersHorizontal },
];

const COMPANY_NAV = [
  { href: "/settings/company", label: "Firma ve varsayılanlar", icon: Building2 },
  { href: "/settings/notification-rules", label: "Bildirim kuralları", icon: ShieldCheck },
  { href: "/settings/modules", label: "Modüller ve özellikler", icon: LayoutGrid },
];

function SettingsNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const admin = Boolean(user && isAdmin(user.role));

  const renderLink = (item: (typeof PERSONAL_NAV)[number]) => {
    const active = pathname === item.href;
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
          active ? "bg-cyan-500/15 text-cyan-300" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
        )}
      >
        <Icon className={cn("h-4 w-4", active ? "text-cyan-400" : "text-zinc-500")} />
        {item.label}
      </Link>
    );
  };

  return (
    <nav
      aria-label="Ayarlar"
      className="scrollbar-themed flex gap-1 overflow-x-auto border-b border-zinc-800 p-3 md:w-60 md:shrink-0 md:flex-col md:overflow-visible md:border-b-0 md:border-r md:p-4"
    >
      <p className="hidden items-center gap-2 px-3 pb-3 text-sm font-semibold text-zinc-100 md:flex">
        <Settings2 className="h-4 w-4 text-cyan-400" />
        Ayarlar
      </p>
      <p className="hidden px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 md:block">
        Kişisel
      </p>
      {PERSONAL_NAV.map(renderLink)}
      {admin && (
        <>
          <p className="hidden px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-zinc-600 md:block">
            Firma (admin)
          </p>
          <span className="mx-1 w-px shrink-0 bg-zinc-800 md:hidden" aria-hidden />
          {COMPANY_NAV.map(renderLink)}
        </>
      )}
    </nav>
  );
}

/** Ayarlar: solda kişisel ve (admin için) firma bölümleri */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard routeKey="settings">
      <div className="flex h-full min-h-0 flex-col md:flex-row">
        <SettingsNav />
        <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8 lg:pb-24">
          <div className="mx-auto max-w-3xl">{children}</div>
        </div>
      </div>
    </AuthGuard>
  );
}

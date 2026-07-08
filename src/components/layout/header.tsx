"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, LogOut, Map, Menu, Moon, Sun, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import { MapHeaderActions } from "@/components/layout/map-header-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const USER_LINKS = [
  { href: "/map", label: "Harita", icon: Map },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
] as const;

export function Header() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const homeHref = user?.role === "admin" ? "/admin/dashboard" : "/map";

  return (
    <header className="relative z-50 shrink-0 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between gap-3 px-4">
        <Link
          href={homeHref}
          className="flex min-w-0 items-center gap-2.5"
          onClick={() => setMobileOpen(false)}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/20 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
            <Map className="h-4 w-4 text-cyan-400" />
          </div>
          <span className="truncate text-sm font-semibold text-zinc-100">
            Maps Analytics
          </span>
        </Link>

        {user ? (
          <>
            <nav className="hidden items-center gap-1 md:flex">
              <MapHeaderActions />

              {user.role === "user" &&
                USER_LINKS.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href}>
                    <Button
                      variant={pathname === href ? "default" : "ghost"}
                      size="sm"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden lg:inline">{label}</span>
                    </Button>
                  </Link>
                ))}

              {user.role === "admin" && (
                <Link href="/admin/dashboard">
                  <Button
                    variant={pathname.startsWith("/admin") ? "default" : "ghost"}
                    size="sm"
                  >
                    Admin
                  </Button>
                </Link>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                title={theme === "light" ? "Karanlık Mod" : "Aydınlık Mod"}
                className="cursor-pointer mr-1"
              >
                {theme === "light" ? (
                  <Moon className="h-4 w-4 text-violet-400" />
                ) : (
                  <Sun className="h-4 w-4 text-amber-400" />
                )}
              </Button>

              <span className="hidden px-2 text-sm text-zinc-500 xl:inline">
                {user.name}
              </span>
              <Button variant="ghost" size="sm" onClick={logout}>
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Çıkış</span>
              </Button>
            </nav>

            <div className="flex items-center gap-1 md:hidden">
              <MapHeaderActions />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Menü"
              >
                {mobileOpen ? (
                  <X className="h-4 w-4" />
                ) : (
                  <Menu className="h-4 w-4" />
                )}
              </Button>
            </div>
          </>
        ) : null}
      </div>

      {user && mobileOpen && (
        <div className="border-t border-zinc-800 bg-zinc-950 px-3 py-3 md:hidden">
          <div className="mb-2 px-2 flex justify-between items-center text-xs text-zinc-500">
            <span>{user.name}</span>
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              {theme === "light" ? (
                <>
                  <Moon className="h-3.5 w-3.5 text-violet-400" />
                  Karanlık Mod
                </>
              ) : (
                <>
                  <Sun className="h-3.5 w-3.5 text-amber-400" />
                  Aydınlık Mod
                </>
              )}
            </button>
          </div>
          {user.role === "user" && (
            <div className="space-y-1">
              {USER_LINKS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                    pathname === href
                      ? "bg-cyan-500/15 text-cyan-200"
                      : "text-zinc-400 hover:bg-zinc-900"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </div>
          )}
          {user.role === "admin" && (
            <Link
              href="/admin/dashboard"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-400 hover:bg-zinc-900"
            >
              Admin Paneli
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              logout();
            }}
            className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-400/80 hover:bg-zinc-900"
          >
            <LogOut className="h-4 w-4" />
            Çıkış
          </button>
        </div>
      )}
    </header>
  );
}

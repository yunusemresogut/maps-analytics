"use client";

import Link from "next/link";
import { LogOut, Menu, Moon, PanelLeftClose, Sun } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import { useSidebar } from "@/contexts/sidebar-context";
import { useT } from "@/contexts/i18n-context";
import { useSettings } from "@/contexts/settings-context";
import { MapHeaderActions } from "@/components/layout/map-header-actions";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/layout/brand-logo";

export function Header() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isOpen, isPinned, toggle } = useSidebar();
  const t = useT();

  const { homePath } = useSettings();
  const homeHref = user ? homePath : "/login";
  const menuActive = isPinned || isOpen;
  const menuLabel =
    isPinned || isOpen ? t("nav.closeMenu") : t("nav.openMenu");

  return (
    <header className="relative z-[60] shrink-0 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2">
          {user ? (
            <Button
              variant={menuActive ? "default" : "ghost"}
              size="icon"
              onClick={toggle}
              title={menuLabel}
              aria-label={menuLabel}
              aria-expanded={menuActive}
            >
              {isPinned ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </Button>
          ) : null}

          <Link href={homeHref} className="flex min-w-0 items-center">
            <BrandLogo className="h-7" />
          </Link>
        </div>

        <nav className="flex items-center gap-1">
          {user ? <MapHeaderActions /> : null}
          {user ? <NotificationsBell /> : null}

          <LanguageSwitcher />

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            title={
              theme === "light" ? t("header.darkMode") : t("header.lightMode")
            }
            aria-label={
              theme === "light" ? t("header.darkMode") : t("header.lightMode")
            }
            className="cursor-pointer"
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4 text-violet-400" />
            ) : (
              <Sun className="h-4 w-4 text-amber-400" />
            )}
          </Button>

          {user ? (
            <>
              <span className="hidden px-2 text-sm text-zinc-500 sm:inline">
                {user.name}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                title={t("header.logout")}
                aria-label={t("header.logout")}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

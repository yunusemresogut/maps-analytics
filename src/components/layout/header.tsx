"use client";

import Link from "next/link";
import { BarChart3, LogOut, Map, Shield } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { MapHeaderActions } from "@/components/layout/map-header-actions";
import { Button } from "@/components/ui/button";

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="relative z-50 flex h-14 shrink-0 items-center justify-between border-b border-zinc-800/80 bg-zinc-950/90 px-4 backdrop-blur-md">
      <Link
        href={user?.role === "admin" ? "/admin" : "/map"}
        className="flex items-center gap-2.5"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 border border-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
          <Map className="h-4 w-4 text-cyan-400" />
        </div>
        <div>
          <span className="text-sm font-semibold text-zinc-100">
            Maps Analytics
          </span>
        </div>
      </Link>

      <nav className="flex items-center gap-2">
        {user ? (
          <>
            <MapHeaderActions />

            {user.role === "user" && (
              <>
                <Link href="/map">
                  <Button variant="ghost" size="sm">
                    <Map className="h-3.5 w-3.5" />
                    Harita
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Dashboard
                  </Button>
                </Link>
              </>
            )}
            {user.role === "admin" && (
              <Link href="/admin">
                <Button variant="ghost" size="sm">
                  <Shield className="h-3.5 w-3.5" />
                  Admin
                </Button>
              </Link>
            )}
            <span className="hidden text-sm text-zinc-500 sm:inline">
              {user.name}
            </span>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-3.5 w-3.5" />
              Çıkış
            </Button>
          </>
        ) : null}
      </nav>
    </header>
  );
}

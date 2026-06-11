"use client";

import Link from "next/link";
import { LogOut, Map, Shield } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-800/80 bg-zinc-950/90 px-4 backdrop-blur-md">
      <Link href="/" className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 border border-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
          <Map className="h-4 w-4 text-cyan-400" />
        </div>
        <div>
          <span className="text-sm font-semibold text-zinc-100">
            LCW Maps
          </span>
          <span className="ml-2 text-xs text-zinc-600">Analytics</span>
        </div>
      </Link>

      <nav className="flex items-center gap-3">
        {user ? (
          <>
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
        ) : (
          <Link href="/login">
            <Button size="sm">Giriş Yap</Button>
          </Link>
        )}
      </nav>
    </header>
  );
}

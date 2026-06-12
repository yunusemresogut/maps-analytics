"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, Users, MapPin } from "lucide-react";
import { AdminGuard } from "@/components/auth/admin-guard";
import { AdminRegionsPanel } from "@/components/admin/admin-regions-panel";
import { AdminUsersPanel } from "@/components/admin/admin-users-panel";
import { Button } from "@/components/ui/button";

type AdminTab = "users" | "regions";

export default function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("users");

  return (
    <AdminGuard>
      <div className="mx-auto max-w-5xl p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100">
              Admin Paneli
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Kullanıcı, yetki ve bölge yönetimi
            </p>
          </div>
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              <BarChart3 className="h-3.5 w-3.5" />
              Dashboard
            </Button>
          </Link>
        </div>

        <div className="mb-6 flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900/50 p-1">
          <TabButton
            active={tab === "users"}
            onClick={() => setTab("users")}
            icon={Users}
            label="Kullanıcılar"
          />
          <TabButton
            active={tab === "regions"}
            onClick={() => setTab("regions")}
            icon={MapPin}
            label="Bölgeler"
          />
        </div>

        {tab === "users" && <AdminUsersPanel />}
        {tab === "regions" && <AdminRegionsPanel />}
      </div>
    </AdminGuard>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-cyan-500/20 text-cyan-300"
          : "text-zinc-500 hover:text-zinc-300"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

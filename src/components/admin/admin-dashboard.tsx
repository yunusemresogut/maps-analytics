"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import {
  ArrowRight,
  MapPin,
  ScrollText,
  Shield,
  Store,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useRegions } from "@/contexts/regions-context";
import { useStores } from "@/contexts/stores-context";
import { useActivityLogs } from "@/hooks/use-activity-logs";
import { computeStoreNotifications } from "@/lib/notifications";
import { projectStatusConfig } from "@/lib/project-status";
import type { ProjectStatus } from "@/types";

export function AdminDashboard() {
  const { users } = useAuth();
  const { stores } = useStores();
  const { regions } = useRegions();
  const logs = useActivityLogs();

  const regularUsers = users.filter((u) => u.role === "user");
  const notifications = computeStoreNotifications(stores);
  const recentLogs = logs.slice(0, 6);

  const statusCounts = stores.reduce(
    (acc, s) => {
      acc[s.projectStatus] = (acc[s.projectStatus] ?? 0) + 1;
      return acc;
    },
    {} as Record<ProjectStatus, number>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          label="Kullanıcılar"
          value={regularUsers.length}
          href="/admin/users"
          accent="cyan"
        />
        <StatCard
          icon={MapPin}
          label="Bölgeler"
          value={regions.length}
          href="/admin/regions"
          accent="violet"
        />
        <StatCard
          icon={Store}
          label="Toplam Konum"
          value={stores.length}
          href="/dashboard"
          accent="emerald"
        />
        <StatCard
          icon={Shield}
          label="Aktif Bildirim"
          value={notifications.length}
          href="/admin/logs"
          accent="amber"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h2 className="text-sm font-medium text-zinc-300">
            Proje Durum Özeti
          </h2>
          <div className="mt-4 space-y-2">
            {(Object.keys(projectStatusConfig) as ProjectStatus[]).map(
              (status) => {
                const count = statusCounts[status] ?? 0;
                const pct = stores.length
                  ? Math.round((count / stores.length) * 100)
                  : 0;
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: projectStatusConfig[status].marker,
                      }}
                    />
                    <span className="w-28 text-xs text-zinc-400">
                      {projectStatusConfig[status].label}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: projectStatusConfig[status].marker,
                        }}
                      />
                    </div>
                    <span className="w-6 text-right text-xs text-zinc-500">
                      {count}
                    </span>
                  </div>
                );
              }
            )}
          </div>
        </section>

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-300">
              <ScrollText className="h-4 w-4 text-violet-400" />
              Son Aktiviteler
            </h2>
            <Link
              href="/admin/logs"
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              Tümünü gör
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {recentLogs.length === 0 && (
              <li className="text-sm text-zinc-600">Henüz aktivite yok</li>
            )}
            {recentLogs.map((log) => (
              <li
                key={log.id}
                className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2.5"
              >
                <p className="text-sm text-zinc-300">{log.message}</p>
                <p className="mt-1 text-xs text-zinc-600">
                  {log.actorName} ·{" "}
                  {format(parseISO(log.createdAt), "d MMM, HH:mm", {
                    locale: tr,
                  })}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  href,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  href: string;
  accent: "cyan" | "violet" | "emerald" | "amber";
}) {
  const colorMap = {
    cyan: { icon: "text-cyan-400", bg: "bg-cyan-500/10" },
    violet: { icon: "text-violet-400", bg: "bg-violet-500/10" },
    emerald: { icon: "text-emerald-400", bg: "bg-emerald-500/10" },
    amber: { icon: "text-amber-400", bg: "bg-amber-500/10" },
  } as const;
  const colors = colorMap[accent];

  return (
    <Link
      href={href}
      className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-900/80"
    >
      <div className="flex items-start justify-between">
        <div className={`rounded-lg p-2 ${colors.bg}`}>
          <Icon className={`h-4 w-4 ${colors.icon}`} />
        </div>
        <ArrowRight className="h-4 w-4 text-zinc-700 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-500" />
      </div>
      <p className="mt-3 text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-100">{value}</p>
    </Link>
  );
}

"use client";

import { BarChart3, Clock, MapPin, TrendingUp, Users } from "lucide-react";
import { useStores } from "@/contexts/stores-context";
import { getOpeningAlert } from "@/lib/opening-dates";
import { projectStatusConfig } from "@/lib/project-status";
import type { ProjectStatus } from "@/types";

const PLACEHOLDER_METRICS = [
  { icon: MapPin, label: "Bölgelere göre proje sayısı", status: "Yakında" },
  { icon: BarChart3, label: "Durumlara göre dağılım", status: "Yakında" },
  { icon: Clock, label: "Yaklaşan açılışlar", status: "Yakında" },
  { icon: TrendingUp, label: "Geciken açılışlar", status: "Yakında" },
  { icon: Users, label: "Kullanıcı aktiviteleri", status: "Yakında" },
  { icon: MapPin, label: "Son eklenen projeler", status: "Yakında" },
];

export function DashboardPlaceholder() {
  const { stores } = useStores();

  const statusCounts = stores.reduce(
    (acc, s) => {
      acc[s.projectStatus] = (acc[s.projectStatus] ?? 0) + 1;
      return acc;
    },
    {} as Record<ProjectStatus, number>
  );

  const openingSoon = stores.filter(
    (s) => getOpeningAlert(s.openingDate).isOpeningSoon
  ).length;

  const overdue = stores.filter(
    (s) =>
      getOpeningAlert(s.openingDate).isOverdue && s.projectStatus !== "acilis"
  ).length;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Analiz ve grafikler yakında eklenecek — şimdilik özet metrikler
        </p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Toplam Proje" value={stores.length} />
        <MetricCard label="Yakında Açılıyor" value={openingSoon} accent="red" />
        <MetricCard label="Geciken Açılış" value={overdue} accent="amber" />
        <MetricCard
          label="Aktif Durum"
          value={Object.keys(statusCounts).length}
        />
      </div>

      <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="mb-4 text-sm font-medium text-zinc-300">
          Durumlara Göre Dağılım (Önizleme)
        </h2>
        <div className="space-y-2">
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
                  <span className="w-32 text-xs text-zinc-400">
                    {projectStatusConfig[status].label}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: projectStatusConfig[status].marker,
                      }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs text-zinc-500">
                    {count}
                  </span>
                </div>
              );
            }
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLACEHOLDER_METRICS.map(({ icon: Icon, label, status }) => (
          <div
            key={label}
            className="rounded-xl border border-dashed border-zinc-700/60 bg-zinc-900/30 p-5"
          >
            <Icon className="mb-3 h-5 w-5 text-zinc-600" />
            <p className="text-sm text-zinc-400">{label}</p>
            <p className="mt-1 text-xs text-zinc-600">{status}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "red" | "amber";
}) {
  const accentClass =
    accent === "red"
      ? "text-red-400"
      : accent === "amber"
        ? "text-amber-400"
        : "text-cyan-400";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accentClass}`}>{value}</p>
    </div>
  );
}

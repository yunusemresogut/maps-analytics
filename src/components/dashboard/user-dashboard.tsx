"use client";

import Link from "next/link";
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

export function UserDashboard() {
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

  const recentStores = [...stores]
    .sort(
      (a, b) =>
        new Date(b.updatedAt ?? b.createdAt).getTime() -
        new Date(a.updatedAt ?? a.createdAt).getTime()
    )
    .slice(0, 5);

  return (
    <div className="scrollbar-themed h-[calc(100vh-3.5rem)] overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100 sm:text-2xl">
              Proje Dashboard
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Mağaza ve proje metriklerinizin özeti
            </p>
          </div>
          <Link
            href="/map"
            className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-cyan-400 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
          >
            Haritaya git →
          </Link>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Toplam Proje" value={stores.length} />
          <MetricCard label="Yakında Açılıyor" value={openingSoon} accent="red" />
          <MetricCard label="Geciken Açılış" value={overdue} accent="amber" />
          <MetricCard
            label="Aktif Durum"
            value={Object.keys(statusCounts).length}
          />
        </div>

        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
            <h2 className="text-sm font-medium text-zinc-300">
              Durumlara Göre Dağılım
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
                      <span className="w-24 shrink-0 text-xs text-zinc-400 sm:w-32">
                        {projectStatusConfig[status].label}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: projectStatusConfig[status].marker,
                          }}
                        />
                      </div>
                      <span className="w-6 shrink-0 text-right text-xs text-zinc-500">
                        {count}
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          </section>

          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
            <h2 className="text-sm font-medium text-zinc-300">
              Son Güncellenen Projeler
            </h2>
            <ul className="mt-4 space-y-2">
              {recentStores.length === 0 && (
                <li className="text-sm text-zinc-600">Henüz proje yok</li>
              )}
              {recentStores.map((store) => (
                <li
                  key={store.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-zinc-300">{store.name}</p>
                    <p className="text-xs text-zinc-600">{store.city}</p>
                  </div>
                  <span
                    className="shrink-0 text-xs"
                    style={{ color: projectStatusConfig[store.projectStatus].marker }}
                  >
                    {projectStatusConfig[store.projectStatus].label}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PLACEHOLDER_METRICS.map(({ icon: Icon, label, status }) => (
            <div
              key={label}
              className="rounded-xl border border-dashed border-zinc-700/60 bg-zinc-900/30 p-4 sm:p-5"
            >
              <Icon className="mb-3 h-5 w-5 text-zinc-600" />
              <p className="text-sm text-zinc-400">{label}</p>
              <p className="mt-1 text-xs text-zinc-600">{status}</p>
            </div>
          ))}
        </div>
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

"use client";

import Link from "next/link";
import {
  BarChart3,
  Calendar,
  Clock,
  Coins,
  MapPin,
  Store,
  TrendingUp,
} from "lucide-react";
import { useStores } from "@/contexts/stores-context";
import { useRegions } from "@/contexts/regions-context";
import { useDb } from "@/contexts/db-context";
import { findRegionForCity } from "@/data/regions";
import { getOpeningAlert } from "@/lib/opening-dates";
import { projectStatusConfig } from "@/lib/project-status";
import type { ProjectStatus } from "@/types";

const LOCATION_TYPE_LABELS: Record<string, string> = {
  avm: "AVM",
  cadde: "Cadde",
  outdoor: "Açık Alan / Outdoor",
};

export function UserDashboard() {
  const { stores } = useStores();
  const { regions } = useRegions();
  const { storeData } = useDb();

  // Status distributions
  const statusCounts = stores.reduce(
    (acc, s) => {
      acc[s.projectStatus] = (acc[s.projectStatus] ?? 0) + 1;
      return acc;
    },
    {} as Record<ProjectStatus, number>
  );

  // Region distributions
  const regionCounts = stores.reduce(
    (acc, store) => {
      const r = findRegionForCity(store.city, regions);
      const name = r ? r.name : "Diğer";
      acc[name] = (acc[name] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Location Type distributions
  const locationCounts = stores.reduce(
    (acc, s) => {
      acc[s.locationType] = (acc[s.locationType] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Opening Alerts
  const openingSoon = stores.filter(
    (s) => getOpeningAlert(s.openingDate).isOpeningSoon
  ).length;

  const overdue = stores.filter(
    (s) =>
      getOpeningAlert(s.openingDate).isOverdue && s.projectStatus !== "acilis"
  ).length;

  // Upcoming Openings
  const upcomingStores = [...stores]
    .filter((s) => {
      const diffTime = new Date(s.openingDate).getTime() - Date.now();
      return diffTime > 0 && s.projectStatus !== "acilis";
    })
    .sort(
      (a, b) =>
        new Date(a.openingDate).getTime() - new Date(b.openingDate).getTime()
    )
    .slice(0, 4);

  // Recent Updates
  const recentStores = [...stores]
    .sort(
      (a, b) =>
        new Date(b.updatedAt ?? b.createdAt).getTime() -
        new Date(a.updatedAt ?? a.createdAt).getTime()
    )
    .slice(0, 4);

  // Financial calculations
  const totalBudget = stores.reduce((sum, s) => sum + s.totalBudget, 0);
  const totalSpent = Object.values(storeData).reduce((total, sData) => {
    return (
      total +
      (sData.materials ?? []).reduce(
        (sum, m) => sum + m.quantity * m.unitPrice,
        0
      )
    );
  }, 0);

  const formattedSpent = new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(totalSpent);

  return (
    <div className="scrollbar-themed h-[calc(100vh-3.5rem)] overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100 sm:text-2xl">
              Proje Dashboard
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Şantiyelerin genel durumu, bölgesel verileri ve bütçe analizi
            </p>
          </div>
          <Link
            href="/map"
            className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2 text-sm font-medium text-cyan-300 transition-all hover:bg-cyan-500/20"
          >
            Haritaya Git →
          </Link>
        </div>

        {/* Financial Progress & Core Metrics */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Toplam Proje"
            value={stores.length}
            icon={Store}
            color="text-violet-400"
          />
          <MetricCard
            label="Yakında Açılıyor"
            value={openingSoon}
            icon={Clock}
            color="text-red-400"
            animate={openingSoon > 0}
          />
          <MetricCard
            label="Geciken Açılış"
            value={overdue}
            icon={TrendingUp}
            color="text-amber-400"
          />
          <MetricCard
            label="Toplam Malzeme Harcaması"
            value={formattedSpent}
            icon={Coins}
            color="text-emerald-400"
            isString
          />
        </div>

        {/* Primary Distributions Grid */}
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          {/* Status Distribution */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
            <h2 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-violet-400" />
              Durumlara Göre Dağılım
            </h2>
            <div className="mt-4 space-y-3">
              {(Object.keys(projectStatusConfig) as ProjectStatus[]).map(
                (status) => {
                  const count = statusCounts[status] ?? 0;
                  const pct = stores.length
                    ? Math.round((count / stores.length) * 100)
                    : 0;
                  return (
                    <div key={status} className="flex items-center gap-3">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: projectStatusConfig[status].marker,
                        }}
                      />
                      <span className="w-24 shrink-0 text-xs text-zinc-400 sm:w-28 truncate">
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
                      <span className="w-8 shrink-0 text-right text-xs text-zinc-500 font-medium">
                        {count} ({pct}%)
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          </section>

          {/* Region Distribution */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
            <h2 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-cyan-400" />
              Bölgelere Göre Dağılım
            </h2>
            <div className="mt-4 space-y-3">
              {regions.map((region) => {
                const count = regionCounts[region.name] ?? 0;
                const pct = stores.length
                  ? Math.round((count / stores.length) * 100)
                  : 0;
                return (
                  <div key={region.id} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs text-zinc-400 sm:w-28 truncate">
                      {region.name}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-cyan-500/80 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs text-zinc-500 font-medium">
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Secondary Content Grid */}
        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          {/* Upcoming Openings */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
            <h2 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-rose-400" />
              Yaklaşan Açılışlar
            </h2>
            <ul className="mt-4 space-y-2">
              {upcomingStores.length === 0 && (
                <li className="text-sm text-zinc-500 py-3 text-center">
                  Yaklaşan açılış bulunmuyor
                </li>
              )}
              {upcomingStores.map((store) => {
                const diffTime =
                  new Date(store.openingDate).getTime() - Date.now();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return (
                  <li
                    key={store.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-300">
                        {store.name}
                      </p>
                      <p className="text-xs text-zinc-500">{store.city}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-zinc-500">
                        {store.openingDate}
                      </span>
                      <span className="rounded bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-400 border border-rose-500/20">
                        {diffDays} gün kaldı
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Recently Updated */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
            <h2 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-400" />
              Son Güncellenen Projeler
            </h2>
            <ul className="mt-4 space-y-2">
              {recentStores.length === 0 && (
                <li className="text-sm text-zinc-500 py-3 text-center">
                  Henüz proje eklenmemiş
                </li>
              )}
              {recentStores.map((store) => (
                <li
                  key={store.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-300">
                      {store.name}
                    </p>
                    <p className="text-xs text-zinc-500">{store.city}</p>
                  </div>
                  <span
                    className="shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold border"
                    style={{
                      color: projectStatusConfig[store.projectStatus].marker,
                      backgroundColor: `${projectStatusConfig[store.projectStatus].marker}10`,
                      borderColor: `${projectStatusConfig[store.projectStatus].marker}30`,
                    }}
                  >
                    {projectStatusConfig[store.projectStatus].label}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Location Type Distribution */}
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5">
          <h2 className="text-sm font-medium text-zinc-300 flex items-center gap-2 mb-4">
            <Store className="h-4 w-4 text-amber-400" />
            Lokasyon Tipine Göre Dağılım
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {Object.entries(LOCATION_TYPE_LABELS).map(([type, label]) => {
              const count = locationCounts[type] ?? 0;
              const pct = stores.length
                ? Math.round((count / stores.length) * 100)
                : 0;
              return (
                <div
                  key={type}
                  className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 flex flex-col justify-between"
                >
                  <div>
                    <span className="text-xs text-zinc-500">{label}</span>
                    <h3 className="text-xl font-semibold text-zinc-200 mt-1">
                      {count} Proje
                    </h3>
                  </div>
                  <div className="mt-4">
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-zinc-500 mt-1 block">
                      Toplamın %{pct}'si
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

type MetricCardProps = {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  animate?: boolean;
  isString?: boolean;
};

function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  animate,
}: MetricCardProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="mt-1 text-xl font-semibold text-zinc-100">{value}</p>
      </div>
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-950/60 border border-zinc-800 ${color} ${
          animate ? "animate-pulse" : ""
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

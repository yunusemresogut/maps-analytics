"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Activity, Boxes, Ticket as TicketIcon, Users } from "lucide-react";
import { useDb } from "@/contexts/db-context";
import { useI18n, useT } from "@/contexts/i18n-context";
import { daysFromToday, type TicketMetrics } from "@/lib/dashboard-metrics";
import { fetchCertificateCounts, fetchPersonnelCounts } from "@/lib/hr";
import { STATE_LABELS, fetchInventoryCounts, type InventoryState } from "@/lib/inventory";
import { cn } from "@/lib/utils";
import type { ActivityCategory } from "@/types";
import { BarRow, Empty, Panel, SectionTitle } from "@/components/dashboard/dashboard-ui";

const PRIORITY_LABELS = {
  high: "dashboard.operations.priority.high",
  medium: "dashboard.operations.priority.medium",
  low: "dashboard.operations.priority.low",
} as const;
const PRIORITY_BARS = { high: "bg-red-500", medium: "bg-amber-500", low: "bg-zinc-500" } as const;

/** Giriş, yetki ve hesap kayıtları iş akışını göstermez; yönetim panosunda kalır */
const HIDDEN_LOG_CATEGORIES: ActivityCategory[] = ["auth", "user", "permission", "system", "profile", "organization"];

export function OperationsSection({
  tickets,
  showHr,
  showInventory,
  storeName,
}: {
  /** null: talepler modülü kapalı ya da yetki yok */
  tickets: TicketMetrics | null;
  showHr: boolean;
  showInventory: boolean;
  storeName: (id?: string) => string | undefined;
}) {
  const { activityLogs } = useDb();
  const { t, dateLocale } = useI18n();
  const logs = activityLogs.filter((log) => !HIDDEN_LOG_CATEGORIES.includes(log.category)).slice(0, 8);
  const panels = [tickets !== null, showHr || showInventory, logs.length > 0].filter(Boolean).length;
  if (panels === 0) return null;

  return (
    <>
      <SectionTitle title={t("dashboard.operations.title")} description={t("dashboard.operations.description")} />
      <div className={cn("grid gap-4", panels === 3 ? "lg:grid-cols-3" : panels === 2 ? "lg:grid-cols-2" : "")}>
        {tickets && <TicketsPanel stats={tickets} storeName={storeName} />}
        {(showHr || showInventory) && <ResourcesPanel showHr={showHr} showInventory={showInventory} />}
        {logs.length > 0 && (
          <Panel title={t("dashboard.operations.recent.title")} icon={Activity} description={t("dashboard.operations.recent.description")}>
            <ul className="space-y-3">
              {logs.map((log) => (
                <li key={log.id} className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600" />
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-sm text-zinc-300">{log.message}</span>
                    <span className="block text-xs text-zinc-500">
                      {log.actorName} · {formatDistanceToNow(parseISO(log.createdAt), { addSuffix: true, locale: dateLocale })}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </>
  );
}

function TicketsPanel({ stats, storeName }: { stats: TicketMetrics; storeName: (id?: string) => string | undefined }) {
  const t = useT();
  const maxPriority = Math.max(1, ...Object.values(stats.byPriority));
  return (
    <Panel
      title={t("dashboard.operations.tickets.title")}
      icon={TicketIcon}
      description={t("dashboard.operations.tickets.description")}
      href="/tickets"
    >
      <div className="mb-4 grid grid-cols-3 gap-3 text-xs">
        <div>
          <p className="text-zinc-500">{t("dashboard.operations.tickets.open")}</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-zinc-100">{stats.open.length}</p>
        </div>
        <div>
          <p className="text-zinc-500">{t("dashboard.operations.tickets.avgDays")}</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-zinc-100">{stats.avgAgeDays === null
              ? "—"
              : t(stats.avgAgeDays === 1 ? "dashboard.daysOne" : "dashboard.daysOther", { count: stats.avgAgeDays })}</p>
        </div>
        <div title={t("dashboard.operations.tickets.last30Title")}>
          <p className="text-zinc-500">{t("dashboard.operations.tickets.last30")}</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-zinc-100">
            +{stats.created30}
            <span className="text-sm font-normal text-zinc-500"> / −{stats.resolved30}</span>
          </p>
        </div>
      </div>
      {stats.open.length === 0 ? (
        <Empty>{t("dashboard.operations.tickets.empty")}</Empty>
      ) : (
        <>
          <div className="space-y-2">
            {(["high", "medium", "low"] as const).map((priority) => (
              <BarRow
                key={priority}
                label={t("dashboard.operations.priority.label", { priority: t(PRIORITY_LABELS[priority]) })}
                value={stats.byPriority[priority]}
                max={maxPriority}
                barClassName={PRIORITY_BARS[priority]}
              />
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            {stats.ageBuckets.map((bucket) => (
              <div key={bucket.label} className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950/40 px-2 py-1.5 text-center">
                <p className="text-sm font-semibold tabular-nums text-zinc-200">{bucket.count}</p>
                <p className="text-[11px] text-zinc-500">{bucket.label}</p>
              </div>
            ))}
          </div>
          <ul className="mt-3 divide-y divide-zinc-800/70">
            {(stats.mine.length > 0 ? stats.mine : stats.open).slice(0, 4).map((ticket) => {
              const days = -(daysFromToday(ticket.createdAt) ?? 0);
              return (
                <li key={ticket.id}>
                  <Link href={`/tickets/${ticket.id}`} className="flex items-center gap-2 py-1.5 hover:bg-zinc-800/30">
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", PRIORITY_BARS[ticket.priority])} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-zinc-200">{ticket.title}</span>
                      <span className="block truncate text-xs text-zinc-500">
                        {[ticket.code, storeName(ticket.storeId), ticket.assigneeName].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className={cn("shrink-0 text-xs tabular-nums", days > 30 ? "text-red-400" : "text-zinc-500")}>
                      {t(days === 1 ? "dashboard.daysOne" : "dashboard.daysOther", { count: days })}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-1 text-[11px] text-zinc-600">{stats.mine.length > 0 ? t("dashboard.operations.tickets.mine") : t("dashboard.operations.tickets.byPriority")}</p>
        </>
      )}
    </Panel>
  );
}

type HrCounts = { personnel: Awaited<ReturnType<typeof fetchPersonnelCounts>>; certificates: Awaited<ReturnType<typeof fetchCertificateCounts>> };

function ResourcesPanel({ showHr, showInventory }: { showHr: boolean; showInventory: boolean }) {
  const t = useT();
  const [hr, setHr] = useState<HrCounts | null>(null);
  const [inventory, setInventory] = useState<Record<InventoryState, number> | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (showHr) {
      Promise.all([fetchPersonnelCounts(), fetchCertificateCounts()])
        .then(([personnel, certificates]) => !cancelled && setHr({ personnel, certificates }))
        .catch((err) => console.warn("İK özeti yüklenemedi:", err));
    }
    if (showInventory) {
      fetchInventoryCounts()
        .then((counts) => !cancelled && setInventory(counts))
        .catch((err) => console.warn("Envanter özeti yüklenemedi:", err));
    }
    return () => {
      cancelled = true;
    };
  }, [showHr, showInventory]);

  const inventoryTotal = inventory ? inventory.available + inventory.assigned + inventory.maintenance : 0;

  return (
    <Panel
      title={t("dashboard.operations.resources.title")}
      icon={Users}
      description={t("dashboard.operations.resources.description")}
    >
      <div className="space-y-5">
        {showHr && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{t("dashboard.operations.resources.personnelDocs")}</p>
              <Link href="/hr/personnel" className="text-xs text-cyan-400 hover:underline">
                {t("nav.personnel")}
              </Link>
            </div>
            {!hr ? (
              <div className="h-20 animate-pulse rounded-lg bg-zinc-800/40" />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <ResourceStat label={t("dashboard.operations.resources.activePersonnel")} value={hr.personnel.active} href="/hr/personnel" />
                <ResourceStat label={t("dashboard.operations.resources.expiredDocs")} value={hr.certificates.expired ?? 0} tone="critical" href="/hr/certificates" />
                <ResourceStat label={t("dashboard.operations.resources.expiring")} value={hr.certificates.expiring ?? 0} tone="warning" href="/hr/certificates" />
                <ResourceStat label={t("dashboard.operations.resources.pendingDocs")} value={hr.certificates.pending} tone="warning" href="/hr/certificates" />
              </div>
            )}
          </div>
        )}
        {showInventory && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                <Boxes className="h-3.5 w-3.5" />
                {t("nav.inventory")}
              </p>
              <Link href="/inventory" className="text-xs text-cyan-400 hover:underline">
                {t("nav.inventory")}
              </Link>
            </div>
            {!inventory ? (
              <div className="h-16 animate-pulse rounded-lg bg-zinc-800/40" />
            ) : inventoryTotal === 0 ? (
              <Empty>{t("dashboard.operations.resources.noEquipment")}</Empty>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-zinc-500">
                  {t("dashboard.operations.resources.utilization")}{" "}
                  <span className="font-semibold tabular-nums text-zinc-200">
                    {t("dashboard.percent", { value: Math.round((inventory.assigned / inventoryTotal) * 100) })}
                  </span>
                  <span>{t("dashboard.operations.resources.utilizationNote")}</span>
                </p>
                {(["assigned", "available", "maintenance"] as const).map((state) => (
                  <BarRow
                    key={state}
                    label={STATE_LABELS[state]}
                    value={inventory[state]}
                    max={inventoryTotal}
                    barClassName={state === "assigned" ? "bg-cyan-500" : state === "available" ? "bg-emerald-500" : "bg-amber-500"}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}

function ResourceStat({ label, value, tone, href }: { label: string; value: number; tone?: "warning" | "critical"; href: string }) {
  return (
    <Link href={href} className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 transition-colors hover:border-zinc-700">
      <p
        className={cn(
          "text-lg font-semibold tabular-nums",
          value > 0 && tone === "critical" ? "text-red-400" : value > 0 && tone === "warning" ? "text-amber-400" : "text-zinc-100"
        )}
      >
        {value}
      </p>
      <p className="truncate text-[11px] text-zinc-500">{label}</p>
    </Link>
  );
}

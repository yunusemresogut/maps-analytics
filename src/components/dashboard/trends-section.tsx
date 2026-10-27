"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PackageCheck, TrendingUp } from "lucide-react";
import { useI18n, useT } from "@/contexts/i18n-context";
import { formatMoneyCompact, type CurrencyCode } from "@/lib/currency";
import { isOpened, openingCurve, weeklyTickets, workPlanCurve, type CurvePoint, type WorkPlanRow } from "@/lib/dashboard-metrics";
import { fetchMaterialStatusRows, fetchWorkPlanCurveRows, type MaterialStatusRow } from "@/lib/store-details";
import { cn } from "@/lib/utils";
import type { MaterialStatus, Store, Ticket } from "@/types";
import { Select } from "@/components/ui/select";
import { Empty, Panel, SectionTitle } from "@/components/dashboard/dashboard-ui";

export function TrendsSection({
  stores,
  tickets,
  currency,
}: {
  stores: Store[];
  /** null: talepler modülü kapalı ya da yetki yok */
  tickets: Ticket[] | null;
  currency: CurrencyCode;
}) {
  const t = useT();
  return (
    <>
      <SectionTitle title={t("dashboard.trends.title")} description={t("dashboard.trends.description")} />
      <div className="grid gap-4 lg:grid-cols-5">
        <TrendPanel stores={stores} tickets={tickets} />
        <MaterialsPanel stores={stores} currency={currency} />
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Çizgi grafik

type TrendKey = "openings" | "workPlan" | "tickets";

const TREND_META = {
  openings: {
    tab: "dashboard.trends.openings.tab",
    title: "dashboard.trends.openings.title",
    description: "dashboard.trends.openings.description",
  },
  workPlan: {
    tab: "dashboard.trends.workPlan.tab",
    title: "dashboard.trends.workPlan.title",
    description: "dashboard.trends.workPlan.description",
  },
  tickets: {
    tab: "dashboard.trends.tickets.tab",
    title: "dashboard.trends.tickets.title",
    description: "dashboard.trends.tickets.description",
  },
} as const satisfies Record<TrendKey, { tab: string; title: string; description: string }>;

function TrendPanel({ stores, tickets }: { stores: Store[]; tickets: Ticket[] | null }) {
  const t = useT();
  const [tab, setTab] = useState<TrendKey>("openings");
  const tabs: TrendKey[] = tickets ? ["openings", "workPlan", "tickets"] : ["openings", "workPlan"];
  const active = tabs.includes(tab) ? tab : "openings";

  return (
    <Panel className="lg:col-span-3" title={t(TREND_META[active].title)} icon={TrendingUp} description={t(TREND_META[active].description)}>
      <div className="-mt-1 mb-4 inline-flex rounded-lg border border-zinc-800 bg-zinc-950/40 p-0.5">
        {tabs.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors",
              active === key ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            {t(TREND_META[key].tab)}
          </button>
        ))}
      </div>
      {active === "openings" && <OpeningTrend stores={stores} />}
      {active === "workPlan" && <WorkPlanTrend stores={stores} />}
      {active === "tickets" && tickets && <TicketTrend tickets={tickets} />}
    </Panel>
  );
}

function OpeningTrend({ stores }: { stores: Store[] }) {
  const t = useT();
  const curve = useMemo(() => openingCurve(stores), [stores]);
  // Bu ay: gerçekleşen değeri olan son nokta
  const current = [...curve].reverse().find((point) => point.values[1] !== null);
  const gap = current ? (current.values[0] ?? 0) - (current.values[1] ?? 0) : 0;

  if (stores.length === 0) return <Empty>{t("dashboard.trends.openings.noSites")}</Empty>;
  return (
    <>
      <Summary
        items={[
          { label: t("dashboard.trends.openings.plannedToDate"), value: current?.values[0] ?? 0 },
          { label: t("dashboard.trends.openings.opened"), value: current?.values[1] ?? 0 },
          { label: t("dashboard.trends.openings.behindPlan"), value: gap, tone: gap > 0 ? "text-red-400" : "text-emerald-400" },
        ]}
      />
      <LineChart
        points={curve}
        series={[
          { label: t("dashboard.trends.planned"), color: "var(--color-zinc-400)", dashed: true },
          { label: t("dashboard.trends.actual"), color: "var(--color-cyan-500)", area: true },
        ]}
        markerKey={current?.key}
        markerLabel={t("dashboard.trends.openings.thisMonth")}
        format={(value) => t(value === 1 ? "dashboard.trends.openings.sitesOne" : "dashboard.trends.openings.sitesOther", { count: value })}
      />
    </>
  );
}

const ALL_STORES = "all";

function WorkPlanTrend({ stores }: { stores: Store[] }) {
  const { t, locale } = useI18n();
  const [rows, setRows] = useState<WorkPlanRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [storeId, setStoreId] = useState(ALL_STORES);

  useEffect(() => {
    let cancelled = false;
    fetchWorkPlanCurveRows()
      .then((data) => !cancelled && setRows(data))
      .catch((err) => {
        console.warn("İş planı yüklenemedi:", err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // İş planı olan açılmamış sahalar
  const planned = useMemo(() => {
    const ids = new Set((rows ?? []).map((row) => row.storeId));
    return stores.filter((store) => !isOpened(store) && ids.has(store.id)).sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [rows, stores, locale]);
  const selected = planned.some((store) => store.id === storeId) ? storeId : ALL_STORES;
  const curve = useMemo(() => {
    const ids = new Set(selected === ALL_STORES ? planned.map((store) => store.id) : [selected]);
    return workPlanCurve((rows ?? []).filter((row) => ids.has(row.storeId)));
  }, [rows, planned, selected]);

  if (failed) return <Empty>{t("dashboard.trends.workPlan.loadFailed")}</Empty>;
  if (!rows) return <div className="h-64 animate-pulse rounded-lg bg-zinc-800/40" />;
  if (planned.length === 0) return <Empty>{t("dashboard.trends.workPlan.noActive")}</Empty>;

  const deviation = curve.actual - curve.planned;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <Summary
          className="mb-0"
          items={[
            { label: t("dashboard.trends.workPlan.plannedToday"), value: t("dashboard.percent", { value: curve.planned }) },
            { label: t("dashboard.trends.actual"), value: t("dashboard.percent", { value: curve.actual }) },
            {
              label: t("dashboard.trends.workPlan.deviation"),
              value: t("dashboard.trends.workPlan.points", { value: `${deviation > 0 ? "+" : ""}${deviation}` }),
              tone: deviation < -10 ? "text-red-400" : deviation < 0 ? "text-amber-400" : "text-emerald-400",
            },
          ]}
        />
        <Select value={selected} onChange={(e) => setStoreId(e.target.value)} className="h-8 w-auto min-w-[180px] max-w-full" aria-label={t("dashboard.trends.workPlan.siteSelect")}>
          <option value={ALL_STORES}>{t("dashboard.trends.workPlan.allActive", { count: planned.length })}</option>
          {planned.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </Select>
      </div>
      {curve.points.length === 0 ? (
        <Empty>{t("dashboard.trends.workPlan.noDates")}</Empty>
      ) : (
        <LineChart
          points={curve.points}
          series={[
            { label: t("dashboard.trends.planned"), color: "var(--color-zinc-400)", dashed: true },
            { label: t("dashboard.trends.workPlan.actualToday"), color: "var(--color-cyan-500)" },
          ]}
          markerKey={curve.todayKey}
          markerLabel={t("dashboard.today")}
          maxValue={100}
          format={(value) => t("dashboard.percent", { value })}
        />
      )}
      <p className="mt-2 text-[11px] text-zinc-500">{t(curve.itemCount === 1 ? "dashboard.trends.workPlan.itemsOne" : "dashboard.trends.workPlan.itemsOther", { count: curve.itemCount })}</p>
    </>
  );
}

function TicketTrend({ tickets }: { tickets: Ticket[] }) {
  const t = useT();
  const weekly = useMemo(() => weeklyTickets(tickets), [tickets]);
  const created = weekly.reduce((sum, point) => sum + (point.values[0] ?? 0), 0);
  const resolved = weekly.reduce((sum, point) => sum + (point.values[1] ?? 0), 0);
  const net = created - resolved;
  return (
    <>
      <Summary
        items={[
          { label: t("dashboard.trends.tickets.created"), value: created },
          { label: t("dashboard.trends.tickets.resolved"), value: resolved },
          { label: t("dashboard.trends.tickets.netChange"), value: net > 0 ? `+${net}` : net, tone: net > 0 ? "text-amber-400" : "text-emerald-400" },
        ]}
      />
      <LineChart
        points={weekly}
        series={[
          { label: t("dashboard.trends.tickets.opened"), color: "var(--color-amber-500)" },
          { label: t("dashboard.trends.tickets.resolved"), color: "var(--color-cyan-500)", area: true },
        ]}
        format={(value) => t(value === 1 ? "dashboard.trends.tickets.requestsOne" : "dashboard.trends.tickets.requestsOther", { count: value })}
      />
    </>
  );
}

function Summary({ items, className }: { items: { label: string; value: number | string; tone?: string }[]; className?: string }) {
  return (
    <div className={cn("mb-4 flex flex-wrap gap-x-8 gap-y-2", className)}>
      {items.map((item) => (
        <div key={item.label}>
          <p className="text-[11px] text-zinc-500">{item.label}</p>
          <p className={cn("text-xl font-semibold tabular-nums text-zinc-100", item.tone)}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}

type LineSeries = { label: string; color: string; dashed?: boolean; area?: boolean };

const PAD = { top: 12, right: 12, bottom: 26, left: 34 };

function niceStep(max: number, ticks: number) {
  const raw = Math.max(1, max / ticks);
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((n) => n * power).find((n) => n >= raw) ?? raw;
  return Math.max(1, step);
}

/**
 * Tek eksenli çizgi grafiği. Genişliği kapsayıcısından ölçer; üzerine gelince
 * dikey kılavuz ve o noktadaki bütün serilerin değerleri gösterilir.
 */
function LineChart({
  points,
  series,
  format,
  height = 230,
  markerKey,
  markerLabel,
  maxValue,
}: {
  points: CurvePoint[];
  series: LineSeries[];
  format: (value: number) => string;
  height?: number;
  /** Dikey işaret çizgisi (ör. bu ay) */
  markerKey?: string;
  markerLabel?: string;
  /** Sabit eksen üst sınırı (ör. yüzde için 100) */
  maxValue?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const max = Math.max(0, ...points.flatMap((point) => point.values.filter((value): value is number => value !== null)));
  const step = maxValue ? maxValue / 4 : niceStep(max, 4);
  const top = maxValue ?? Math.max(step, Math.ceil(max / step) * step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step);

  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = height - PAD.top - PAD.bottom;
  const x = (index: number) => PAD.left + (points.length > 1 ? (index / (points.length - 1)) * plotW : plotW / 2);
  const y = (value: number) => PAD.top + plotH - (value / top) * plotH;
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(plotW / 58))));

  const lines = series.map((_, seriesIndex) => {
    const defined = points.flatMap((point, index) => (point.values[seriesIndex] === null ? [] : [[x(index), y(point.values[seriesIndex] as number)] as const]));
    const line = defined.map(([px, py], index) => `${index === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
    const area =
      defined.length > 1
        ? `${line} L${defined[defined.length - 1][0].toFixed(1)},${PAD.top + plotH} L${defined[0][0].toFixed(1)},${PAD.top + plotH} Z`
        : "";
    // Komşusu olmayan tek noktalar çizgiyle görünmez; nokta olarak çizilir
    const isolated = points.flatMap((point, index) => {
      const value = point.values[seriesIndex];
      const prev = points[index - 1]?.values[seriesIndex] ?? null;
      const next = points[index + 1]?.values[seriesIndex] ?? null;
      return value !== null && prev === null && next === null ? [[x(index), y(value)] as const] : [];
    });
    return { line, area, isolated };
  });

  const markerIndex = markerKey ? points.findIndex((point) => point.key === markerKey) : -1;
  const onMove = (event: React.PointerEvent<SVGRectElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / Math.max(1, rect.width);
    setHover(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))));
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-xs text-zinc-400">
            <svg width="16" height="6" aria-hidden>
              <line x1="0" y1="3" x2="16" y2="3" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? "4 3" : undefined} strokeLinecap="round" />
            </svg>
            {s.label}
          </span>
        ))}
      </div>
      <div ref={ref} className="relative" style={{ height }}>
        {width > 0 && (
          <svg width={width} height={height} className="block overflow-visible" role="img" aria-label={series.map((s) => s.label).join(", ")}>
            {ticks.map((tick) => (
              <g key={tick}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} className="stroke-zinc-800" strokeDasharray={tick === 0 ? undefined : "3 4"} />
                <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-zinc-500 text-[10px] tabular-nums">
                  {tick}
                </text>
              </g>
            ))}
            {points.map((point, index) =>
              index % labelEvery === 0 || index === points.length - 1 ? (
                <text key={point.key} x={x(index)} y={height - 6} textAnchor="middle" className={cn("text-[10px]", index === hover ? "fill-zinc-200" : "fill-zinc-500")}>
                  {point.label}
                </text>
              ) : null
            )}
            {markerIndex >= 0 && (
              <g>
                <line x1={x(markerIndex)} x2={x(markerIndex)} y1={PAD.top} y2={PAD.top + plotH} className="stroke-zinc-600" strokeDasharray="2 3" />
                <text x={x(markerIndex) + 4} y={PAD.top + 8} className="fill-zinc-500 text-[10px]">
                  {markerLabel}
                </text>
              </g>
            )}
            {lines.map((path, index) =>
              series[index].area && path.area ? <path key={`area-${index}`} d={path.area} fill={series[index].color} fillOpacity={0.1} /> : null
            )}
            {lines.map((path, index) => (
              <path
                key={`line-${index}`}
                d={path.line}
                fill="none"
                stroke={series[index].color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={series[index].dashed ? "5 4" : undefined}
              />
            ))}
            {lines.map((path, index) =>
              path.isolated.map(([cx, cy]) => (
                <circle key={`dot-${index}-${cx}`} cx={cx} cy={cy} r={5} fill={series[index].color} className="stroke-zinc-900" strokeWidth={2} />
              ))
            )}
            {hover !== null && (
              <g>
                <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} className="stroke-zinc-500" />
                {series.map((s, index) => {
                  const value = points[hover].values[index];
                  return value === null ? null : (
                    <circle key={s.label} cx={x(hover)} cy={y(value)} r={4.5} fill={s.color} className="stroke-zinc-900" strokeWidth={2} />
                  );
                })}
              </g>
            )}
            <rect
              x={PAD.left}
              y={PAD.top}
              width={plotW}
              height={plotH}
              fill="transparent"
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
            />
          </svg>
        )}
        {hover !== null && width > 0 && (
          <div
            className="pointer-events-none absolute z-10 min-w-36 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs shadow-lg"
            style={{
              top: PAD.top,
              ...(x(hover) > width / 2 ? { right: width - x(hover) + 10 } : { left: x(hover) + 10 }),
            }}
          >
            <p className="mb-1 font-medium text-zinc-200">{points[hover].label}</p>
            {series.map((s, index) => {
              const value = points[hover].values[index];
              return (
                <p key={s.label} className="flex items-center justify-between gap-4 text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </span>
                  <span className="tabular-nums text-zinc-200">{value === null ? "—" : format(value)}</span>
                </p>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Keşif malzemeleri

const MATERIAL_STATES: { key: MaterialStatus; bar: string }[] = [
  { key: "geldi", bar: "bg-emerald-500" },
  { key: "bekleniyor", bar: "bg-amber-500" },
  { key: "gitti", bar: "bg-cyan-500" },
];

function MaterialsPanel({ stores, currency }: { stores: Store[]; currency: CurrencyCode }) {
  const t = useT();
  const [rows, setRows] = useState<MaterialStatusRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMaterialStatusRows()
      .then((data) => !cancelled && setRows(data))
      .catch((err) => {
        console.warn("Keşif malzemeleri yüklenemedi:", err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const byId = new Map(stores.map((store) => [store.id, store]));
    const scoped = (rows ?? []).filter((row) => byId.has(row.storeId));
    const states = MATERIAL_STATES.map((state) => {
      const group = scoped.filter((row) => row.status === state.key);
      return {
        ...state,
        label: t(`dashboard.trends.materials.state.${state.key}`),
        count: group.length,
        amount: group.filter((row) => row.currency === currency).reduce((sum, row) => sum + row.amount, 0),
      };
    });
    // Açılmamış sahalarda en çok kalemi bekleyenler
    const perStore = new Map<string, Record<MaterialStatus, number>>();
    for (const row of scoped) {
      const counts = perStore.get(row.storeId) ?? { geldi: 0, bekleniyor: 0, gitti: 0 };
      if (row.status in counts) counts[row.status as MaterialStatus] += 1;
      perStore.set(row.storeId, counts);
    }
    const waiting = [...perStore.entries()]
      .map(([id, counts]) => ({ store: byId.get(id)!, counts, total: counts.geldi + counts.bekleniyor + counts.gitti }))
      .filter((item) => item.counts.bekleniyor > 0 && !isOpened(item.store))
      .sort((a, b) => b.counts.bekleniyor - a.counts.bekleniyor)
      .slice(0, 5);
    return { total: scoped.length, storeCount: perStore.size, states, waiting };
  }, [rows, stores, currency, t]);

  const arrived = stats.states[0];
  const arrivedPct = stats.total ? Math.round((arrived.count / stats.total) * 100) : 0;

  return (
    <Panel
      className="lg:col-span-2"
      title={t("dashboard.trends.materials.title")}
      icon={PackageCheck}
      description={t("dashboard.trends.materials.description")}
    >
      {failed ? (
        <Empty>{t("dashboard.trends.materials.loadFailed")}</Empty>
      ) : !rows ? (
        <div className="h-56 animate-pulse rounded-lg bg-zinc-800/40" />
      ) : stats.total === 0 ? (
        <Empty>{t("dashboard.trends.materials.empty")}</Empty>
      ) : (
        <>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-semibold tabular-nums text-zinc-100">{t("dashboard.percent", { value: arrivedPct })}</p>
              <p className="text-xs text-zinc-500">{t("dashboard.trends.materials.arrivedCaption")}</p>
            </div>
            <p className="text-right text-xs text-zinc-500">
              <span className="font-semibold tabular-nums text-zinc-300">{stats.total}</span>{" "}
              {t(stats.total === 1 ? "dashboard.trends.materials.itemsSuffixOne" : "dashboard.trends.materials.itemsSuffixOther")}
              <br />
              <span className="font-semibold tabular-nums text-zinc-300">{stats.storeCount}</span>{" "}
              {t(stats.storeCount === 1 ? "dashboard.trends.materials.sitesSuffixOne" : "dashboard.trends.materials.sitesSuffixOther")}
            </p>
          </div>

          {/* %100 yığılmış çubuk; dilimler arasında 2px boşluk */}
          <div className="mt-4 flex h-3 gap-0.5">
            {stats.states
              .filter((state) => state.count > 0)
              .map((state) => (
                <span
                  key={state.key}
                  title={t(state.count === 1 ? "dashboard.trends.materials.stateTitleOne" : "dashboard.trends.materials.stateTitleOther", {
                    label: state.label,
                    count: state.count,
                  })}
                  className={cn("h-full first:rounded-l-full last:rounded-r-full", state.bar)}
                  style={{ width: `${(state.count / stats.total) * 100}%` }}
                />
              ))}
          </div>

          <ul className="mt-4 space-y-2">
            {stats.states.map((state) => (
              <li key={state.key} className="flex items-center gap-2 text-sm">
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", state.bar)} />
                <span className="flex-1 text-zinc-300">{state.label}</span>
                <span className="tabular-nums text-zinc-200">{state.count}</span>
                <span className="w-10 text-right text-xs tabular-nums text-zinc-500">{t("dashboard.percent", { value: stats.total ? Math.round((state.count / stats.total) * 100) : 0 })}</span>
                <span className="w-20 text-right text-xs tabular-nums text-zinc-500" title={t("dashboard.trends.materials.amountTitle", { currency })}>
                  {formatMoneyCompact(state.amount, currency)}
                </span>
              </li>
            ))}
          </ul>

          {stats.waiting.length > 0 && (
            <div className="mt-5 border-t border-zinc-800/70 pt-4">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500">{t("dashboard.trends.materials.mostWaiting")}</p>
              <ul className="space-y-2.5">
                {stats.waiting.map(({ store, counts, total }) => (
                  <li key={store.id}>
                    <Link href={`/stores/${store.id}`} className="group block">
                      <span className="mb-1 flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-zinc-300 group-hover:text-zinc-100">{store.name}</span>
                        <span className="shrink-0 tabular-nums text-amber-400">{t("dashboard.trends.materials.waitingCount", { count: counts.bekleniyor })}</span>
                      </span>
                      <span className="flex h-1.5 gap-0.5">
                        {MATERIAL_STATES.filter((state) => counts[state.key] > 0).map((state) => (
                          <span
                            key={state.key}
                            className={cn("h-full first:rounded-l-full last:rounded-r-full", state.bar)}
                            style={{ width: `${(counts[state.key] / total) * 100}%` }}
                          />
                        ))}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

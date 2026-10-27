"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDays, format, parseISO } from "date-fns";
import { CalendarRange, Check, ClipboardCheck, ClipboardList, Clock } from "lucide-react";
import { useI18n, useT } from "@/contexts/i18n-context";
import { ON_SITE_STATUSES, daysFromToday, isOpened } from "@/lib/dashboard-metrics";
import { isSunday } from "@/lib/hr";
import { getProjectStatusLabel } from "@/lib/project-status";
import { fetchReportDays } from "@/lib/site-reports";
import { cn } from "@/lib/utils";
import type { Store } from "@/types";
import { Empty, Panel, SectionTitle } from "@/components/dashboard/dashboard-ui";

/** Rapor kapsamında gösterilen gün sayısı */
const REPORT_DAYS = 14;

/** Açılış listesinde gösterilen en çok saha */
const OPENING_LIMIT = 6;

export function PortfolioSection({
  stores,
  showReports,
  showApprovals,
}: {
  stores: Store[];
  showReports: boolean;
  showApprovals: boolean;
}) {
  const t = useT();
  return (
    <>
      <SectionTitle title={t("dashboard.portfolio.title")} description={t("dashboard.portfolio.description")} />
      <div className={cn("grid gap-4", showReports && "lg:grid-cols-2")}>
        <OpeningCountdown stores={stores} />
        {showReports && <ReportCoverage stores={stores} />}
        {showApprovals && <ApprovalsPanel stores={stores} className={showReports ? "lg:col-span-2" : undefined} />}
      </div>
    </>
  );
}

const DISCIPLINES = [
  { key: "architectural", labelKey: "approvals.architectural" },
  { key: "mechanical", labelKey: "approvals.mechanical" },
  { key: "electrical", labelKey: "approvals.electrical" },
] as const;

/** Onay listesinde gösterilen en çok saha */
const APPROVAL_LIMIT = 8;

/** Açılmamış sahalarda eksik disiplin onayları; açılışı en yakın olan üstte */
function ApprovalsPanel({ stores, className }: { stores: Store[]; className?: string }) {
  const t = useT();
  const { pending, counts } = useMemo(() => {
    const pending = stores
      .filter((store) => !isOpened(store))
      .map((store) => ({
        store,
        approved: DISCIPLINES.map((d) => Boolean(store.approvals?.[d.key]?.approved)),
        days: daysFromToday(store.openingDate),
      }))
      .filter((item) => item.approved.some((ok) => !ok))
      .sort((a, b) => (a.days ?? Infinity) - (b.days ?? Infinity));
    return {
      pending,
      counts: DISCIPLINES.map((d, index) => ({ ...d, count: pending.filter((item) => !item.approved[index]).length })),
    };
  }, [stores]);

  return (
    <Panel
      className={className}
      title={t("dashboard.portfolio.approvals.title")}
      icon={ClipboardCheck}
      description={t("dashboard.portfolio.approvals.description")}
      href="/approvals"
    >
      <div className="mb-4 grid grid-cols-3 gap-2">
        {counts.map((discipline) => (
          <div key={discipline.key} className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
            <p className={cn("text-lg font-semibold tabular-nums", discipline.count > 0 ? "text-amber-400" : "text-zinc-100")}>
              {discipline.count}
            </p>
            <p className="truncate text-[11px] text-zinc-500">{t("dashboard.portfolio.approvals.awaiting", { discipline: t(discipline.labelKey) })}</p>
          </div>
        ))}
      </div>

      {pending.length === 0 ? (
        <Empty>{t("dashboard.portfolio.approvals.allApproved")}</Empty>
      ) : (
        <div className="scrollbar-themed -mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
                <th className="pb-2 font-medium">{t("dashboard.portfolio.approvals.site")}</th>
                {DISCIPLINES.map((d) => (
                  <th key={d.key} className="w-24 pb-2 text-center font-medium">
                    {t(d.labelKey)}
                  </th>
                ))}
                <th className="w-24 pb-2 text-right font-medium">{t("dashboard.portfolio.approvals.opening")}</th>
              </tr>
            </thead>
            <tbody>
              {pending.slice(0, APPROVAL_LIMIT).map(({ store, approved, days }) => (
                <tr key={store.id} className="border-t border-zinc-800/70">
                  <td className="max-w-0 py-2 pr-3">
                    <Link href={`/stores/${store.id}`} className="block truncate text-zinc-200 hover:text-zinc-50">
                      {store.name}
                    </Link>
                    <span className="block truncate text-xs text-zinc-500">
                      {store.city} · {getProjectStatusLabel(store.projectStatus, t)}
                    </span>
                  </td>
                  {approved.map((ok, index) => (
                    <td key={DISCIPLINES[index].key} className="py-2 text-center">
                      {ok ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                          <Check className="h-3.5 w-3.5" />
                          {t("dashboard.portfolio.approvals.approved")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400 ring-1 ring-inset ring-amber-500/20">
                          <Clock className="h-3 w-3" />
                          {t("dashboard.portfolio.approvals.pending")}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className={cn("py-2 text-right text-xs tabular-nums", days !== null && days < 0 ? "text-red-400" : "text-zinc-400")}>
                    {days === null
                      ? "—"
                      : days < 0
                        ? t(days === -1 ? "dashboard.portfolio.approvals.overdueOne" : "dashboard.portfolio.approvals.overdueOther", { count: -days })
                        : days === 0
                          ? t("dashboard.today")
                          : t(days === 1 ? "dashboard.daysOne" : "dashboard.daysOther", { count: days })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pending.length > APPROVAL_LIMIT && (
        <p className="mt-3 text-xs text-zinc-500">
          {t(pending.length - APPROVAL_LIMIT === 1 ? "dashboard.portfolio.approvals.moreOne" : "dashboard.portfolio.approvals.moreOther", {
            count: pending.length - APPROVAL_LIMIT,
          })}
        </p>
      )}
    </Panel>
  );
}

function countdownTone(days: number) {
  if (days < 0) return "text-red-400";
  if (days <= 7) return "text-amber-400";
  return "text-zinc-100";
}

/** Açılmamış sahalar, açılışa kalan güne göre: gecikenler en üstte */
function OpeningCountdown({ stores }: { stores: Store[] }) {
  const { t, dateLocale } = useI18n();
  const items = useMemo(
    () =>
      stores
        .filter((store) => !isOpened(store))
        .flatMap((store) => {
          const days = daysFromToday(store.openingDate);
          return days === null ? [] : [{ store, days }];
        })
        .sort((a, b) => a.days - b.days),
    [stores]
  );
  const overdue = items.filter((item) => item.days < 0).length;
  const thisWeek = items.filter((item) => item.days >= 0 && item.days <= 7).length;
  const thisMonth = items.filter((item) => item.days >= 0 && item.days <= 30).length;

  return (
    <Panel
      title={t("dashboard.portfolio.openings.title")}
      icon={CalendarRange}
      description={t("dashboard.portfolio.openings.description")}
      href="/stores"
    >
      <div className="mb-4 grid grid-cols-3 gap-2">
        {[
          { label: t("dashboard.portfolio.openings.overdue"), value: overdue, tone: overdue > 0 ? "text-red-400" : "text-zinc-100" },
          { label: t("dashboard.portfolio.openings.within7"), value: thisWeek, tone: thisWeek > 0 ? "text-amber-400" : "text-zinc-100" },
          { label: t("dashboard.portfolio.openings.within30"), value: thisMonth, tone: "text-zinc-100" },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
            <p className={cn("text-lg font-semibold tabular-nums", item.tone)}>{item.value}</p>
            <p className="truncate text-[11px] text-zinc-500">{item.label}</p>
          </div>
        ))}
      </div>

      {items.length === 0 ? (
        <Empty>{t("dashboard.portfolio.openings.empty")}</Empty>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, OPENING_LIMIT).map(({ store, days }) => {
            const date = parseISO(store.openingDate);
            return (
              <li key={store.id}>
                <Link
                  href={`/stores/${store.id}`}
                  className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 transition-colors hover:border-zinc-700"
                >
                  <span className="flex w-11 shrink-0 flex-col items-center rounded-md bg-zinc-800/70 py-1 leading-none">
                    <span className="text-base font-semibold tabular-nums text-zinc-100">{format(date, "d")}</span>
                    <span className="mt-0.5 text-[10px] uppercase text-zinc-500">{format(date, "MMM", { locale: dateLocale })}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-200">{store.name}</span>
                    <span className="block truncate text-xs text-zinc-500">
                      {[store.district, store.city].filter(Boolean).join(", ")} · {format(date, "EEEE", { locale: dateLocale })}
                    </span>
                  </span>
                  <span className="shrink-0 text-right leading-tight">
                    {days === 0 ? (
                      <span className="text-sm font-semibold text-amber-400">{t("dashboard.today")}</span>
                    ) : (
                      <>
                        <span className={cn("block text-lg font-semibold tabular-nums", countdownTone(days))}>{Math.abs(days)}</span>
                        <span className="block text-[11px] text-zinc-500">{days < 0
                            ? t(days === -1 ? "dashboard.portfolio.openings.daysOverdueOne" : "dashboard.portfolio.openings.daysOverdueOther")
                            : t(days === 1 ? "dashboard.portfolio.openings.daysLeftOne" : "dashboard.portfolio.openings.daysLeftOther")}</span>
                      </>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {items.length > OPENING_LIMIT && (
        <p className="mt-3 text-xs text-zinc-500">
          {t(items.length - OPENING_LIMIT === 1 ? "dashboard.portfolio.openings.moreOne" : "dashboard.portfolio.openings.moreOther", {
            count: items.length - OPENING_LIMIT,
          })}
        </p>
      )}
    </Panel>
  );
}

/** Sahadaki şantiyelerin son 14 günde günlük rapor girilen günleri */
function ReportCoverage({ stores }: { stores: Store[] }) {
  const { t, locale, dateLocale } = useI18n();
  const onSite = useMemo(() => stores.filter((store) => ON_SITE_STATUSES.includes(store.projectStatus)), [stores]);
  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: REPORT_DAYS }, (_, index) => format(addDays(today, index - REPORT_DAYS + 1), "yyyy-MM-dd"));
  }, []);
  const [reported, setReported] = useState<Set<string> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchReportDays(days[0])
      .then((rows) => !cancelled && setReported(new Set(rows.map((row) => `${row.storeId}|${row.reportDate}`))))
      .catch((err) => {
        console.warn("Rapor kapsamı yüklenemedi:", err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  const rows = useMemo(
    () =>
      onSite
        .map((store) => {
          const hits = days.map((day) => reported?.has(`${store.id}|${day}`) ?? false);
          return { store, hits, count: hits.filter(Boolean).length };
        })
        .sort((a, b) => a.count - b.count || a.store.name.localeCompare(b.store.name, locale)),
    [onSite, days, reported, locale]
  );
  const today = days[days.length - 1];
  const reportedToday = rows.filter((row) => row.hits[row.hits.length - 1]).length;
  const coverage = rows.length ? Math.round((rows.reduce((sum, row) => sum + row.count, 0) / (rows.length * REPORT_DAYS)) * 100) : 0;

  return (
    <Panel
      title={t("dashboard.portfolio.reports.title")}
      icon={ClipboardList}
      description={t("dashboard.portfolio.reports.description", { days: REPORT_DAYS })}
      href="/reports"
      hrefLabel={t("nav.reports")}
    >
      {failed ? (
        <Empty>{t("dashboard.portfolio.reports.loadFailed")}</Empty>
      ) : onSite.length === 0 ? (
        <Empty>{t("dashboard.portfolio.reports.noneOnSite")}</Empty>
      ) : !reported ? (
        <div className="h-32 animate-pulse rounded-lg bg-zinc-800/40" />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-500">
            <span>
              {t("dashboard.portfolio.reports.todayLabel")}{" "}
              <span className="font-semibold tabular-nums text-zinc-200">
                {reportedToday}/{rows.length}
              </span>{" "}
              {t("dashboard.portfolio.reports.todaySuffix")}
            </span>
            <span>
              {t("dashboard.portfolio.reports.coverage", { days: REPORT_DAYS })}{" "}
              <span className="font-semibold tabular-nums text-zinc-200">{t("dashboard.percent", { value: coverage })}</span>
            </span>
          </div>
          <div className="scrollbar-themed -mx-1 overflow-x-auto px-1 pb-1">
            <div
              className="grid min-w-[26rem] items-center gap-[3px]"
              style={{ gridTemplateColumns: `minmax(6rem, 1fr) repeat(${REPORT_DAYS}, minmax(14px, 20px)) 2.75rem` }}
            >
              <span />
              {days.map((day) => (
                <span
                  key={day}
                  className={cn(
                    "text-center text-[10px] tabular-nums leading-5",
                    day === today ? "font-semibold text-zinc-200" : isSunday(day) ? "text-zinc-700" : "text-zinc-500"
                  )}
                >
                  {Number(day.slice(8))}
                </span>
              ))}
              <span />
              {rows.slice(0, 10).map((row) => (
                <Fragment key={row.store.id}>
                  <Link
                    href={`/stores/${row.store.id}`}
                    title={row.store.name}
                    className="min-w-0 truncate pr-2 text-xs text-zinc-400 hover:text-zinc-200"
                  >
                    {row.store.name}
                  </Link>
                  {row.hits.map((hit, index) => (
                    <span
                      key={days[index]}
                      title={`${row.store.name} · ${format(parseISO(days[index]), "d MMMM EEEE", { locale: dateLocale })}: ${
                        hit ? t("dashboard.portfolio.reports.reported") : t("dashboard.portfolio.reports.notReported")
                      }`}
                      className={cn("aspect-square w-full rounded-[4px]", hit ? "bg-cyan-500" : "bg-zinc-800/70")}
                    />
                  ))}
                  <span className={cn("text-right text-[11px] tabular-nums", row.count === 0 ? "text-red-400" : "text-zinc-500")}>
                    {row.count}/{REPORT_DAYS}
                  </span>
                </Fragment>
              ))}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-4 text-[11px] text-zinc-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-cyan-500" /> {t("dashboard.portfolio.reports.legendReported")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-zinc-800" /> {t("dashboard.portfolio.reports.legendNotReported")}
            </span>
            {rows.length > 10 && (
              <span>
                {t(rows.length - 10 === 1 ? "dashboard.portfolio.reports.moreOne" : "dashboard.portfolio.reports.moreOther", {
                  count: rows.length - 10,
                })}
              </span>
            )}
          </div>
        </>
      )}
    </Panel>
  );
}

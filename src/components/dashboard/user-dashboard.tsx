"use client";

import { useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Gauge,
  HardHat,
  Map as MapIcon,
  Ticket as TicketIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useI18n } from "@/contexts/i18n-context";
import { useDb } from "@/contexts/db-context";
import { useRegions } from "@/contexts/regions-context";
import { useSettings } from "@/contexts/settings-context";
import { useStores } from "@/contexts/stores-context";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { Select } from "@/components/ui/select";
import { findRegionForCity } from "@/data/regions";
import { portfolioMetrics, ticketMetrics } from "@/lib/dashboard-metrics";
import { canAccessRoute, canModule } from "@/lib/permissions";
import type { AppModuleKey } from "@/types";
import { Kpi } from "@/components/dashboard/dashboard-ui";
import { PortfolioSection } from "@/components/dashboard/portfolio-section";
import { TrendsSection } from "@/components/dashboard/trends-section";
import { OperationsSection } from "@/components/dashboard/operations-section";

const OTHER_REGION = "__other";

function greetingKey(hour: number) {
  if (hour < 6) return "dashboard.greeting.night" as const;
  if (hour < 12) return "dashboard.greeting.morning" as const;
  if (hour < 18) return "dashboard.greeting.afternoon" as const;
  return "dashboard.greeting.evening" as const;
}

export function UserDashboard() {
  const { user } = useAuth();
  const { t, dateLocale } = useI18n();
  const { stores } = useStores();
  const { regions } = useRegions();
  const { storeSummaries, tickets } = useDb();
  const { org, isModuleEnabled } = useSettings();
  const [region, setRegion] = usePersistentState("dashboard", "region", "all");

  const can = (module: AppModuleKey, enabledKey?: string) =>
    canModule(user, module, "view") && (!enabledKey || isModuleEnabled(enabledKey));
  const access = {
    stores: can("stores") || can("map"),
    approvals: can("approvals"),
    reports: canAccessRoute(user, "reports"),
    tickets: can("tickets", "tickets"),
    hr: can("personnel") && isModuleEnabled("hr"),
    inventory: can("inventory"),
  };
  const currency = org.defaults.currency;

  // Bölge filtresi sahaları ve sahaya bağlı talepleri daraltır; sahasız talepler yalnızca "Tüm bölgeler"de sayılır
  const scope = useMemo(() => {
    const regionOf = (city: string) => findRegionForCity(city, regions)?.id ?? OTHER_REGION;
    const scopedStores = region === "all" ? stores : stores.filter((store) => regionOf(store.city) === region);
    const ids = new Set(scopedStores.map((store) => store.id));
    return {
      stores: scopedStores,
      tickets: region === "all" ? tickets : tickets.filter((ticket) => ticket.storeId && ids.has(ticket.storeId)),
      regionOf,
    };
  }, [region, regions, stores, tickets]);

  const portfolio = useMemo(() => portfolioMetrics(scope.stores, storeSummaries), [scope.stores, storeSummaries]);
  const ticketStats = useMemo(() => ticketMetrics(scope.tickets, user?.id), [scope.tickets, user?.id]);

  const regionsWithOther = regions.length > 0 && stores.some((store) => scope.regionOf(store.city) === OTHER_REGION);
  const now = new Date();
  const firstName = user?.name?.split(" ")[0] ?? "";
  const nextOpening = portfolio.openingNext30[0];

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      {/* Başlık */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-zinc-500">{format(now, "d MMMM yyyy, EEEE", { locale: dateLocale })}</p>
          <h1 className="mt-1 text-xl font-semibold text-zinc-100 sm:text-2xl">
            {t(greetingKey(now.getHours()))}
            {firstName && `, ${firstName}`}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {[
              t(portfolio.total === 1 ? "dashboard.summary.sitesOne" : "dashboard.summary.sitesOther", { count: portfolio.total }),
              t(portfolio.active === 1 ? "dashboard.summary.activeOne" : "dashboard.summary.activeOther", { count: portfolio.active }),
              t(portfolio.onSite === 1 ? "dashboard.summary.onSiteOne" : "dashboard.summary.onSiteOther", { count: portfolio.onSite }),
            ].join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {regions.length > 0 && (
            <Select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="h-9 w-auto min-w-[170px]"
              aria-label={t("dashboard.regionFilter")}
            >
              <option value="all">{t("dashboard.allRegions")}</option>
              {regions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
              {regionsWithOther && <option value={OTHER_REGION}>{t("dashboard.outsideRegions")}</option>}
            </Select>
          )}
          {can("map") && (
            <Link
              href="/map"
              className="flex h-9 items-center gap-2 rounded-lg border border-zinc-800 px-3 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-900"
            >
              <MapIcon className="h-4 w-4" />
              {t("nav.map")}
            </Link>
          )}
        </div>
      </div>

      {/* Ana göstergeler */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi
          label={t("dashboard.kpi.activeProjects")}
          value={portfolio.active}
          icon={HardHat}
          hint={t("dashboard.kpi.activeHint", { onSite: portfolio.onSite, opened: portfolio.opened })}
          href={access.stores ? "/stores" : undefined}
        />
        <Kpi
          label={t("dashboard.kpi.openingIn30")}
          value={portfolio.openingNext30.length}
          icon={CalendarClock}
          tone={portfolio.openingNext30.length > 0 ? "warning" : "default"}
          hint={nextOpening ? t("dashboard.kpi.nextOpening", { name: nextOpening.name }) : t("dashboard.kpi.noPlannedOpening")}
        />
        <Kpi
          label={t("dashboard.kpi.overdueOpenings")}
          value={portfolio.overdue.length}
          icon={AlertTriangle}
          tone={portfolio.overdue.length > 0 ? "critical" : "good"}
          hint={t("dashboard.kpi.overdueHint")}
        />
        <Kpi
          label={t("dashboard.kpi.siteProgress")}
          value={portfolio.onSiteAvgProgress === null ? "—" : t("dashboard.percent", { value: portfolio.onSiteAvgProgress })}
          icon={Gauge}
          hint={
            portfolio.onSiteWithPlan > 0
              ? t(portfolio.onSiteWithPlan === 1 ? "dashboard.kpi.progressHintOne" : "dashboard.kpi.progressHintOther", {
                  count: portfolio.onSiteWithPlan,
                })
              : t("dashboard.kpi.noWorkPlan")
          }
        />
        {access.tickets ? (
          <Kpi
            label={t("dashboard.kpi.openTickets")}
            value={ticketStats.open.length}
            icon={TicketIcon}
            tone={ticketStats.byPriority.high > 0 ? "warning" : "default"}
            hint={t("dashboard.kpi.ticketsHint", { high: ticketStats.byPriority.high, mine: ticketStats.mine.length })}
            href="/tickets"
          />
        ) : (
          <Kpi
            label={t("dashboard.kpi.openedSites")}
            value={portfolio.opened}
            icon={CheckCircle2}
            tone="good"
            hint={t("dashboard.kpi.openedHint")}
          />
        )}
      </div>

      <PortfolioSection stores={scope.stores} showReports={access.reports} showApprovals={access.approvals} />

      <TrendsSection stores={scope.stores} tickets={access.tickets ? scope.tickets : null} currency={currency} />

      <OperationsSection
        tickets={access.tickets ? ticketStats : null}
        showHr={access.hr}
        showInventory={access.inventory}
        storeName={(id) => stores.find((store) => store.id === id)?.name}
      />
    </div>
  );
}

import { addDays, addMonths, addWeeks, differenceInCalendarDays, format, isValid, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { getDateLocale, t } from "@/i18n/runtime";
import type {
  ProjectStatus,
  Store,
  StoreDetailSummary,
  Ticket,
  TicketPriority,
} from "@/types";

/**
 * Kullanıcı panosunun hesapları. Hepsi saf fonksiyondur; bileşen yalnızca
 * görünür veriyi (RLS ve bölge filtresi sonrası) verir.
 */

/** Saha yaşam döngüsü sırası */
export const LIFECYCLE: ProjectStatus[] = ["proje", "ihale", "santiye", "yakinda_aciliyor", "acilis", "hakedis", "fatura"];

/** Açılışı yapılmış sayılan durumlar; hakediş ve fatura açılıştan sonra gelir */
export const OPENED_STATUSES: ProjectStatus[] = ["acilis", "hakedis", "fatura"];

export function isOpened(store: Pick<Store, "projectStatus">): boolean {
  return OPENED_STATUSES.includes(store.projectStatus);
}

/** Sahada iş süren durumlar (günlük rapor beklenir) */
export const ON_SITE_STATUSES: ProjectStatus[] = ["santiye", "yakinda_aciliyor"];

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const date = parseISO(value);
  return isValid(date) ? date : null;
}

export function daysFromToday(value?: string, today = new Date()): number | null {
  const date = parseDate(value);
  return date ? differenceInCalendarDays(date, today) : null;
}

// ---------------------------------------------------------------- Portföy

export type PortfolioMetrics = {
  total: number;
  active: number;
  opened: number;
  onSite: number;
  byStatus: Record<ProjectStatus, number>;
  /** Açılmamış ve tarihi 0–30 gün içinde olanlar */
  openingNext30: Store[];
  /** Açılmamış ve tarihi geçmiş olanlar */
  overdue: Store[];
  /** Sahadaki işlerin iş planı ilerleme ortalaması; plan yoksa null */
  onSiteAvgProgress: number | null;
  onSiteWithPlan: number;
};

export function portfolioMetrics(stores: Store[], summaries: Record<string, StoreDetailSummary>): PortfolioMetrics {
  const byStatus = Object.fromEntries(LIFECYCLE.map((status) => [status, 0])) as Record<ProjectStatus, number>;
  const openingNext30: Store[] = [];
  const overdue: Store[] = [];
  const progress: number[] = [];

  for (const store of stores) {
    byStatus[store.projectStatus] = (byStatus[store.projectStatus] ?? 0) + 1;
    if (isOpened(store)) continue;
    const days = daysFromToday(store.openingDate);
    if (days !== null && days < 0) overdue.push(store);
    else if (days !== null && days <= 30) openingNext30.push(store);
    if (ON_SITE_STATUSES.includes(store.projectStatus)) {
      const avg = summaries[store.id]?.workPlanAvgProgress;
      if (avg !== null && avg !== undefined) progress.push(avg);
    }
  }

  const byDate = (a: Store, b: Store) => a.openingDate.localeCompare(b.openingDate);
  const opened = stores.filter(isOpened).length;
  return {
    total: stores.length,
    active: stores.length - opened,
    opened,
    onSite: ON_SITE_STATUSES.reduce((sum, status) => sum + byStatus[status], 0),
    byStatus,
    openingNext30: openingNext30.sort(byDate),
    overdue: overdue.sort(byDate),
    onSiteAvgProgress: progress.length ? Math.round(progress.reduce((a, b) => a + b, 0) / progress.length) : null,
    onSiteWithPlan: progress.length,
  };
}

// ---------------------------------------------------------------- Açılış eğrisi

export type CurvePoint = { key: string; label: string; values: (number | null)[] };

/**
 * Aylık birikimli açılış eğrisi: `past` ay öncesinden `ahead` ay sonrasına.
 * Planlanan: o ayın sonuna kadar açılış tarihi gelmiş bütün sahalar.
 * Gerçekleşen: bunlardan açılmış olanlar; gelecek aylar için boştur.
 */
export function openingCurve(stores: Store[], past = 6, ahead = 6, today = new Date()): CurvePoint[] {
  const start = startOfMonth(today);
  const currentKey = format(start, "yyyy-MM");
  return Array.from({ length: past + ahead + 1 }, (_, index) => {
    const key = format(addMonths(start, index - past), "yyyy-MM");
    const due = stores.filter((store) => store.openingDate && store.openingDate.slice(0, 7) <= key);
    return {
      key,
      label: format(parseISO(`${key}-01`), "MMM yy", { locale: getDateLocale() }),
      values: [due.length, key <= currentKey ? due.filter(isOpened).length : null],
    };
  });
}

// ---------------------------------------------------------------- İş planı eğrisi

export type WorkPlanRow = { storeId: string; startDate: string; endDate: string; percentComplete: number };

export type WorkPlanCurve = {
  points: CurvePoint[];
  /** Bugünkü noktanın anahtarı (işaret çizgisi) */
  todayKey?: string;
  /** Bugün itibarıyla planlanan ve gerçekleşen ilerleme, % */
  planned: number;
  actual: number;
  itemCount: number;
};

/**
 * İş planı S eğrisi. Her kalemin planlanan ilerlemesi başlangıç–bitiş arasında
 * doğrusal varsayılır; kalemler süreleriyle (gün) ağırlıklandırılır.
 * Gerçekleşen ilerlemenin geçmişi tutulmadığından yalnızca bugün için vardır.
 */
export function workPlanCurve(rows: WorkPlanRow[], today = new Date()): WorkPlanCurve {
  const items = rows.flatMap((row) => {
    const start = parseDate(row.startDate.slice(0, 10));
    const end = parseDate(row.endDate.slice(0, 10));
    if (!start || !end || end < start) return [];
    return [{ start, end, weight: differenceInCalendarDays(end, start) + 1, progress: row.percentComplete }];
  });
  if (items.length === 0) return { points: [], planned: 0, actual: 0, itemCount: 0 };

  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  const plannedAt = (date: Date) =>
    (items.reduce((sum, item) => {
      const elapsed = differenceInCalendarDays(date, item.start) + 1;
      return sum + item.weight * Math.min(1, Math.max(0, elapsed / item.weight));
    }, 0) /
      totalWeight) *
    100;
  const actual = items.reduce((sum, item) => sum + item.weight * item.progress, 0) / totalWeight;

  const first = new Date(Math.min(...items.map((item) => item.start.getTime())));
  const last = new Date(Math.max(...items.map((item) => item.end.getTime())));
  const weekly = differenceInCalendarDays(last, first) <= 120;
  // Dönem başlangıçları; her nokta dönemin sonundaki planlanan değeri taşır
  const periods: Date[] = [];
  for (
    let cursor = weekly ? startOfWeek(first, { weekStartsOn: 1 }) : startOfMonth(first);
    cursor <= last;
    cursor = weekly ? addWeeks(cursor, 1) : addMonths(cursor, 1)
  ) {
    periods.push(cursor);
  }
  const periodEnd = (start: Date) => addDays(weekly ? addWeeks(start, 1) : addMonths(start, 1), -1);
  // Bugün aralığın dışındaysa en yakın uca konur
  const found = periods.findIndex((start) => today >= start && today <= periodEnd(start));
  const todayIndex = found !== -1 ? found : today < first ? 0 : periods.length - 1;

  const points: CurvePoint[] = periods.map((start, index) => ({
    key: format(start, "yyyy-MM-dd"),
    label: format(start, weekly ? "d MMM" : "MMM yy", { locale: getDateLocale() }),
    values: [
      Math.round(index === todayIndex ? plannedAt(today) : plannedAt(periodEnd(start))),
      index === todayIndex ? Math.round(actual) : null,
    ],
  }));
  return {
    points,
    todayKey: points[todayIndex]?.key,
    planned: Math.round(plannedAt(today)),
    actual: Math.round(actual),
    itemCount: items.length,
  };
}

// ---------------------------------------------------------------- Talepler

export type TicketMetrics = {
  open: Ticket[];
  byPriority: Record<TicketPriority, number>;
  /** Açık taleplerin açılıştan bu yana geçen günü: 0–7, 8–30, 30+ */
  ageBuckets: { label: string; count: number }[];
  /** Açık taleplerin ortalama açık kaldığı gün */
  avgAgeDays: number | null;
  mine: Ticket[];
  /** Son 30 günde açılan / çözülen (çözülme tarihi olarak son güncelleme alınır) */
  created30: number;
  resolved30: number;
};

export function ticketMetrics(tickets: Ticket[], userId: string | undefined, today = new Date()): TicketMetrics {
  const open = tickets.filter((ticket) => ticket.status === "open" || ticket.status === "in_progress");
  const ages = open.map((ticket) => -(daysFromToday(ticket.createdAt, today) ?? 0));
  const priorityOrder: Record<TicketPriority, number> = { high: 0, medium: 1, low: 2 };
  const within30 = (date?: string) => {
    const days = daysFromToday(date, today);
    return days !== null && days <= 0 && days >= -30;
  };
  return {
    open: [...open].sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || a.createdAt.localeCompare(b.createdAt)
    ),
    byPriority: {
      high: open.filter((ticket) => ticket.priority === "high").length,
      medium: open.filter((ticket) => ticket.priority === "medium").length,
      low: open.filter((ticket) => ticket.priority === "low").length,
    },
    ageBuckets: [
      { label: t("dashboard.operations.tickets.ageBucket.week"), count: ages.filter((age) => age <= 7).length },
      { label: t("dashboard.operations.tickets.ageBucket.month"), count: ages.filter((age) => age > 7 && age <= 30).length },
      { label: t("dashboard.operations.tickets.ageBucket.older"), count: ages.filter((age) => age > 30).length },
    ],
    avgAgeDays: ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : null,
    mine: open.filter((ticket) => ticket.assigneeId === userId),
    created30: tickets.filter((ticket) => within30(ticket.createdAt)).length,
    resolved30: tickets.filter(
      (ticket) => (ticket.status === "resolved" || ticket.status === "closed") && within30(ticket.updatedAt ?? ticket.createdAt)
    ).length,
  };
}

/**
 * Son `weeks` haftada (pazartesi başlangıçlı) açılan ve çözülen/kapatılan
 * talepler. Ayrı çözülme tarihi tutulmadığından son güncelleme tarihi alınır.
 */
export function weeklyTickets(tickets: Ticket[], weeks = 12, today = new Date()): CurvePoint[] {
  const first = startOfWeek(addWeeks(today, -(weeks - 1)), { weekStartsOn: 1 });
  const points = Array.from({ length: weeks }, (_, index) => {
    const weekStart = addWeeks(first, index);
    return { key: format(weekStart, "yyyy-MM-dd"), label: format(weekStart, "d MMM", { locale: getDateLocale() }), values: [0, 0] };
  });
  const bucket = (date?: string) => {
    const parsed = parseDate(date);
    if (!parsed) return undefined;
    const index = Math.floor(differenceInCalendarDays(parsed, first) / 7);
    return index >= 0 && index < weeks ? points[index] : undefined;
  };
  for (const ticket of tickets) {
    const created = bucket(ticket.createdAt);
    if (created) created.values[0] += 1;
    if (ticket.status === "resolved" || ticket.status === "closed") {
      const resolved = bucket(ticket.updatedAt ?? ticket.createdAt);
      if (resolved) resolved.values[1] += 1;
    }
  }
  return points;
}

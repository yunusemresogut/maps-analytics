import { differenceInDays, isPast, parseISO } from "date-fns";
import type { OpeningStatus } from "@/types";

const OPENING_SOON_DAYS = 30;

export function getOpeningStatus(openingDate: string): OpeningStatus {
  const date = parseISO(openingDate);
  const today = new Date();

  if (isPast(date)) return "open";

  const daysUntil = differenceInDays(date, today);
  if (daysUntil <= OPENING_SOON_DAYS) return "opening_soon";

  return "planned";
}

export const openingStatusConfig: Record<
  OpeningStatus,
  { label: string; color: string; marker: string }
> = {
  open: {
    label: "Açıldı",
    color: "text-emerald-400",
    marker: "#34d399",
  },
  opening_soon: {
    label: "Yakında Açılıyor",
    color: "text-red-400",
    marker: "#f87171",
  },
  planned: {
    label: "Planlanan Açılış",
    color: "text-violet-400",
    marker: "#a78bfa",
  },
};

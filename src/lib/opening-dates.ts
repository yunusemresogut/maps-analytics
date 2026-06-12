import { differenceInDays, isPast, parseISO } from "date-fns";

const OPENING_SOON_DAYS = 30;

export type OpeningAlert = {
  isOpeningSoon: boolean;
  isOverdue: boolean;
  daysUntilOpening: number;
  daysSinceOpening: number;
  label: string;
};

export function getOpeningAlert(openingDate: string): OpeningAlert {
  const date = parseISO(openingDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysUntil = differenceInDays(date, today);
  const daysSince = differenceInDays(today, date);

  if (isPast(date)) {
    return {
      isOpeningSoon: false,
      isOverdue: daysSince > 0,
      daysUntilOpening: daysUntil,
      daysSinceOpening: daysSince,
      label: daysSince === 0 ? "Bugün açıldı" : `${daysSince} gün önce açıldı`,
    };
  }

  if (daysUntil <= OPENING_SOON_DAYS) {
    return {
      isOpeningSoon: true,
      isOverdue: false,
      daysUntilOpening: daysUntil,
      daysSinceOpening: 0,
      label:
        daysUntil === 0
          ? "Bugün açılıyor"
          : `${daysUntil} gün sonra açılıyor`,
    };
  }

  return {
    isOpeningSoon: false,
    isOverdue: false,
    daysUntilOpening: daysUntil,
    daysSinceOpening: 0,
    label: `${daysUntil} gün sonra açılıyor`,
  };
}

export function shouldHighlightRed(openingDate: string): boolean {
  return getOpeningAlert(openingDate).isOpeningSoon;
}

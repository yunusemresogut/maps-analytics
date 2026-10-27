import { differenceInDays, isPast, parseISO } from "date-fns";
import { t } from "@/i18n/runtime";

const OPENING_SOON_DAYS = 7;

export type OpeningAlert = {
  isOpeningSoon: boolean;
  isOverdue: boolean;
  daysUntilOpening: number;
  daysSinceOpening: number;
  label: string;
};

function opensIn(days: number) {
  return t(days === 1 ? "shell.openingAlert.opensInDaysOne" : "shell.openingAlert.opensInDaysOther", { count: days });
}

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
      label:
        daysSince === 0
          ? t("shell.openingAlert.openedToday")
          : t(daysSince === 1 ? "shell.openingAlert.openedDaysAgoOne" : "shell.openingAlert.openedDaysAgoOther", {
              count: daysSince,
            }),
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
          ? t("shell.openingAlert.opensToday")
          : opensIn(daysUntil),
    };
  }

  return {
    isOpeningSoon: false,
    isOverdue: false,
    daysUntilOpening: daysUntil,
    daysSinceOpening: 0,
    label: opensIn(daysUntil),
  };
}

export function shouldHighlightRed(openingDate: string): boolean {
  const alert = getOpeningAlert(openingDate);
  // Açılışa 7 gün veya daha az kaldığında kırmızıya düşür
  return alert.isOpeningSoon && alert.daysUntilOpening <= 7;
}

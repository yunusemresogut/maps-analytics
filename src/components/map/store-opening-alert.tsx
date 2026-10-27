"use client";

import { AlertTriangle, Clock } from "lucide-react";
import { getOpeningAlert } from "@/lib/opening-dates";
import { cn } from "@/lib/utils";
import type { Store } from "@/types";
import { t } from "@/i18n/runtime";

type StoreOpeningAlertProps = {
  store: Store;
  compact?: boolean;
  className?: string;
};

export function StoreOpeningAlert({
  store,
  compact = false,
  className,
}: StoreOpeningAlertProps) {
  const openingAlert = getOpeningAlert(store.openingDate);
  const isOverdue =
    openingAlert.isOverdue && store.projectStatus !== "acilis";
  const isSoon = openingAlert.isOpeningSoon;

  if (!isOverdue && !isSoon) return null;

  const message = isOverdue
    ? t(openingAlert.daysSinceOpening === 1 ? "site.opening.overdueDaysOne" : "site.opening.overdueDaysOther", {
        count: openingAlert.daysSinceOpening,
      })
    : openingAlert.label;

  const title = isOverdue ? t("site.opening.overdueTitle") : t("site.opening.soonTitle");
  const Icon = isOverdue ? Clock : AlertTriangle;

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
          isOverdue
            ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
            : "border-red-500/30 bg-red-500/10 text-red-300",
          className
        )}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{message}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border p-3 text-sm",
        isOverdue
          ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
          : "border-red-500/30 bg-red-500/10 text-red-300",
        className
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-xs opacity-90">{message}</p>
      </div>
    </div>
  );
}

/** Header badge metni — yakında / gecikme */
export function storeOpeningBadgeLabel(store: Store): string | null {
  const openingAlert = getOpeningAlert(store.openingDate);
  if (openingAlert.isOverdue && store.projectStatus !== "acilis") {
    return t(openingAlert.daysSinceOpening === 1 ? "site.opening.badgeOverdueOne" : "site.opening.badgeOverdueOther", {
      count: openingAlert.daysSinceOpening,
    });
  }
  if (openingAlert.isOpeningSoon) {
    return openingAlert.daysUntilOpening === 0
      ? t("site.opening.badgeToday")
      : t(openingAlert.daysUntilOpening === 1 ? "site.opening.badgeLeftOne" : "site.opening.badgeLeftOther", {
          count: openingAlert.daysUntilOpening,
        });
  }
  return null;
}

export function storeOpeningIsOverdue(store: Store): boolean {
  const openingAlert = getOpeningAlert(store.openingDate);
  return openingAlert.isOverdue && store.projectStatus !== "acilis";
}

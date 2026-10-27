"use client";

import { format, parseISO } from "date-fns";
import { Clock, User } from "lucide-react";
import type { AuditInfo } from "@/types";
import { useI18n } from "@/contexts/i18n-context";

type AuditLogSectionProps = {
  audit: AuditInfo;
};

export function AuditLogSection({ audit }: AuditLogSectionProps) {
  const { t, dateLocale } = useI18n();
  return (
    <section className="rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
        {t("site.audit.title")}
      </p>
      <div className="space-y-1.5 text-xs text-zinc-400">
        <p className="flex items-center gap-1.5">
          <User className="h-3 w-3 text-zinc-600" />
          {t("site.audit.createdBy")}{" "}
          <span className="text-zinc-300">{audit.createdByName}</span>
          <span className="text-zinc-600">·</span>
          <Clock className="h-3 w-3 text-zinc-600" />
          {format(parseISO(audit.createdAt), "d MMM yyyy, HH:mm", {
            locale: dateLocale,
          })}
        </p>
        {audit.updatedByName && audit.updatedAt && (
          <p className="flex items-center gap-1.5">
            <User className="h-3 w-3 text-zinc-600" />
            {t("site.audit.updatedBy")}{" "}
            <span className="text-zinc-300">{audit.updatedByName}</span>
            <span className="text-zinc-600">·</span>
            {format(parseISO(audit.updatedAt), "d MMM yyyy, HH:mm", {
              locale: dateLocale,
            })}
          </p>
        )}
      </div>
    </section>
  );
}

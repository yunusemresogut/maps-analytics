"use client";

import { TruncateWithTooltip } from "@/components/ui/truncate-with-tooltip";
import { ImportMenu } from "@/components/map/import-menu";
import {
  downloadWorkPlanTemplate,
  parseWorkPlanFile,
  responsibleLabel,
  type ParsedWorkPlanRow,
} from "@/lib/excel-work-plan";
import { t } from "@/i18n/runtime";
import type { TranslationKey } from "@/i18n";
import type { WorkPlanStatus } from "@/types";

const WORK_PLAN_STATUS_KEYS: Record<WorkPlanStatus, TranslationKey> = {
  yapilacak: "site.workPlan.status.yapilacak",
  devam_ediyor: "site.workPlan.status.devam_ediyor",
  tamamlandi: "site.workPlan.status.tamamlandi",
};

type WorkPlanImportMenuProps = {
  existingCount: number;
  onImport: (items: ParsedWorkPlanRow[]) => void;
};

async function parseWorkPlan(file: File) {
  const result = await parseWorkPlanFile(file);
  const columns = result.matchedColumns;
  return {
    rows: result.items,
    error: result.errors.join(" · "),
    info: [
      columns.description &&
        t("site.import.workPlan.mapping", { column: t("site.import.workPlan.description"), source: columns.description }),
      columns.startDate &&
        t("site.import.workPlan.mapping", { column: t("site.import.workPlan.start"), source: columns.startDate }),
      columns.endDate &&
        t("site.import.workPlan.mapping", { column: t("site.import.workPlan.end"), source: columns.endDate }),
      columns.responsible &&
        t("site.import.workPlan.mapping", { column: t("site.import.workPlan.responsible"), source: columns.responsible }),
      columns.status &&
        t("site.import.workPlan.mapping", { column: t("site.import.workPlan.status"), source: columns.status }),
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

export function WorkPlanImportMenu({ existingCount, onImport }: WorkPlanImportMenuProps) {
  const statusLabel = (status: string) =>
    status in WORK_PLAN_STATUS_KEYS ? t(WORK_PLAN_STATUS_KEYS[status as WorkPlanStatus]) : status;
  return (
    <ImportMenu
      accept=".xlsx,.xls,.xer"
      itemLabel={t("site.import.workPlan.item")}
      countLabel={(count) =>
        t(count === 1 ? "site.import.workPlan.countOne" : "site.import.workPlan.countOther", { count })
      }
      existingCount={existingCount}
      hint={t("site.import.workPlan.hint")}
      parse={parseWorkPlan}
      onTemplate={downloadWorkPlanTemplate}
      onConfirm={onImport}
      renderPreview={(rows) => (
        <table className="w-full min-w-[360px] text-xs">
          <thead className="sticky top-0 bg-zinc-900 text-zinc-500">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">{t("site.import.workPlan.description")}</th>
              <th className="px-2 py-1.5 text-left font-medium">{t("site.import.workPlan.start")}</th>
              <th className="px-2 py-1.5 text-left font-medium">{t("site.import.workPlan.end")}</th>
              <th className="px-2 py-1.5 text-left font-medium">{t("site.import.workPlan.responsible")}</th>
              <th className="px-2 py-1.5 text-left font-medium">{t("site.import.workPlan.status")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-zinc-800/60">
                <td className="max-w-[160px] px-2 py-1.5 text-zinc-300">
                  <TruncateWithTooltip text={row.description} />
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-zinc-400">{row.startDate || "—"}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-zinc-400">{row.endDate || "—"}</td>
                <td className="max-w-[90px] px-2 py-1.5 text-zinc-400">
                  <TruncateWithTooltip text={row.responsible ? responsibleLabel(row.responsible) : "—"} />
                </td>
                <td className="max-w-[80px] px-2 py-1.5 text-zinc-400">
                  <TruncateWithTooltip text={row.status ? statusLabel(row.status) : "—"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    />
  );
}

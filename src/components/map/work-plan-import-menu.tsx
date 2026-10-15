"use client";

import { TruncateWithTooltip } from "@/components/ui/truncate-with-tooltip";
import { ImportMenu } from "@/components/map/import-menu";
import {
  downloadWorkPlanTemplate,
  parseWorkPlanFile,
  type ParsedWorkPlanRow,
} from "@/lib/excel-work-plan";

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
      columns.description && `Açıklama → ${columns.description}`,
      columns.startDate && `Başlangıç → ${columns.startDate}`,
      columns.endDate && `Bitiş → ${columns.endDate}`,
      columns.responsible && `Sorumlu → ${columns.responsible}`,
      columns.status && `Durum → ${columns.status}`,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

export function WorkPlanImportMenu({ existingCount, onImport }: WorkPlanImportMenuProps) {
  return (
    <ImportMenu
      accept=".xlsx,.xls,.xer"
      itemLabel="iş kalemi"
      existingCount={existingCount}
      hint="Excel iş planı şablonu veya Primavera P6 .xer dosyası seçin"
      parse={parseWorkPlan}
      onTemplate={downloadWorkPlanTemplate}
      onConfirm={onImport}
      renderPreview={(rows) => (
        <table className="w-full min-w-[360px] text-xs">
          <thead className="sticky top-0 bg-zinc-900 text-zinc-500">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Açıklama</th>
              <th className="px-2 py-1.5 text-left font-medium">Başlangıç</th>
              <th className="px-2 py-1.5 text-left font-medium">Bitiş</th>
              <th className="px-2 py-1.5 text-left font-medium">Sorumlu</th>
              <th className="px-2 py-1.5 text-left font-medium">Durum</th>
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
                  <TruncateWithTooltip text={row.responsible || "—"} />
                </td>
                <td className="max-w-[80px] px-2 py-1.5 text-zinc-400">
                  <TruncateWithTooltip text={row.status || "—"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    />
  );
}

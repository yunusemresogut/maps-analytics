"use client";

import { TruncateWithTooltip } from "@/components/ui/truncate-with-tooltip";
import { ImportMenu } from "@/components/map/import-menu";
import {
  downloadMaterialsTemplate,
  parseMaterialsFromExcel,
  type ParsedMaterialRow,
} from "@/lib/excel-materials";
import { formatMoney } from "@/lib/currency";
import { useSettings } from "@/contexts/settings-context";
import { useT } from "@/contexts/i18n-context";

type MaterialsImportMenuProps = {
  existingCount: number;
  onImport: (materials: ParsedMaterialRow[]) => void;
};

async function parseMaterials(file: File) {
  const result = await parseMaterialsFromExcel(file);
  return {
    rows: result.materials,
    error: result.errors.join(" · "),
  };
}

export function MaterialsImportMenu({ existingCount, onImport }: MaterialsImportMenuProps) {
  const { org } = useSettings();
  const t = useT();
  return (
    <ImportMenu
      accept=".xlsx,.xls"
      itemLabel={t("site.import.materials.item")}
      countLabel={(count) =>
        t(count === 1 ? "site.import.materials.countOne" : "site.import.materials.countOther", { count })
      }
      existingCount={existingCount}
      hint={t("site.import.materials.hint")}
      parse={parseMaterials}
      onTemplate={downloadMaterialsTemplate}
      onConfirm={onImport}
      renderPreview={(rows) => (
        <table className="w-full min-w-[320px] text-xs">
          <thead className="sticky top-0 bg-zinc-900 text-zinc-500">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">{t("site.import.materials.pozNo")}</th>
              <th className="px-2 py-1.5 text-left font-medium">{t("site.import.materials.description")}</th>
              <th className="px-2 py-1.5 text-right font-medium">{t("site.import.materials.quantity")}</th>
              <th className="px-2 py-1.5 text-left font-medium">{t("site.import.materials.unit")}</th>
              <th className="px-2 py-1.5 text-right font-medium">{t("site.import.materials.unitPrice")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-zinc-800/60">
                <td className="whitespace-nowrap px-2 py-1.5 font-mono text-zinc-400">{row.pozNo || "—"}</td>
                <td className="max-w-[180px] px-2 py-1.5 text-zinc-300">
                  <TruncateWithTooltip text={row.name} />
                </td>
                <td className="px-2 py-1.5 text-right text-zinc-400">{row.quantity}</td>
                <td className="max-w-[72px] px-2 py-1.5 text-zinc-400">
                  <TruncateWithTooltip text={row.unit || "—"} />
                </td>
                <td className="px-2 py-1.5 text-right text-zinc-400">
                  {formatMoney(row.unitPrice, row.currency ?? org.defaults.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    />
  );
}

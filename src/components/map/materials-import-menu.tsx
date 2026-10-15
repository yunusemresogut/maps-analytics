"use client";

import { TruncateWithTooltip } from "@/components/ui/truncate-with-tooltip";
import { ImportMenu } from "@/components/map/import-menu";
import {
  downloadMaterialsTemplate,
  formatCurrency,
  parseMaterialsFromExcel,
  type ParsedMaterialRow,
} from "@/lib/excel-materials";

type MaterialsImportMenuProps = {
  existingCount: number;
  onImport: (materials: ParsedMaterialRow[]) => void;
};

async function parseMaterials(file: File) {
  const result = await parseMaterialsFromExcel(file);
  const columns = result.matchedColumns;
  return {
    rows: result.materials,
    error: result.errors.join(" · "),
    info: [
      columns.description && `Açıklama → ${columns.description}`,
      columns.quantity && `Miktar → ${columns.quantity}`,
      columns.unit && `Birim → ${columns.unit}`,
      columns.unitPrice && `Birim Fiyat → ${columns.unitPrice}`,
      columns.status && `Durum → ${columns.status}`,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

export function MaterialsImportMenu({ existingCount, onImport }: MaterialsImportMenuProps) {
  return (
    <ImportMenu
      accept=".xlsx,.xls"
      itemLabel="malzeme"
      existingCount={existingCount}
      hint="Excel dosyası seçin (Açıklama, Miktar, Birim, Birim Fiyat)"
      parse={parseMaterials}
      onTemplate={downloadMaterialsTemplate}
      onConfirm={onImport}
      renderPreview={(rows) => (
        <table className="w-full min-w-[320px] text-xs">
          <thead className="sticky top-0 bg-zinc-900 text-zinc-500">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Açıklama</th>
              <th className="px-2 py-1.5 text-right font-medium">Miktar</th>
              <th className="px-2 py-1.5 text-left font-medium">Birim</th>
              <th className="px-2 py-1.5 text-right font-medium">Birim fiyat (TRY)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-zinc-800/60">
                <td className="max-w-[180px] px-2 py-1.5 text-zinc-300">
                  <TruncateWithTooltip text={row.name} />
                </td>
                <td className="px-2 py-1.5 text-right text-zinc-400">{row.quantity}</td>
                <td className="max-w-[72px] px-2 py-1.5 text-zinc-400">
                  <TruncateWithTooltip text={row.unit || "—"} />
                </td>
                <td className="px-2 py-1.5 text-right text-zinc-400">
                  {formatCurrency(row.unitPrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    />
  );
}

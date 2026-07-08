"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { TruncateWithTooltip } from "@/components/ui/truncate-with-tooltip";
import {
  downloadMaterialsTemplate,
  parseMaterialsFromExcel,
  type ParsedMaterialRow,
} from "@/lib/excel-materials";
import { Button } from "@/components/ui/button";

type ExcelImportPanelProps = {
  onImport: (materials: ParsedMaterialRow[]) => void;
};

export function ExcelImportPanel({ onImport }: ExcelImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<ParsedMaterialRow[]>([]);
  const [matchedInfo, setMatchedInfo] = useState("");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessage("");
    setError("");
    setPreview([]);
    setMatchedInfo("");

    try {
      const result = await parseMaterialsFromExcel(file);

      if (result.errors.length > 0 && result.materials.length === 0) {
        setError(result.errors.join(" · "));
        e.target.value = "";
        return;
      }

      const cols = [
        result.matchedColumns.description &&
          `Açıklama → ${result.matchedColumns.description}`,
        result.matchedColumns.quantity &&
          `Miktar → ${result.matchedColumns.quantity}`,
        result.matchedColumns.unit &&
          `Birim → ${result.matchedColumns.unit}`,
        result.matchedColumns.unitPrice &&
          `Birim Fiyat → ${result.matchedColumns.unitPrice}`,
        result.matchedColumns.status &&
          `Durum → ${result.matchedColumns.status}`,
      ]
        .filter(Boolean)
        .join(" · ");

      setMatchedInfo(cols);
      setPreview(result.materials);
      setMessage(`${result.materials.length} malzeme okundu`);
    } catch {
      setError("Excel dosyası okunamadı");
    }

    e.target.value = "";
  };

  return (
    <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <FileSpreadsheet className="h-4 w-4 text-violet-400 shrink-0" />
          <span className="text-xs font-medium text-violet-300 truncate">
            Malzeme Excel Import
          </span>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 cursor-pointer"
            onClick={downloadMaterialsTemplate}
            title="Şablon İndir"
          >
            <Download className="h-3.5 w-3.5" />
            Şablon
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="cursor-pointer"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            Seç
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      <p className="mt-2 text-xs text-zinc-500">
        Sütun başlıkları: Açıklama, Miktar, Birim, Birim Fiyat
      </p>

      {matchedInfo && (
        <p className="mt-1 text-xs text-zinc-600">{matchedInfo}</p>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {message && !error && (
        <p className="mt-2 text-xs text-emerald-400">{message}</p>
      )}

      {preview.length > 0 && (
        <div className="mt-3">
          <div className="scrollbar-themed max-h-48 overflow-auto rounded border border-zinc-800 bg-zinc-950/50">
            <table className="w-full min-w-[320px] text-xs">
              <thead className="sticky top-0 bg-zinc-900/95 text-zinc-500">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Açıklama</th>
                  <th className="px-2 py-1.5 text-right font-medium">Miktar</th>
                  <th className="px-2 py-1.5 text-left font-medium">Birim</th>
                  <th className="px-2 py-1.5 text-right font-medium">B.Fiyat</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 10).map((row, i) => (
                  <tr key={i} className="border-t border-zinc-800/60">
                    <td className="max-w-[140px] px-2 py-1.5 text-zinc-300">
                      <TruncateWithTooltip text={row.name} />
                    </td>
                    <td className="px-2 py-1.5 text-right text-zinc-400">
                      {row.quantity}
                    </td>
                    <td className="max-w-[72px] px-2 py-1.5 text-zinc-400">
                      <TruncateWithTooltip text={row.unit || "—"} />
                    </td>
                    <td className="px-2 py-1.5 text-right text-zinc-400">
                      {row.unitPrice.toLocaleString("tr-TR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 10 && (
              <p className="px-2 py-1 text-xs text-zinc-600">
                +{preview.length - 10} satır daha
              </p>
            )}
          </div>
          <Button
            size="sm"
            className="mt-2 w-full"
            onClick={() => {
              onImport(preview);
              setMessage(`${preview.length} malzeme eklendi`);
              setPreview([]);
            }}
          >
            Malzemeleri İçe Aktar
          </Button>
        </div>
      )}
    </div>
  );
}

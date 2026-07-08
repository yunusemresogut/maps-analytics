"use client";

import { useRef, useState } from "react";
import { CalendarRange, Download, Upload } from "lucide-react";
import { TruncateWithTooltip } from "@/components/ui/truncate-with-tooltip";
import {
  downloadWorkPlanTemplate,
  parseWorkPlanFromExcel,
  type ParsedWorkPlanRow,
} from "@/lib/excel-work-plan";
import { Button } from "@/components/ui/button";

type ExcelWorkPlanImportPanelProps = {
  onImport: (items: ParsedWorkPlanRow[]) => void;
};

export function ExcelWorkPlanImportPanel({
  onImport,
}: ExcelWorkPlanImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<ParsedWorkPlanRow[]>([]);
  const [matchedInfo, setMatchedInfo] = useState("");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMessage("");
    setError("");
    setPreview([]);
    setMatchedInfo("");

    try {
      const result = await parseWorkPlanFromExcel(file);

      if (result.errors.length > 0 && result.items.length === 0) {
        setError(result.errors.join(" · "));
        e.target.value = "";
        return;
      }

      const cols = [
        result.matchedColumns.description &&
          `Açıklama → ${result.matchedColumns.description}`,
        result.matchedColumns.startDate &&
          `Başlangıç → ${result.matchedColumns.startDate}`,
        result.matchedColumns.endDate &&
          `Bitiş → ${result.matchedColumns.endDate}`,
        result.matchedColumns.responsible &&
          `Sorumlu → ${result.matchedColumns.responsible}`,
        result.matchedColumns.status &&
          `Durum → ${result.matchedColumns.status}`,
      ]
        .filter(Boolean)
        .join(" · ");

      setMatchedInfo(cols);
      setPreview(result.items);
      setMessage(`${result.items.length} iş kalemi okundu`);
    } catch {
      setError("Excel dosyası okunamadı");
    }

    e.target.value = "";
  };

  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <CalendarRange className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-medium text-emerald-300 truncate">
            İş Planı Excel Import
          </span>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 cursor-pointer"
            onClick={downloadWorkPlanTemplate}
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
        Sütunlar: Açıklama, Başlangıç, Bitiş, Sorumlu, Durum
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
            <table className="w-full min-w-[360px] text-xs">
              <thead className="sticky top-0 bg-zinc-900/95 text-zinc-500">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Açıklama</th>
                  <th className="px-2 py-1.5 text-left font-medium">Başlangıç</th>
                  <th className="px-2 py-1.5 text-left font-medium">Bitiş</th>
                  <th className="px-2 py-1.5 text-left font-medium">Sorumlu</th>
                  <th className="px-2 py-1.5 text-left font-medium">Durum</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 10).map((row, i) => (
                  <tr key={i} className="border-t border-zinc-800/60">
                    <td className="max-w-[120px] px-2 py-1.5 text-zinc-300">
                      <TruncateWithTooltip text={row.description} />
                    </td>
                    <td className="max-w-[72px] px-2 py-1.5 text-zinc-400">
                      <TruncateWithTooltip text={row.startDate || "—"} />
                    </td>
                    <td className="max-w-[72px] px-2 py-1.5 text-zinc-400">
                      <TruncateWithTooltip text={row.endDate || "—"} />
                    </td>
                    <td className="max-w-[80px] px-2 py-1.5 text-zinc-400">
                      <TruncateWithTooltip text={row.responsible || "—"} />
                    </td>
                    <td className="max-w-[72px] px-2 py-1.5 text-zinc-400">
                      <TruncateWithTooltip text={row.status || "—"} />
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
              setMessage(`${preview.length} iş kalemi eklendi`);
              setPreview([]);
            }}
          >
            İş Planını İçe Aktar
          </Button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import {
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
        result.matchedColumns.unitPrice &&
          `Birim Fiyat → ${result.matchedColumns.unitPrice}`,
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
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-violet-400" />
          <span className="text-xs font-medium text-violet-300">
            Malzeme Excel Import
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          .xlsx Seç
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      <p className="mt-2 text-xs text-zinc-500">
        Sütun başlıkları: Açıklama, Miktar, Birim Fiyat
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
          <div className="scrollbar-themed max-h-32 overflow-auto rounded border border-zinc-800 bg-zinc-950/50">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-zinc-900/95 text-zinc-500">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">Açıklama</th>
                  <th className="px-2 py-1.5 text-right font-medium">Miktar</th>
                  <th className="px-2 py-1.5 text-right font-medium">Birim Fiyat</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 8).map((row, i) => (
                  <tr key={i} className="border-t border-zinc-800/60">
                    <td className="px-2 py-1.5 text-zinc-300">{row.name}</td>
                    <td className="px-2 py-1.5 text-right text-zinc-400">
                      {row.quantity}
                    </td>
                    <td className="px-2 py-1.5 text-right text-zinc-400">
                      {row.unitPrice.toLocaleString("tr-TR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 8 && (
              <p className="px-2 py-1 text-xs text-zinc-600">
                +{preview.length - 8} satır daha
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

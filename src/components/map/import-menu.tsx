"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Download, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/contexts/i18n-context";

export type ImportParseResult<T> = {
  rows: T[];
  error?: string;
  info?: string;
};

type ImportMenuProps<T> = {
  accept: string;
  /** Örn. "Keşif kalemi", "İş kalemi" (önizleme başlığı için) */
  itemLabel: string;
  /** Sayıyla birlikte kalem adı, örn. "5 iş kalemi" */
  countLabel: (count: number) => string;
  existingCount: number;
  hint: string;
  parse: (file: File) => Promise<ImportParseResult<T>>;
  onTemplate: () => void;
  onConfirm: (rows: T[]) => void;
  renderPreview: (rows: T[]) => ReactNode;
};

/**
 * Tablo başlığına yerleşen kompakt içe aktarma kontrolleri. Dosya seçilince
 * önizleme ve onay, butonun altında açılan bir pencerede gösterilir; sayfada
 * kalıcı alan kaplamaz.
 */
export function ImportMenu<T>({
  accept,
  itemLabel,
  countLabel,
  existingCount,
  hint,
  parse,
  onTemplate,
  onConfirm,
  renderPreview,
}: ImportMenuProps<T>) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<T[]>([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [fileName, setFileName] = useState("");

  const close = useCallback(() => {
    setOpen(false);
    setRows([]);
    setError("");
    setInfo("");
    setFileName("");
  }, []);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, close]);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setFileName(file.name);
    setRows([]);
    setError("");
    setInfo("");
    setOpen(true);
    try {
      const result = await parse(file);
      if (result.rows.length === 0) {
        setError(result.error || t("site.import.noRows"));
        return;
      }
      setRows(result.rows);
      setInfo(result.info ?? "");
    } catch {
      setError(t("site.import.readFailed"));
    }
  };

  return (
    <div ref={containerRef} className="relative flex items-center gap-1">
      <Button
        size="sm"
        variant="ghost"
        onClick={onTemplate}
        title={t("site.import.downloadTemplate")}
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t("site.import.template")}</span>
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        title={hint}
      >
        <Upload className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t("site.import.import")}</span>
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFile}
      />

      {open && (
        <div
          role="dialog"
          aria-label={t("site.import.previewLabel", { item: itemLabel })}
          className="absolute right-0 top-full z-30 mt-2 w-[min(560px,calc(100vw-2rem))] rounded-lg border border-zinc-700/80 bg-zinc-950 p-3 shadow-(--panel-shadow)"
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-200" title={fileName}>
                {fileName}
              </p>
              {rows.length > 0 && (
                <p className="text-xs text-zinc-500">
                  {t("site.import.readCount", { items: countLabel(rows.length) })}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={close}
              className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
              aria-label={t("common.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {error && <p role="alert" className="text-xs text-red-400">{error}</p>}

          {rows.length > 0 && (
            <>
              <div className="scrollbar-themed max-h-56 overflow-auto rounded border border-zinc-800 bg-zinc-900/30">
                {renderPreview(rows.slice(0, 10))}
                {rows.length > 10 && (
                  <p className="border-t border-zinc-800/60 px-2 py-1 text-xs text-zinc-500">
                    {t("site.import.moreRows", { count: rows.length - 10 })}
                  </p>
                )}
              </div>
              {info && <p className="mt-2 text-[11px] text-zinc-500">{info}</p>}
              {existingCount > 0 && (
                <p className="mt-2 text-xs text-amber-400">
                  {t("site.import.replaceWarning", { items: countLabel(existingCount) })}
                </p>
              )}
              <div className="mt-3 flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={close}>
                  {t("site.import.cancel")}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    onConfirm(rows);
                    close();
                  }}
                >
                  {t("site.import.confirm", { items: countLabel(rows.length) })}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

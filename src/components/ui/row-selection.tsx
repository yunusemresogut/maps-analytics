"use client";

import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SelectCheckbox({
  checked,
  indeterminate = false,
  onChange,
  label,
  className,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
  className?: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = indeterminate;
      }}
      onChange={onChange}
      aria-label={label}
      className={cn(
        "h-4 w-4 cursor-pointer rounded border-zinc-600 bg-zinc-900 accent-cyan-500",
        className
      )}
    />
  );
}

/** Seçim varken tablonun üstünde görünen toplu işlem çubuğu */
export function BulkSelectionBar({
  selectedCount,
  totalCount,
  isPageSelected,
  isAllSelected,
  onSelectAll,
  onClear,
  onDelete,
  busy = false,
}: {
  selectedCount: number;
  totalCount: number;
  isPageSelected: boolean;
  isAllSelected: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onDelete: () => void;
  /** Silme sürerken butonlar kilitlenir */
  busy?: boolean;
}) {
  if (selectedCount === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-800 bg-cyan-500/5 px-4 py-2 text-sm">
      <span className="font-medium text-cyan-200">{selectedCount} kayıt seçildi</span>
      {isPageSelected && !isAllSelected && totalCount > selectedCount && (
        <button
          type="button"
          onClick={onSelectAll}
          className="text-cyan-300 underline-offset-4 hover:underline"
        >
          Tüm {totalCount} kaydı seç
        </button>
      )}
      <div className="ml-auto flex items-center gap-1">
        <Button size="sm" variant="ghost" onClick={onClear} disabled={busy} className="text-xs text-zinc-400">
          <X className="h-3.5 w-3.5" />
          Seçimi kaldır
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete} loading={busy} disabled={busy} className="text-xs text-red-400">
          <Trash2 className="h-3.5 w-3.5" />
          Seçilenleri sil
        </Button>
      </div>
    </div>
  );
}

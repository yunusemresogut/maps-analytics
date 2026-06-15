"use client";

import { CalendarRange, Trash2, X } from "lucide-react";
import { TruncateWithTooltip } from "@/components/ui/truncate-with-tooltip";
import { Button } from "@/components/ui/button";
import type { StoreWorkPlanItem } from "@/types";

type WorkPlanPanelProps = {
  items: StoreWorkPlanItem[];
  isEditing: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
  onClear: () => void;
};

export function WorkPlanPanel({
  items,
  isEditing,
  onClose,
  onDelete,
  onClear,
}: WorkPlanPanelProps) {
  return (
    <div className="flex max-h-72 w-full max-w-[min(20rem,calc(100vw-1rem))] shrink-0 flex-col self-end overflow-hidden rounded-l-xl border border-r-0 border-zinc-700/60 bg-zinc-950/95 shadow-[-8px_0_24px_rgba(0,0,0,0.35)] backdrop-blur-md slide-in-from-left sm:max-h-80 sm:w-80">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-3">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-medium text-zinc-200">İş Planı</span>
          <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-xs text-emerald-300">
            {items.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="scrollbar-themed flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-600">
            Henüz iş planı yok. Excel import ile ekleyin.
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-zinc-950/95 text-zinc-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Açıklama</th>
                <th className="px-2 py-2 text-left font-medium">Başlangıç</th>
                <th className="px-2 py-2 text-left font-medium">Bitiş</th>
                <th className="px-2 py-2 text-left font-medium">Durum</th>
                {isEditing && <th className="w-8" />}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-t border-zinc-800/60 hover:bg-white/[0.02]"
                >
                  <td className="max-w-[100px] px-3 py-2 text-zinc-300">
                    <TruncateWithTooltip text={item.description} />
                  </td>
                  <td className="max-w-[64px] px-2 py-2 text-zinc-400">
                    <TruncateWithTooltip text={item.startDate || "—"} />
                  </td>
                  <td className="max-w-[64px] px-2 py-2 text-zinc-400">
                    <TruncateWithTooltip text={item.endDate || "—"} />
                  </td>
                  <td className="max-w-[64px] px-2 py-2 text-zinc-400">
                    <TruncateWithTooltip text={item.status || "—"} />
                  </td>
                  {isEditing && (
                    <td className="px-1 py-2">
                      <button
                        type="button"
                        onClick={() => onDelete(item.id)}
                        className="text-zinc-600 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {items.length > 0 && isEditing && (
        <div className="border-t border-zinc-800 px-3 py-3">
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-xs text-red-400/80"
            onClick={onClear}
          >
            Tümünü Temizle
          </Button>
        </div>
      )}
    </div>
  );
}

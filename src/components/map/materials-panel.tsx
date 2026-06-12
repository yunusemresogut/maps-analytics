"use client";

import { Package, Trash2, X } from "lucide-react";
import { formatCurrency } from "@/lib/excel-materials";
import { Button } from "@/components/ui/button";
import type { StoreMaterial } from "@/types";

type MaterialsPanelProps = {
  materials: StoreMaterial[];
  isEditing: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
  onClear: () => void;
};

export function MaterialsPanel({
  materials,
  isEditing,
  onClose,
  onDelete,
  onClear,
}: MaterialsPanelProps) {
  const total = materials.reduce(
    (sum, m) => sum + m.quantity * m.unitPrice,
    0
  );

  return (
    <div className="flex max-h-80 w-72 shrink-0 flex-col self-end overflow-hidden rounded-l-xl border border-r-0 border-zinc-700/60 bg-zinc-950/95 shadow-[-8px_0_24px_rgba(0,0,0,0.35)] backdrop-blur-md slide-in-from-left">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-medium text-zinc-200">Malzemeler</span>
          <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-xs text-violet-300">
            {materials.length}
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
        {materials.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-600">
            Henüz malzeme yok. Excel import ile ekleyin.
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-zinc-950/95 text-zinc-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Açıklama</th>
                <th className="px-2 py-2 text-right font-medium">Miktar</th>
                <th className="px-2 py-2 text-right font-medium">B.Fiyat</th>
                {isEditing && <th className="w-8" />}
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr
                  key={m.id}
                  className="border-t border-zinc-800/60 hover:bg-white/[0.02]"
                >
                  <td className="max-w-[120px] truncate px-3 py-2 text-zinc-300">
                    {m.name}
                  </td>
                  <td className="px-2 py-2 text-right text-zinc-400">
                    {m.quantity}
                  </td>
                  <td className="px-2 py-2 text-right text-zinc-400">
                    {m.unitPrice.toLocaleString("tr-TR")}
                  </td>
                  {isEditing && (
                    <td className="px-1 py-2">
                      <button
                        type="button"
                        onClick={() => onDelete(m.id)}
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

      {materials.length > 0 && (
        <div className="border-t border-zinc-800 px-3 py-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">Toplam Tutar</span>
            <span className="font-medium text-cyan-300">
              {formatCurrency(total)}
            </span>
          </div>
          {isEditing && (
            <Button
              size="sm"
              variant="ghost"
              className="mt-2 w-full text-xs text-red-400/80"
              onClick={onClear}
            >
              Tümünü Temizle
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

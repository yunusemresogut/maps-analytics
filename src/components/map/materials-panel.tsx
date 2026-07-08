"use client";

import { useState } from "react";
import { Check, Edit2, Package, Plus, Trash2, X } from "lucide-react";
import { TruncateWithTooltip } from "@/components/ui/truncate-with-tooltip";
import { formatCurrency } from "@/lib/excel-materials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useStoreData } from "@/contexts/store-data-context";
import type { MaterialStatus, StoreMaterial } from "@/types";

type MaterialsPanelProps = {
  storeId: string;
  materials: StoreMaterial[];
  isEditing: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
  onClear: () => void;
};

const statusLabels: Record<MaterialStatus, string> = {
  bekleniyor: "Bekleniyor",
  geldi: "Geldi",
  gitti: "Gitti",
};

const statusColors: Record<MaterialStatus, string> = {
  bekleniyor: "bg-zinc-500 text-zinc-400 border-zinc-500/20",
  geldi: "bg-emerald-500 text-emerald-400 border-emerald-500/20",
  gitti: "bg-amber-500 text-amber-400 border-amber-500/20",
};

export function MaterialsPanel({
  storeId,
  materials,
  isEditing,
  onClose,
  onDelete,
  onClear,
}: MaterialsPanelProps) {
  const { addMaterial, updateMaterial } = useStoreData();

  // Add Form State
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [newUnit, setNewUnit] = useState("adet");
  const [newUnitPrice, setNewUnitPrice] = useState("0");
  const [newStatus, setNewStatus] = useState<MaterialStatus>("bekleniyor");

  // Inline Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editQuantity, setEditQuantity] = useState("1");
  const [editUnit, setEditUnit] = useState("");
  const [editUnitPrice, setEditUnitPrice] = useState("0");
  const [editStatus, setEditStatus] = useState<MaterialStatus>("bekleniyor");

  const total = materials.reduce(
    (sum, m) => sum + m.quantity * m.unitPrice,
    0
  );

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    addMaterial(storeId, {
      name: newName.trim(),
      quantity: Number(newQuantity) || 1,
      unit: newUnit.trim() || "adet",
      unitPrice: Number(newUnitPrice) || 0,
      status: newStatus,
    });

    // Reset Add Form
    setNewName("");
    setNewQuantity("1");
    setNewUnit("adet");
    setNewUnitPrice("0");
    setNewStatus("bekleniyor");
    setIsAdding(false);
  };

  const startEdit = (m: StoreMaterial) => {
    setEditingId(m.id);
    setEditName(m.name);
    setEditQuantity(String(m.quantity));
    setEditUnit(m.unit);
    setEditUnitPrice(String(m.unitPrice));
    setEditStatus(m.status || "bekleniyor");
  };

  const handleUpdateSave = (id: string) => {
    if (!editName.trim()) return;

    updateMaterial(storeId, id, {
      name: editName.trim(),
      quantity: Number(editQuantity) || 1,
      unit: editUnit.trim() || "adet",
      unitPrice: Number(editUnitPrice) || 0,
      status: editStatus,
    });

    setEditingId(null);
  };

  return (
    <div className="flex max-h-[26rem] w-full max-w-[min(24rem,calc(100vw-1rem))] shrink-0 flex-col self-end overflow-hidden rounded-l-xl border border-r-0 border-zinc-700/60 bg-zinc-950/95 shadow-[-8px_0_24px_rgba(0,0,0,0.35)] backdrop-blur-md slide-in-from-left sm:max-h-[32rem] sm:w-[26rem]">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-medium text-zinc-200">Malzemeler</span>
          <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-xs text-violet-300">
            {materials.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isEditing && !isAdding && (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-1 rounded bg-violet-650 px-2 py-1 text-[11px] font-medium text-zinc-100 transition-colors hover:bg-violet-750 cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              Ekle
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Add Material Form */}
      {isAdding && (
        <form
          onSubmit={handleAdd}
          className="border-b border-zinc-800/80 bg-zinc-900/30 p-3 space-y-2.5"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Yeni Malzeme Ekle
          </div>
          <div className="space-y-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Malzeme Adı..."
              required
              className="h-8 text-xs bg-zinc-950/60 border-zinc-800 focus:border-violet-500/50"
            />
            <div className="grid grid-cols-3 gap-2">
              <Input
                type="number"
                min="0.01"
                step="any"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                placeholder="Miktar"
                required
                className="h-8 text-xs bg-zinc-950/60 border-zinc-800 focus:border-violet-500/50"
              />
              <Input
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                placeholder="Birim (Adet...)"
                required
                className="h-8 text-xs bg-zinc-950/60 border-zinc-800 focus:border-violet-500/50"
              />
              <Input
                type="number"
                min="0"
                step="any"
                value={newUnitPrice}
                onChange={(e) => setNewUnitPrice(e.target.value)}
                placeholder="B. Fiyat"
                required
                className="h-8 text-xs bg-zinc-950/60 border-zinc-800 focus:border-violet-500/50"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] text-zinc-500">Durum</label>
              <Select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as MaterialStatus)}
                className="h-8 text-xs bg-zinc-950/60 border-zinc-800 focus:border-violet-500/50"
              >
                <option value="bekleniyor">Bekleniyor</option>
                <option value="geldi">Geldi</option>
                <option value="gitti">Gitti</option>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="rounded px-2.5 py-1 text-xs text-zinc-400 hover:bg-zinc-800 cursor-pointer"
            >
              İptal
            </button>
            <button
              type="submit"
              className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 cursor-pointer"
            >
              Kaydet
            </button>
          </div>
        </form>
      )}

      {/* Materials Table */}
      <div className="scrollbar-themed flex-1 overflow-y-auto">
        {materials.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-600">
            Henüz malzeme yok. Excel import veya "+ Ekle" ile ekleyin.
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-zinc-950/95 text-zinc-500 z-10">
              <tr>
                <th className="px-2.5 py-2 text-left font-medium">Açıklama</th>
                <th className="px-2 py-2 text-right font-medium">Miktar</th>
                <th className="px-2 py-2 text-left font-medium">Birim</th>
                <th className="px-2 py-2 text-right font-medium">B.Fiyat</th>
                <th className="px-2 py-2 text-center font-medium">Durum</th>
                {isEditing && <th className="w-14" />}
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => {
                const isItemEditing = editingId === m.id;

                if (isItemEditing) {
                  return (
                    <tr
                      key={m.id}
                      className="border-t border-violet-500/30 bg-violet-500/5"
                    >
                      <td className="px-2 py-1.5" colSpan={6}>
                        <div className="space-y-2 py-1">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-7 text-[11px] w-full"
                          />
                          <div className="grid grid-cols-4 gap-1.5">
                            <Input
                              type="number"
                              step="any"
                              value={editQuantity}
                              onChange={(e) => setEditQuantity(e.target.value)}
                              className="h-7 text-[11px]"
                              placeholder="Mik."
                            />
                            <Input
                              value={editUnit}
                              onChange={(e) => setEditUnit(e.target.value)}
                              className="h-7 text-[11px]"
                              placeholder="Birim"
                            />
                            <Input
                              type="number"
                              step="any"
                              value={editUnitPrice}
                              onChange={(e) => setEditUnitPrice(e.target.value)}
                              className="h-7 text-[11px]"
                              placeholder="Fiyat"
                            />
                            <Select
                              value={editStatus}
                              onChange={(e) => setEditStatus(e.target.value as MaterialStatus)}
                              className="h-7 text-[11px] py-0 px-1"
                            >
                              <option value="bekleniyor">Bekle</option>
                              <option value="geldi">Geldi</option>
                              <option value="gitti">Gitti</option>
                            </Select>
                          </div>
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-800 cursor-pointer"
                            >
                              İptal
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateSave(m.id)}
                              className="flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-0.5 text-[10px] font-medium text-white hover:bg-emerald-700 cursor-pointer"
                            >
                              <Check className="h-3 w-3" /> Kaydet
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                }

                const currentStatus = m.status || "bekleniyor";

                return (
                  <tr
                    key={m.id}
                    className="border-t border-zinc-800/60 hover:bg-white/[0.02]"
                  >
                    <td className="max-w-[90px] px-2.5 py-2 text-zinc-300">
                      <TruncateWithTooltip text={m.name} />
                    </td>
                    <td className="px-2 py-2 text-right text-zinc-400">
                      {m.quantity}
                    </td>
                    <td className="max-w-[45px] px-2 py-2 text-zinc-400">
                      <TruncateWithTooltip text={m.unit || "—"} />
                    </td>
                    <td className="px-2 py-2 text-right text-zinc-400">
                      {m.unitPrice.toLocaleString("tr-TR")}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className="inline-flex items-center gap-1 rounded-full border bg-zinc-950/40 px-1.5 py-0.5 text-[9px] font-medium">
                        <span className={`h-1.5 w-1.5 rounded-full ${statusColors[currentStatus].split(" ")[0]}`} />
                        <span className={statusColors[currentStatus].split(" ")[1]}>
                          {statusLabels[currentStatus]}
                        </span>
                      </span>
                    </td>
                    {isEditing && (
                      <td className="px-2 py-2">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => startEdit(m)}
                            className="text-zinc-500 hover:text-cyan-400 cursor-pointer"
                            title="Düzenle"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(m.id)}
                            className="text-zinc-500 hover:text-red-400 cursor-pointer"
                            title="Sil"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {materials.length > 0 && (
        <div className="border-t border-zinc-800 px-3 py-3 z-10 bg-zinc-950/95">
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
              className="mt-2 w-full text-xs text-red-400/80 cursor-pointer"
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

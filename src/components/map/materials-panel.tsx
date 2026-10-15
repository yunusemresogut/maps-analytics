"use client";

import { useCallback, useId, useState } from "react";
import { Edit2, Package, Plus, Trash2 } from "lucide-react";
import { TruncateWithTooltip } from "@/components/ui/truncate-with-tooltip";
import { formatCurrency } from "@/lib/excel-materials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { TablePagination } from "@/components/modules/module-table";
import { useStoreData } from "@/contexts/store-data-context";
import { useTableState } from "@/hooks/use-table-state";
import { cn } from "@/lib/utils";
import { MaterialsImportMenu } from "@/components/map/materials-import-menu";
import type { ParsedMaterialRow } from "@/lib/excel-materials";
import type { MaterialStatus, StoreMaterial } from "@/types";

type MaterialsPanelProps = {
  storeId: string;
  materials: StoreMaterial[];
  isEditing: boolean;
  onDelete: (id: string) => void;
  onClear: () => void;
  onImport: (rows: ParsedMaterialRow[]) => void;
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

type MaterialSortKey = "name" | "quantity" | "unit" | "unitPrice" | "status";

function FloatingInput({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const [focused, setFocused] = useState(false);
  const floating = focused || Boolean(props.value);

  return (
    <div className="relative min-w-0">
      <Input
        {...props}
        placeholder=" "
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        className={cn("h-11", className)}
      />
      <label
        className={cn(
          "pointer-events-none absolute left-3 transition-all",
          floating
            ? "-top-2 bg-zinc-950 px-1 text-[11px] text-violet-400"
            : "top-1/2 -translate-y-1/2 text-sm text-zinc-500"
        )}
      >
        {label}
      </label>
    </div>
  );
}

type MaterialFormValues = Pick<StoreMaterial, "name" | "quantity" | "unit" | "unitPrice" | "status">;

function MaterialFormModal({
  material,
  onClose,
  onSubmit,
}: {
  material: StoreMaterial | null;
  onClose: () => void;
  onSubmit: (values: MaterialFormValues) => void;
}) {
  const formId = useId();
  const [name, setName] = useState(material?.name ?? "");
  const [quantity, setQuantity] = useState(String(material?.quantity ?? 1));
  const [unit, setUnit] = useState(material?.unit ?? "adet");
  const [unitPrice, setUnitPrice] = useState(String(material?.unitPrice ?? 0));
  const [status, setStatus] = useState<MaterialStatus>(material?.status || "bekleniyor");
  const [error, setError] = useState("");
  const lineTotal = (Number(quantity) || 0) * (Number(unitPrice) || 0);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("Malzeme adı zorunludur");
      return;
    }
    onSubmit({
      name: name.trim(),
      quantity: Number(quantity) || 1,
      unit: unit.trim() || "adet",
      unitPrice: Number(unitPrice) || 0,
      status,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={material ? "Malzemeyi düzenle" : "Yeni malzeme"}
      description="Miktar, birim ve fiyat bilgilerini girin."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" form={formId}>
            {material ? "Değişiklikleri kaydet" : "Malzemeyi ekle"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4 pt-1" noValidate>
        <div>
          <FloatingInput
            label="Malzeme adı"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError("");
            }}
            aria-invalid={!!error}
          />
          {error && <p role="alert" className="mt-1 text-xs text-red-400">{error}</p>}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FloatingInput
            label="Miktar"
            type="number"
            min="0.01"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <FloatingInput label="Birim" value={unit} onChange={(e) => setUnit(e.target.value)} />
          <FloatingInput
            label="Birim fiyat (TRY)"
            type="number"
            min="0"
            step="any"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm text-zinc-400">Durum</label>
            <Select value={status} onChange={(e) => setStatus(e.target.value as MaterialStatus)}>
              <option value="bekleniyor">Bekleniyor</option>
              <option value="geldi">Geldi</option>
              <option value="gitti">Gitti</option>
            </Select>
          </div>
          <div className="flex h-10 items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 text-sm">
            <span className="text-zinc-500">Tutar</span>
            <span className="font-medium tabular-nums text-zinc-100">{formatCurrency(lineTotal)}</span>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export function MaterialsPanel({
  storeId,
  materials,
  isEditing,
  onDelete,
  onClear,
  onImport,
}: MaterialsPanelProps) {
  const { addMaterial, updateMaterial } = useStoreData();
  const [modal, setModal] = useState<{ key: number; material: StoreMaterial | null } | null>(null);

  const getSortValue = useCallback((item: StoreMaterial, key: MaterialSortKey) => {
    if (key === "name") return item.name;
    if (key === "quantity") return item.quantity;
    if (key === "unit") return item.unit;
    if (key === "unitPrice") return item.unitPrice;
    return statusLabels[item.status] ?? item.status;
  }, []);
  const table = useTableState<StoreMaterial, MaterialSortKey>({
    items: materials,
    initialSort: { key: "name", direction: "asc" },
    getSortValue,
    resetKey: String(materials.length),
  });

  const total = materials.reduce(
    (sum, m) => sum + m.quantity * m.unitPrice,
    0
  );

  const openModal = (material: StoreMaterial | null) =>
    setModal({ key: Date.now(), material });

  const handleSubmit = (values: MaterialFormValues) => {
    if (modal?.material) updateMaterial(storeId, modal.material.id, values);
    else addMaterial(storeId, values);
    setModal(null);
  };

  return (
    <section className="flex w-full min-w-0 flex-col rounded-lg border border-zinc-800 bg-zinc-900/40">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-medium text-zinc-200">Malzemeler</span>
          <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-xs text-violet-300">
            {materials.length}
          </span>
        </div>
        {isEditing && (
          <div className="flex items-center gap-2">
            <MaterialsImportMenu existingCount={materials.length} onImport={onImport} />
            <Button size="sm" onClick={() => openModal(null)}>
              <Plus className="h-3.5 w-3.5" />
              Malzeme ekle
            </Button>
          </div>
        )}
      </div>

      <div className="min-w-0 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-zinc-800 text-xs text-zinc-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Malzeme</th>
              <th className="px-4 py-3 text-right font-medium">Miktar</th>
              <th className="px-4 py-3 text-left font-medium">Birim</th>
              <th className="px-4 py-3 text-right font-medium">Birim fiyat</th>
              <th className="px-4 py-3 text-right font-medium">Tutar</th>
              <th className="px-4 py-3 text-left font-medium">Durum</th>
              {isEditing && <th className="w-20 px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/70">
            {materials.length === 0 ? (
              <tr>
                <td colSpan={isEditing ? 7 : 6} className="px-4 py-10 text-center text-sm text-zinc-500">
                  Henüz malzeme yok. Excel ile içe aktarın veya &quot;Malzeme ekle&quot; ile ekleyin.
                </td>
              </tr>
            ) : (
              table.pageItems.map((m) => {
                const currentStatus = m.status || "bekleniyor";
                return (
                  <tr key={m.id} className="text-zinc-300 hover:bg-zinc-900/50">
                    <td className="max-w-[360px] px-4 py-3 font-medium text-zinc-100">
                      <TruncateWithTooltip text={m.name} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-zinc-400">
                      {m.quantity}
                    </td>
                    <td className="max-w-[120px] px-4 py-3 text-zinc-400">
                      <TruncateWithTooltip text={m.unit || "—"} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-zinc-400">
                      {formatCurrency(m.unitPrice)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-zinc-200">
                      {formatCurrency(m.quantity * m.unitPrice)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950/40 px-2 py-0.5 text-xs font-medium">
                        <span className={`h-1.5 w-1.5 rounded-full ${statusColors[currentStatus].split(" ")[0]}`} />
                        <span className={statusColors[currentStatus].split(" ")[1]}>
                          {statusLabels[currentStatus]}
                        </span>
                      </span>
                    </td>
                    {isEditing && (
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openModal(m)}
                            className="text-zinc-500 hover:text-cyan-400"
                            aria-label="Düzenle"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(m.id)}
                            className="text-zinc-500 hover:text-red-400"
                            aria-label="Sil"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
          {materials.length > 0 && (
            <tfoot className="border-t border-zinc-800">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-right text-xs text-zinc-500">
                  Toplam tutar
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-cyan-300">
                  {formatCurrency(total)}
                </td>
                <td colSpan={isEditing ? 2 : 1} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {materials.length > 0 && (
        <div className="border-t border-zinc-800 px-3 py-2">
          <TablePagination
            page={table.page}
            totalPages={table.totalPages}
            totalItems={table.totalItems}
            rangeStart={table.rangeStart}
            rangeEnd={table.rangeEnd}
            onPageChange={table.setPage}
            pageSize={table.pageSize}
            onPageSizeChange={table.setPageSize}
          />
        </div>
      )}

      {materials.length > 0 && isEditing && (
        <div className="border-t border-zinc-800 px-3 py-3">
          <Button size="sm" variant="ghost" className="text-xs text-red-400/80" onClick={onClear}>
            Tümünü temizle
          </Button>
        </div>
      )}

      {modal && (
        <MaterialFormModal
          key={modal.key}
          material={modal.material}
          onClose={() => setModal(null)}
          onSubmit={handleSubmit}
        />
      )}
    </section>
  );
}

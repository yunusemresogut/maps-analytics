"use client";

import { useId, useMemo, useState } from "react";
import { ChevronDown, Edit2, Lock, Package, Percent, Plus, Search, Trash2 } from "lucide-react";
import { TruncateWithTooltip } from "@/components/ui/truncate-with-tooltip";
import { formatCurrency } from "@/lib/excel-materials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { TablePagination } from "@/components/modules/module-table";
import { useStoreData } from "@/contexts/store-data-context";
import { useDb } from "@/contexts/db-context";
import { useServerTable } from "@/hooks/use-server-table";
import type { SortState } from "@/hooks/use-table-state";
import {
  EMPTY_SUMMARY,
  MATERIAL_SEARCH_COLUMNS,
  MATERIALS_SOURCE,
  fetchMatchingIds,
  fetchMaterialsByIds,
  mapMaterialFromDb,
} from "@/lib/store-details";
import { useRowSelection } from "@/hooks/use-row-selection";
import { BulkSelectionBar, SelectCheckbox } from "@/components/ui/row-selection";
import { cn } from "@/lib/utils";
import { MaterialsImportMenu } from "@/components/map/materials-import-menu";
import type { ParsedMaterialRow } from "@/lib/excel-materials";
import type { MaterialStatus, StoreMaterial } from "@/types";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { PERCENT_UNIT, isPercentMaterial, materialLineTotal } from "@/lib/material-totals";

type MaterialsPanelProps = {
  storeId: string;
  isEditing: boolean;
  onDelete: (ids: string[]) => Promise<void>;
  onImport: (rows: ParsedMaterialRow[]) => void;
};

const SORT_COLUMNS = { seq: "seq" };
const INITIAL_SORT: SortState<"seq"> = { key: "seq", direction: "asc" };

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

/** Değiştirilemeyen alan: input gibi görünür ama düzenlenemez */
function ReadOnlyValue({ children, icon, title }: { children: React.ReactNode; icon?: boolean; title?: string }) {
  return (
    <div
      title={title}
      aria-readonly="true"
      className="flex h-10 items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 text-sm text-zinc-300"
    >
      <span className="truncate tabular-nums">{children}</span>
      {icon && <Lock className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />}
    </div>
  );
}

type MaterialFormValues = Pick<StoreMaterial, "name" | "quantity" | "unit" | "unitPrice" | "status">;

/** Seçili kalemlerden yüzdelik kalem eklerken taban: seçilenler ve toplam tutarları */
type PercentBase =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: StoreMaterial[]; total: number; afterSeq?: number };

function MaterialFormModal({
  material,
  percentBase,
  onClose,
  onSubmit,
}: {
  material: StoreMaterial | null;
  /** Doluysa yeni kalem, seçilen kalemlerin yüzdesi olarak eklenir */
  percentBase: PercentBase | null;
  onClose: () => void;
  onSubmit: (values: MaterialFormValues) => void;
}) {
  const formId = useId();
  // Yüzde modu: seçimle yeni ekleme ya da birimi "%" olan kalemi düzenleme
  const percentMode = !!percentBase || (!!material && isPercentMaterial(material));
  const [name, setName] = useState(material?.name ?? "");
  const [quantity, setQuantity] = useState(
    material ? String(material.quantity) : percentMode ? "" : "1"
  );
  const [unit, setUnit] = useState(material?.unit ?? "adet");
  const [unitPrice, setUnitPrice] = useState(String(material?.unitPrice ?? 0));
  const [status, setStatus] = useState<MaterialStatus>(material?.status || "bekleniyor");
  const [error, setError] = useState("");
  const [quantityError, setQuantityError] = useState("");

  // Yüzde modunda birim fiyat = seçilen kalemlerin toplam tutarı (düzenlemede kayıtlı taban)
  const percentReady = !percentBase || percentBase.status === "ready";
  const baseTotal = percentBase?.status === "ready" ? percentBase.total : material?.unitPrice ?? 0;
  const effectiveUnit = percentMode ? PERCENT_UNIT : unit;
  const effectiveUnitPrice = percentMode ? baseTotal : Number(unitPrice) || 0;
  const lineTotal = materialLineTotal({
    quantity: Number(quantity) || 0,
    unit: effectiveUnit,
    unitPrice: effectiveUnitPrice,
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(quantity);
    let invalid = false;
    if (!name.trim()) {
      setError("Kalem adı zorunludur");
      invalid = true;
    }
    if (percentMode && !(amount > 0)) {
      setQuantityError("Yüzde değeri girin (ör. 10)");
      invalid = true;
    }
    if (invalid || !percentReady) return;
    onSubmit({
      name: name.trim(),
      quantity: percentMode ? amount : amount || 1,
      unit: percentMode ? PERCENT_UNIT : unit.trim() || "adet",
      unitPrice: effectiveUnitPrice,
      status,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      className="sm:max-w-xl"
      title={
        material
          ? "Keşif kalemini düzenle"
          : percentMode
            ? "Seçilenlerden yüzdelik kalem"
            : "Yeni keşif kalemi"
      }
      description={
        percentMode
          ? "Tutar, seçilen kalemlerin toplamının girdiğiniz yüzdesidir."
          : "Miktar, birim ve fiyat bilgilerini girin."
      }
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" form={formId} disabled={!percentReady}>
            {material ? "Değişiklikleri kaydet" : "Kalemi ekle"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4 pt-1" noValidate>
        {percentBase && (
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/5">
            <div className="flex items-center justify-between gap-2 border-b border-cyan-500/20 px-3 py-2 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-cyan-300">
                <Percent className="h-3.5 w-3.5" />
                {percentBase.status === "ready"
                  ? `Seçilen ${percentBase.items.length} kalem`
                  : "Seçilen kalemler"}
              </span>
              {percentBase.status === "ready" && (
                <span className="tabular-nums text-zinc-300">
                  Toplam <span className="font-semibold text-zinc-100">{formatCurrency(percentBase.total)}</span>
                </span>
              )}
            </div>
            {percentBase.status === "loading" && (
              <p className="px-3 py-3 text-xs text-zinc-500">Seçilen kalemler yükleniyor…</p>
            )}
            {percentBase.status === "error" && (
              <p role="alert" className="px-3 py-3 text-xs text-red-400">
                Seçilen kalemler yüklenemedi. Pencereyi kapatıp tekrar deneyin.
              </p>
            )}
            {percentBase.status === "ready" && (
              <ul className="scrollbar-themed max-h-40 divide-y divide-zinc-800/70 overflow-y-auto">
                {percentBase.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
                    <span className="min-w-0 truncate text-zinc-300">{item.name}</span>
                    <span className="shrink-0 tabular-nums text-zinc-400">
                      {formatCurrency(materialLineTotal(item))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <FormField label="Kalem adı" required error={error} htmlFor={`${formId}-name`}>
          <Input
            id={`${formId}-name`}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError("");
            }}
            aria-invalid={!!error}
            autoComplete="off"
          />
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField
            label={percentMode ? "Yüzde" : "Miktar"}
            required={percentMode}
            error={quantityError}
            htmlFor={`${formId}-quantity`}
          >
            <div className="relative">
              <Input
                id={`${formId}-quantity`}
                type="number"
                min="0.01"
                step="any"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  if (quantityError) setQuantityError("");
                }}
                aria-invalid={!!quantityError}
                className={cn("tabular-nums", percentMode && "pr-8")}
              />
              {percentMode && (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500" aria-hidden>
                  %
                </span>
              )}
            </div>
          </FormField>

          <FormField label="Birim" htmlFor={`${formId}-unit`}>
            {percentMode ? (
              <ReadOnlyValue icon title="Yüzdelik kalemde birim değiştirilemez">
                {PERCENT_UNIT}
              </ReadOnlyValue>
            ) : (
              <Input id={`${formId}-unit`} value={unit} onChange={(e) => setUnit(e.target.value)} autoComplete="off" />
            )}
          </FormField>

          <FormField label={percentMode ? "Birim fiyat (taban)" : "Birim fiyat (TRY)"} htmlFor={`${formId}-price`}>
            {percentMode ? (
              <ReadOnlyValue icon title="Seçilen kalemlerin toplam tutarı">
                {percentReady ? formatCurrency(baseTotal) : "…"}
              </ReadOnlyValue>
            ) : (
              <Input
                id={`${formId}-price`}
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="tabular-nums"
              />
            )}
          </FormField>
        </div>

        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
          <FormField label="Durum">
            <Select value={status} onChange={(e) => setStatus(e.target.value as MaterialStatus)} aria-label="Durum">
              <option value="bekleniyor">Bekleniyor</option>
              <option value="geldi">Geldi</option>
              <option value="gitti">Gitti</option>
            </Select>
          </FormField>
          <FormField label="Tutar">
            <div className="flex h-10 items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 text-sm">
              <span className="truncate text-xs text-zinc-500">
                {percentMode && Number(quantity) > 0
                  ? `${formatCurrency(baseTotal)} × %${Number(quantity).toLocaleString("tr-TR")}`
                  : ""}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-zinc-100">{formatCurrency(lineTotal)}</span>
            </div>
          </FormField>
        </div>
      </form>
    </Modal>
  );
}

export function MaterialsPanel({
  storeId,
  isEditing,
  onDelete,
  onImport,
}: MaterialsPanelProps) {
  const { addMaterial, updateMaterial, getDetailVersion } = useStoreData();
  const { storeSummaries } = useDb();
  const summary = storeSummaries[storeId] ?? EMPTY_SUMMARY;
  const [modal, setModal] = useState<{
    key: number;
    material: StoreMaterial | null;
    percentBase: PercentBase | null;
  } | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [query, setQuery] = usePersistentState(`materials:${storeId}`, "query", "");
  const [deleting, setDeleting] = useState(false);
  const bodyId = useId();

  // Sunucuda aranır ve sayfalanır; sıra her zaman eklenme sırasıdır (seq)
  const filters = useMemo(() => ({ store_id: storeId }), [storeId]);
  const table = useServerTable<StoreMaterial, "seq">({
    memoryKey: `materials:${storeId}`,
    source: MATERIALS_SOURCE,
    mapRow: mapMaterialFromDb,
    searchColumns: MATERIAL_SEARCH_COLUMNS,
    search: query,
    filters,
    sortColumns: SORT_COLUMNS,
    initialSort: INITIAL_SORT,
    refreshKey: getDetailVersion(storeId),
  });

  const pageIds = useMemo(() => table.pageItems.map((m) => m.id), [table.pageItems]);
  const selection = useRowSelection({
    pageIds,
    totalCount: table.totalItems,
    resetKey: `${storeId}|${table.appliedSearch}`,
  });

  const handleBulkDelete = async () => {
    const count = selection.selectedCount;
    if (count === 0 || !confirm(`${count} keşif kalemi silinsin mi?`)) return;
    setDeleting(true);
    try {
      const ids = selection.allMatching
        ? await fetchMatchingIds({
            source: MATERIALS_SOURCE,
            filters,
            searchColumns: MATERIAL_SEARCH_COLUMNS,
            search: table.appliedSearch,
          })
        : [...selection.selected];
      await onDelete(ids);
      selection.clear();
    } catch (err) {
      console.error("Toplu keşif kalemi silme başarısız:", err);
    } finally {
      setDeleting(false);
    }
  };

  const openModal = (material: StoreMaterial | null) =>
    setModal({ key: Date.now(), material, percentBase: null });

  /**
   * Seçili kalemler varsa yeni kalem onların yüzdesi olarak eklenir. Seçim
   * birden fazla sayfaya yayılabildiği için kalemler veritabanından çekilir.
   */
  const openPercentModal = async () => {
    const key = Date.now();
    setModal({ key, material: null, percentBase: { status: "loading" } });
    const update = (percentBase: PercentBase) =>
      setModal((current) => (current?.key === key ? { ...current, percentBase } : current));
    try {
      const ids = selection.allMatching
        ? await fetchMatchingIds({
            source: MATERIALS_SOURCE,
            filters,
            searchColumns: MATERIAL_SEARCH_COLUMNS,
            search: table.appliedSearch,
          })
        : [...selection.selected];
      const items = await fetchMaterialsByIds(ids);
      const seqs = items.flatMap((item) => (item.seq === undefined ? [] : [item.seq]));
      update({
        status: "ready",
        items,
        total: items.reduce((sum, item) => sum + materialLineTotal(item), 0),
        // Yeni kalem, seçilenlerden listede en sonda olanın hemen altına eklenir
        afterSeq: seqs.length > 0 ? Math.max(...seqs) : undefined,
      });
    } catch (err) {
      console.error("Seçilen keşif kalemleri yüklenemedi:", err);
      update({ status: "error" });
    }
  };

  const handleSubmit = (values: MaterialFormValues) => {
    if (modal?.material) updateMaterial(storeId, modal.material.id, values);
    else
      addMaterial(storeId, values, {
        afterSeq: modal?.percentBase?.status === "ready" ? modal.percentBase.afterSeq : undefined,
      });
    // Yüzdelik kalem eklendiyse seçim tamamlanmış sayılır
    if (modal?.percentBase) selection.clear();
    setModal(null);
  };

  return (
    <section className="flex w-full min-w-0 flex-col rounded-lg border border-zinc-800 bg-zinc-900/40">
      <div
        className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 ${expanded ? "border-b border-zinc-800" : ""}`}
      >
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          aria-controls={bodyId}
          className="-mx-1.5 -my-1 flex items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-zinc-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
        >
          <ChevronDown
            className={`h-4 w-4 text-zinc-500 transition-transform ${expanded ? "" : "-rotate-90"}`}
            aria-hidden
          />
          <Package className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-medium text-zinc-200">Keşif</span>
          <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-xs text-violet-300">
            {summary.materialCount}
          </span>
        </button>
        {isEditing && (
          <div className="flex items-center gap-2">
            <MaterialsImportMenu existingCount={summary.materialCount} onImport={onImport} />
            {selection.selectedCount > 0 ? (
              <Button size="sm" onClick={() => void openPercentModal()} title="Seçilen kalemlerin toplamının yüzdesi olarak yeni kalem">
                <Percent className="h-3.5 w-3.5" />
                Seçilenlerden % kalem ekle ({selection.selectedCount})
              </Button>
            ) : (
              <Button size="sm" onClick={() => openModal(null)}>
                <Plus className="h-3.5 w-3.5" />
                Kalem ekle
              </Button>
            )}
          </div>
        )}
      </div>

      <div id={bodyId} hidden={!expanded}>
        {summary.materialCount > 0 && (
          <div className="border-b border-zinc-800 px-4 py-3">
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Kalem, birim veya durum ara…"
                aria-label="Keşifte ara"
                className="h-9 pl-9"
              />
            </div>
          </div>
        )}
        {isEditing && (
          <BulkSelectionBar
            selectedCount={selection.selectedCount}
            totalCount={table.totalItems}
            isPageSelected={selection.isPageSelected}
            isAllSelected={selection.isAllSelected}
            onSelectAll={selection.selectAll}
            onClear={selection.clear}
            onDelete={handleBulkDelete}
            busy={deleting}
          />
        )}
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-zinc-800 text-xs text-zinc-500">
              <tr>
                {isEditing && (
                  <th className="w-10 py-3 pl-4">
                    <SelectCheckbox
                      checked={selection.isPageSelected}
                      indeterminate={selection.isPagePartiallySelected}
                      onChange={selection.togglePage}
                      label="Bu sayfadaki keşif kalemlerini seç"
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-left font-medium">Kalem</th>
                <th className="px-4 py-3 text-right font-medium">Miktar</th>
                <th className="px-4 py-3 text-left font-medium">Birim</th>
                <th className="px-4 py-3 text-right font-medium">Birim fiyat</th>
                <th className="px-4 py-3 text-right font-medium">Tutar</th>
                <th className="px-4 py-3 text-left font-medium">Durum</th>
                {isEditing && <th className="w-20 px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {table.totalItems === 0 ? (
                <tr>
                  <td colSpan={isEditing ? 8 : 6} className="px-4 py-10 text-center text-sm text-zinc-500">
                    {table.isLoading
                      ? "Yükleniyor…"
                      : summary.materialCount === 0
                      ? <>Henüz keşif kalemi yok. Excel ile içe aktarın veya &quot;Kalem ekle&quot; ile ekleyin.</>
                      : "Aramayla eşleşen keşif kalemi yok."}
                  </td>
                </tr>
              ) : (
                table.pageItems.map((m) => {
                  const currentStatus = m.status || "bekleniyor";
                  return (
                    <tr
                      key={m.id}
                      className={cn(
                        "text-zinc-300 hover:bg-zinc-900/50",
                        selection.isSelected(m.id) && "bg-cyan-500/5"
                      )}
                    >
                      {isEditing && (
                        <td className="w-10 py-3 pl-4">
                          <SelectCheckbox
                            checked={selection.isSelected(m.id)}
                            onChange={() => selection.toggle(m.id)}
                            label={`${m.name} seç`}
                          />
                        </td>
                      )}
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
                        {formatCurrency(materialLineTotal(m))}
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
                              onClick={() => void onDelete([m.id])}
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
            {table.totalItems > 0 && (
              <tfoot className="border-t border-zinc-800">
                <tr>
                  <td colSpan={isEditing ? 5 : 4} className="px-4 py-3 text-right text-xs text-zinc-500">
                    {table.appliedSearch ? "Tüm keşif toplamı" : "Toplam tutar"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-cyan-300">
                    {formatCurrency(summary.materialTotal)}
                  </td>
                  <td colSpan={isEditing ? 2 : 1} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {table.totalItems > 0 && (
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
      </div>

      {modal && (
        <MaterialFormModal
          key={modal.key}
          material={modal.material}
          percentBase={modal.percentBase}
          onClose={() => setModal(null)}
          onSubmit={handleSubmit}
        />
      )}
    </section>
  );
}

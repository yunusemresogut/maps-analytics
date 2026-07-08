"use client";

import { useState } from "react";
import { CalendarRange, Check, Edit2, Plus, Trash2, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { TruncateWithTooltip } from "@/components/ui/truncate-with-tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useStoreData } from "@/contexts/store-data-context";
import type { StoreWorkPlanItem, WorkPlanStatus } from "@/types";

type WorkPlanPanelProps = {
  storeId: string;
  items: StoreWorkPlanItem[];
  isEditing: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
  onClear: () => void;
};

const statusLabels: Record<WorkPlanStatus, string> = {
  yapilacak: "Yapılacak",
  devam_ediyor: "Devam Ediyor",
  tamamlandi: "Tamamlandı",
};

const statusColors: Record<WorkPlanStatus, string> = {
  yapilacak: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  devam_ediyor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  tamamlandi: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

function formatDateSafe(dateStr: string) {
  if (!dateStr) return "Tarih Belirtilmemiş";
  try {
    return format(parseISO(dateStr), "d MMMM yyyy", { locale: tr });
  } catch {
    return dateStr;
  }
}

export function WorkPlanPanel({
  storeId,
  items,
  isEditing,
  onClose,
  onDelete,
  onClear,
}: WorkPlanPanelProps) {
  const { addWorkPlanItem, updateWorkPlanItem } = useStoreData();

  // Add Form State
  const [isAdding, setIsAdding] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [newResponsible, setNewResponsible] = useState("");
  const [newStatus, setNewStatus] = useState<WorkPlanStatus>("yapilacak");

  // Inline Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editResponsible, setEditResponsible] = useState("");
  const [editStatus, setEditStatus] = useState<WorkPlanStatus>("yapilacak");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDescription.trim()) return;

    addWorkPlanItem(storeId, {
      description: newDescription.trim(),
      startDate: newStartDate,
      endDate: newEndDate,
      responsible: newResponsible.trim() || "Belirtilmemiş",
      status: newStatus,
    });

    // Reset Add Form
    setNewDescription("");
    setNewStartDate("");
    setNewEndDate("");
    setNewResponsible("");
    setNewStatus("yapilacak");
    setIsAdding(false);
  };

  const startEdit = (item: StoreWorkPlanItem) => {
    setEditingId(item.id);
    setEditDescription(item.description);
    setEditStartDate(item.startDate);
    setEditEndDate(item.endDate);
    setEditResponsible(item.responsible);
    setEditStatus((item.status as WorkPlanStatus) || "yapilacak");
  };

  const handleUpdateSave = (id: string) => {
    if (!editDescription.trim()) return;

    updateWorkPlanItem(storeId, id, {
      description: editDescription.trim(),
      startDate: editStartDate,
      endDate: editEndDate,
      responsible: editResponsible.trim() || "Belirtilmemiş",
      status: editStatus,
    });

    setEditingId(null);
  };

  // Group items by startDate
  const groupedItems = items.reduce(
    (groups, item) => {
      const dateKey = item.startDate || "";
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(item);
      return groups;
    },
    {} as Record<string, StoreWorkPlanItem[]>
  );

  // Sort dates chronologically
  const sortedDates = Object.keys(groupedItems).sort((a, b) => {
    if (!a) return 1;
    if (!b) return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="flex max-h-[26rem] w-full max-w-[min(24rem,calc(100vw-1rem))] shrink-0 flex-col self-end overflow-hidden rounded-l-xl border border-r-0 border-zinc-700/60 bg-zinc-950/95 shadow-[-8px_0_24px_rgba(0,0,0,0.35)] backdrop-blur-md slide-in-from-left sm:max-h-[32rem] sm:w-[26rem]">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-3">
        <div className="flex items-center gap-2">
          <CalendarRange className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-medium text-zinc-200">İş Planı</span>
          <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-xs text-emerald-300">
            {items.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isEditing && !isAdding && (
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-1 rounded bg-emerald-650 px-2 py-1 text-[11px] font-medium text-zinc-100 transition-colors hover:bg-emerald-750 cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              İş Ekle
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

      {/* Add Task Form */}
      {isAdding && (
        <form
          onSubmit={handleAdd}
          className="border-b border-zinc-800/80 bg-zinc-900/30 p-3 space-y-2.5 z-10"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Yeni İş Kalemi Ekle
          </div>
          <div className="space-y-2">
            <Input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="İş Tanımı..."
              required
              className="h-8 text-xs bg-zinc-950/60 border-zinc-800 focus:border-emerald-500/50"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-0.5 block text-[9px] text-zinc-500">Başlangıç</label>
                <Input
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  required
                  className="h-8 text-xs bg-zinc-950/60 border-zinc-800"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[9px] text-zinc-500">Bitiş</label>
                <Input
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                  className="h-8 text-xs bg-zinc-950/60 border-zinc-800"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-0.5 block text-[9px] text-zinc-500">Sorumlu</label>
                <Input
                  value={newResponsible}
                  onChange={(e) => setNewResponsible(e.target.value)}
                  placeholder="Ad Soyad..."
                  className="h-8 text-xs bg-zinc-950/60 border-zinc-800"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[9px] text-zinc-500">Durum</label>
                <Select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as WorkPlanStatus)}
                  className="h-8 text-xs bg-zinc-950/60 border-zinc-800"
                >
                  <option value="yapilacak">Yapılacak</option>
                  <option value="devam_ediyor">Devam Ediyor</option>
                  <option value="tamamlandi">Tamamlandı</option>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
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

      {/* Work Plan Grouped List */}
      <div className="scrollbar-themed flex-1 overflow-y-auto p-3 space-y-4">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-600">
            Henüz iş planı yok. Excel import veya "+ İş Ekle" ile başlayın.
          </p>
        ) : (
          sortedDates.map((dateKey) => (
            <div key={dateKey} className="space-y-2">
              <div className="flex items-center gap-2 border-b border-zinc-800 pb-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/70" />
                <span className="text-[11px] font-semibold text-zinc-400">
                  {formatDateSafe(dateKey)}
                </span>
                <span className="rounded bg-zinc-800/60 px-1 py-0.2 text-[9px] text-zinc-500">
                  {groupedItems[dateKey].length} İş
                </span>
              </div>
              <div className="space-y-2">
                {groupedItems[dateKey].map((item) => {
                  const isItemEditing = editingId === item.id;
                  const currentStatus = (item.status as WorkPlanStatus) || "yapilacak";

                  if (isItemEditing) {
                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-2.5 space-y-2"
                      >
                        <Input
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="h-7 text-xs bg-zinc-950/60"
                        />
                        <div className="grid grid-cols-2 gap-1.5">
                          <Input
                            type="date"
                            value={editStartDate}
                            onChange={(e) => setEditStartDate(e.target.value)}
                            className="h-7 text-[11px]"
                          />
                          <Input
                            type="date"
                            value={editEndDate}
                            onChange={(e) => setEditEndDate(e.target.value)}
                            className="h-7 text-[11px]"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <Input
                            value={editResponsible}
                            onChange={(e) => setEditResponsible(e.target.value)}
                            className="h-7 text-[11px]"
                            placeholder="Sorumlu"
                          />
                          <Select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value as WorkPlanStatus)}
                            className="h-7 text-[11px] py-0 px-1"
                          >
                            <option value="yapilacak">Yapılacak</option>
                            <option value="devam_ediyor">Devam Ediyor</option>
                            <option value="tamamlandi">Tamamlandı</option>
                          </Select>
                        </div>
                        <div className="flex justify-end gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-400 hover:bg-zinc-800 cursor-pointer"
                          >
                            İptal
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateSave(item.id)}
                            className="flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-0.5 text-[10px] font-medium text-white hover:bg-emerald-700 cursor-pointer"
                          >
                            <Check className="h-3 w-3" /> Kaydet
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={item.id}
                      className="group flex flex-col gap-1.5 rounded-lg border border-zinc-850 bg-zinc-900/30 p-2.5 hover:border-zinc-700 hover:bg-zinc-900/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium text-xs text-zinc-200 min-w-0 flex-1">
                          <TruncateWithTooltip text={item.description} />
                        </div>
                        {isEditing && (
                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => startEdit(item)}
                              className="text-zinc-500 hover:text-cyan-400 cursor-pointer p-0.5"
                              title="Düzenle"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(item.id)}
                              className="text-zinc-500 hover:text-red-400 cursor-pointer p-0.5"
                              title="Sil"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-500 border-t border-zinc-900/50 pt-1.5">
                        <div>
                          Sorumlu: <span className="text-zinc-400">{item.responsible}</span>
                        </div>
                        {item.endDate && (
                          <div>
                            Bitiş: <span className="text-zinc-400">{item.endDate}</span>
                          </div>
                        )}
                        <span className={`inline-flex items-center rounded border px-1.5 py-0.2 text-[9px] font-medium ${statusColors[currentStatus]}`}>
                          {statusLabels[currentStatus]}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {items.length > 0 && isEditing && (
        <div className="border-t border-zinc-800 px-3 py-3 z-10 bg-zinc-950/95">
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-xs text-red-400/80 cursor-pointer"
            onClick={onClear}
          >
            Tümünü Temizle
          </Button>
        </div>
      )}
    </div>
  );
}

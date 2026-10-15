"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { StoreWorkPlanItem, WorkPlanDependency, WorkPlanStatus } from "@/types";

export type WorkPlanFormValues = Pick<
  StoreWorkPlanItem,
  | "description"
  | "startDate"
  | "endDate"
  | "responsible"
  | "status"
  | "activityCode"
  | "wbsCode"
  | "percentComplete"
  | "predecessors"
>;

type WorkPlanFormModalProps = {
  open: boolean;
  /** Düzenlenen kalem; yoksa yeni kalem eklenir */
  item: StoreWorkPlanItem | null;
  candidates: StoreWorkPlanItem[];
  onClose: () => void;
  onSubmit: (values: WorkPlanFormValues) => void;
};

/**
 * İş planı kalemi ekleme/düzenleme formu. Her açılışta yeniden mount
 * edilmesi için çağıran taraf `key` verir; böylece alanlar kalemden dolar.
 */
export function WorkPlanFormModal({
  open,
  item,
  candidates,
  onClose,
  onSubmit,
}: WorkPlanFormModalProps) {
  const formId = useId();
  const [description, setDescription] = useState(item?.description ?? "");
  const [activityCode, setActivityCode] = useState(item?.activityCode ?? "");
  const [wbsCode, setWbsCode] = useState(item?.wbsCode ?? "");
  const [startDate, setStartDate] = useState(item?.startDate ?? "");
  const [endDate, setEndDate] = useState(item?.endDate ?? "");
  const [responsible, setResponsible] = useState(
    item?.responsible && item.responsible !== "Belirtilmemiş" ? item.responsible : ""
  );
  const [status, setStatus] = useState<WorkPlanStatus>(
    (item?.status as WorkPlanStatus) || "yapilacak"
  );
  const [percent, setPercent] = useState(String(item?.percentComplete ?? 0));
  const [predecessorIds, setPredecessorIds] = useState<string[]>(
    item?.predecessors.map((dependency) => dependency.predecessorId) ?? []
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const options = candidates.filter((candidate) => candidate.id !== item?.id);

  const handleStatusChange = (next: WorkPlanStatus) => {
    setStatus(next);
    if (next === "tamamlandi") setPercent("100");
    if (next === "yapilacak" && Number(percent) === 100) setPercent("0");
  };

  const handlePercentChange = (raw: string) => {
    setPercent(raw);
    const value = Number(raw);
    if (value >= 100) setStatus("tamamlandi");
    else if (value > 0 && status !== "devam_ediyor") setStatus("devam_ediyor");
  };

  const togglePredecessor = (id: string) =>
    setPredecessorIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!description.trim()) nextErrors.description = "İş tanımı zorunludur";
    if (!startDate) nextErrors.startDate = "Başlangıç tarihi zorunludur";
    if (startDate && endDate && endDate < startDate)
      nextErrors.endDate = "Bitiş tarihi başlangıçtan önce olamaz";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const predecessors: WorkPlanDependency[] = predecessorIds.map((predecessorId) => {
      const existing = item?.predecessors.find(
        (dependency) => dependency.predecessorId === predecessorId
      );
      return { predecessorId, type: existing?.type ?? "FS", lagHours: existing?.lagHours ?? 0 };
    });

    onSubmit({
      description: description.trim(),
      activityCode: activityCode.trim() || undefined,
      wbsCode: wbsCode.trim() || undefined,
      startDate,
      endDate,
      responsible: responsible.trim() || "Belirtilmemiş",
      status,
      percentComplete: Math.min(100, Math.max(0, Number(percent) || 0)),
      predecessors,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? "İş kalemini düzenle" : "Yeni iş kalemi"}
      description="Tarih, sorumlu ve ilerleme bilgilerini girin."
      className="sm:max-w-2xl"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" form={formId}>
            {item ? "Değişiklikleri kaydet" : "İş kalemini ekle"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
        <FormField
          label="İş tanımı"
          required
          error={errors.description}
          htmlFor={`${formId}-description`}
          className="sm:col-span-2"
        >
          <Input
            id={`${formId}-description`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Örn. Elektrik tesisatı"
            aria-invalid={!!errors.description}
          />
        </FormField>

        <FormField label="Aktivite kodu" htmlFor={`${formId}-activity`}>
          <Input
            id={`${formId}-activity`}
            value={activityCode}
            onChange={(event) => setActivityCode(event.target.value)}
            placeholder="Örn. A1010"
          />
        </FormField>
        <FormField label="WBS" htmlFor={`${formId}-wbs`}>
          <Input
            id={`${formId}-wbs`}
            value={wbsCode}
            onChange={(event) => setWbsCode(event.target.value)}
            placeholder="Örn. 1.2.3"
          />
        </FormField>

        <FormField label="Başlangıç tarihi" required error={errors.startDate}>
          <DatePicker
            value={startDate}
            onChange={setStartDate}
            required
            aria-label="Başlangıç tarihi"
            aria-invalid={!!errors.startDate}
          />
        </FormField>
        <FormField label="Bitiş tarihi" error={errors.endDate}>
          <DatePicker
            value={endDate}
            onChange={setEndDate}
            min={startDate || undefined}
            aria-label="Bitiş tarihi"
            aria-invalid={!!errors.endDate}
          />
        </FormField>

        <FormField label="Sorumlu" htmlFor={`${formId}-responsible`}>
          <Input
            id={`${formId}-responsible`}
            value={responsible}
            onChange={(event) => setResponsible(event.target.value)}
            placeholder="Kişi veya ekip"
          />
        </FormField>
        <FormField label="Durum" htmlFor={`${formId}-status`}>
          <Select
            id={`${formId}-status`}
            value={status}
            onChange={(event) => handleStatusChange(event.target.value as WorkPlanStatus)}
          >
            <option value="yapilacak">Yapılacak</option>
            <option value="devam_ediyor">Devam ediyor</option>
            <option value="tamamlandi">Tamamlandı</option>
          </Select>
        </FormField>

        <FormField label="Tamamlanma" htmlFor={`${formId}-percent`} className="sm:col-span-2">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Number(percent) || 0}
              onChange={(event) => handlePercentChange(event.target.value)}
              className="h-1.5 flex-1 cursor-pointer accent-cyan-500"
              aria-label="Tamamlanma yüzdesi"
            />
            <div className="relative w-24">
              <Input
                id={`${formId}-percent`}
                type="number"
                min={0}
                max={100}
                step="any"
                value={percent}
                onChange={(event) => handlePercentChange(event.target.value)}
                className="pr-7 text-right tabular-nums"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                %
              </span>
            </div>
          </div>
        </FormField>

        <FormField
          label="Öncül görevler"
          hint={options.length === 0 ? "Öncül seçmek için önce başka iş kalemi ekleyin." : "Bu iş, seçilen görevler bittikten sonra başlar."}
          className="sm:col-span-2"
        >
          {options.length > 0 && (
            <div className="scrollbar-themed max-h-40 overflow-y-auto rounded-lg border border-zinc-700/80 bg-zinc-900/40">
              {options.map((candidate) => {
                const checked = predecessorIds.includes(candidate.id);
                return (
                  <label
                    key={candidate.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 border-b border-zinc-800/60 px-3 py-2 text-sm last:border-b-0 transition-colors",
                      checked ? "bg-cyan-500/5" : "hover:bg-zinc-800/40"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePredecessor(candidate.id)}
                      className="h-4 w-4 shrink-0 cursor-pointer rounded accent-cyan-500"
                    />
                    {candidate.activityCode && (
                      <span className="shrink-0 font-mono text-xs text-zinc-500">
                        {candidate.activityCode}
                      </span>
                    )}
                    <span className="truncate text-zinc-300">{candidate.description}</span>
                  </label>
                );
              })}
            </div>
          )}
        </FormField>
      </form>
    </Modal>
  );
}

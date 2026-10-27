"use client";

import { useEffect, useId, useState } from "react";
import { format, parseISO } from "date-fns";
import { getDateLocale } from "@/i18n/runtime";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { useI18n, useT } from "@/contexts/i18n-context";
import { useStores } from "@/contexts/stores-context";
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  STATUS_LABELS,
  fetchAssignments,
  type AssignmentInput,
  type InventoryAssignment,
  type InventoryCategory,
  type InventoryItem,
  type InventoryItemInput,
  type InventoryStatus,
  type ReturnCondition,
  type ReturnInput,
} from "@/lib/inventory";
import { cn } from "@/lib/utils";

const today = () => format(new Date(), "yyyy-MM-dd");

export function formatDay(value?: string) {
  return value ? format(parseISO(value), "d MMM yyyy", { locale: getDateLocale() }) : "—";
}

function ErrorText({ message }: { message: string }) {
  return message ? (
    <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
      {message}
    </p>
  ) : null;
}

type SubmitState = { saving: boolean; error: string };

/** Eşya ekle / düzenle */
export function InventoryItemModal({
  item,
  state,
  onClose,
  onSubmit,
}: {
  item: InventoryItem | null;
  state: SubmitState;
  onClose: () => void;
  onSubmit: (input: InventoryItemInput) => void;
}) {
  const formId = useId();
  const t = useT();
  const [form, setForm] = useState<InventoryItemInput>({
    code: item?.code ?? "",
    name: item?.name ?? "",
    category: item?.category ?? "equipment",
    brand: item?.brand ?? "",
    serialNo: item?.serialNo ?? "",
    status: item?.status ?? "active",
    purchaseDate: item?.purchaseDate ?? "",
    notes: item?.notes ?? "",
    insuranceExpires: item?.insuranceExpires ?? "",
    cascoExpires: item?.cascoExpires ?? "",
    inspectionExpires: item?.inspectionExpires ?? "",
    odometerKm: item?.odometerKm ?? null,
  });
  const [nameError, setNameError] = useState("");
  const set = <K extends keyof InventoryItemInput>(key: K, value: InventoryItemInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Modal
      open
      onClose={onClose}
      className="sm:max-w-2xl"
      title={item ? t("inventory.itemModal.editTitle") : t("inventory.itemModal.newTitle")}
      description={t("inventory.itemModal.description")}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form={formId} loading={state.saving}>
            {item ? t("inventory.itemModal.save") : t("inventory.itemModal.add")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!form.name.trim()) {
            setNameError(t("inventory.itemModal.nameRequired"));
            return;
          }
          onSubmit(form);
        }}
      >
        <ErrorText message={state.error} />
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label={t("inventory.itemModal.code")}>
            <Input value={form.code} onChange={(e) => set("code", e.target.value)} placeholder={t("inventory.itemModal.codePlaceholder")} className="font-mono" />
          </FormField>
          <FormField label={t("inventory.itemModal.name")} required error={nameError} className="sm:col-span-2">
            <Input
              value={form.name}
              aria-invalid={!!nameError}
              placeholder={t("inventory.itemModal.namePlaceholder")}
              onChange={(e) => {
                set("name", e.target.value);
                if (nameError) setNameError("");
              }}
            />
          </FormField>
          <FormField label={t("inventory.itemModal.category")}>
            <Select value={form.category} onChange={(e) => set("category", e.target.value as InventoryCategory)}>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t("inventory.itemModal.brand")}>
            <Input value={form.brand} onChange={(e) => set("brand", e.target.value)} />
          </FormField>
          <FormField label={form.category === "vehicle" ? t("inventory.itemModal.plate") : t("inventory.itemModal.serialNo")}>
            <Input
              value={form.serialNo}
              onChange={(e) => set("serialNo", e.target.value)}
              className="font-mono"
              placeholder={form.category === "vehicle" ? "34 ABC 123" : undefined}
            />
          </FormField>
          <FormField label={t("inventory.itemModal.status")}>
            <Select value={form.status} onChange={(e) => set("status", e.target.value as InventoryStatus)}>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t("inventory.itemModal.purchaseDate")}>
            <DatePicker value={form.purchaseDate} onChange={(value) => set("purchaseDate", value)} />
          </FormField>
        </div>
        {form.category === "vehicle" && (
          <div className="grid gap-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 sm:grid-cols-4">
            <p className="text-xs text-zinc-500 sm:col-span-4">
              {t("inventory.itemModal.vehicleHint")}
            </p>
            <FormField label={t("inventory.itemModal.insuranceExpires")}>
              <DatePicker value={form.insuranceExpires} onChange={(value) => set("insuranceExpires", value)} />
            </FormField>
            <FormField label={t("inventory.itemModal.cascoExpires")}>
              <DatePicker value={form.cascoExpires} onChange={(value) => set("cascoExpires", value)} />
            </FormField>
            <FormField label={t("inventory.itemModal.inspectionExpires")}>
              <DatePicker value={form.inspectionExpires} onChange={(value) => set("inspectionExpires", value)} />
            </FormField>
            <FormField label={t("inventory.itemModal.odometer")}>
              <Input
                type="number"
                min={0}
                value={form.odometerKm ?? ""}
                onChange={(e) => set("odometerKm", e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value)) || 0))}
                className="tabular-nums"
              />
            </FormField>
          </div>
        )}
        <FormField label={t("inventory.itemModal.notes")}>
          <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </FormField>
      </form>
    </Modal>
  );
}

const OTHER_PERSON = "__other__";

/** Zimmetle ya da açık zimmeti düzenle */
export function AssignModal({
  item,
  state,
  onClose,
  onSubmit,
}: {
  item: InventoryItem;
  state: SubmitState;
  onClose: () => void;
  onSubmit: (input: AssignmentInput) => void;
}) {
  const formId = useId();
  const { t, locale } = useI18n();
  const { users } = useAuth();
  const { stores } = useStores();
  const existing = item.assignment;
  const [personId, setPersonId] = useState(existing ? existing.assigneeId ?? OTHER_PERSON : "");
  const [otherName, setOtherName] = useState(existing && !existing.assigneeId ? existing.assigneeName : "");
  const [storeId, setStoreId] = useState(existing?.storeId ?? "");
  const [assignedAt, setAssignedAt] = useState(existing?.assignedAt ?? today());
  const [expectedReturn, setExpectedReturn] = useState(existing?.expectedReturn ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [error, setError] = useState("");
  const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name, locale));

  return (
    <Modal
      open
      onClose={onClose}
      className="sm:max-w-xl"
      title={existing ? t("inventory.assignModal.editTitle") : t("inventory.assignModal.title")}
      description={`${item.code ? `${item.code} · ` : ""}${item.name}`}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form={formId} loading={state.saving}>
            {existing ? t("inventory.assignModal.save") : t("inventory.assignModal.submit")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const member = users.find((u) => u.id === personId);
          const assigneeName = member ? member.name : otherName.trim();
          if (!assigneeName) {
            setError(t("inventory.assignModal.personRequired"));
            return;
          }
          if (expectedReturn && expectedReturn < assignedAt) {
            setError(t("inventory.assignModal.returnBeforeAssign"));
            return;
          }
          onSubmit({
            assigneeId: member?.id,
            assigneeName,
            storeId: storeId || undefined,
            assignedAt,
            expectedReturn: expectedReturn || undefined,
            notes,
          });
        }}
      >
        <ErrorText message={state.error || error} />
        <FormField label={t("inventory.assignModal.person")} required>
          <Select value={personId} onChange={(e) => setPersonId(e.target.value)} placeholder={t("inventory.assignModal.personPlaceholder")}>
            {sortedUsers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
            <option value={OTHER_PERSON}>{t("inventory.assignModal.otherPerson")}</option>
          </Select>
        </FormField>
        {personId === OTHER_PERSON && (
          <FormField label={t("inventory.assignModal.fullName")} required hint={t("inventory.assignModal.fullNameHint")}>
            <Input value={otherName} onChange={(e) => setOtherName(e.target.value)} autoFocus />
          </FormField>
        )}
        <FormField label={t("inventory.assignModal.site")} hint={t("inventory.assignModal.optional")}>
          <Select value={storeId} onChange={(e) => setStoreId(e.target.value)} placeholder={t("inventory.assignModal.sitePlaceholder")}>
            <option value="">{t("inventory.assignModal.notSpecified")}</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("inventory.assignModal.assignedAt")} required>
            <DatePicker value={assignedAt} onChange={setAssignedAt} />
          </FormField>
          <FormField label={t("inventory.assignModal.expectedReturn")} hint={t("inventory.assignModal.optional")}>
            <DatePicker value={expectedReturn} onChange={setExpectedReturn} min={assignedAt || undefined} />
          </FormField>
        </div>
        <FormField label={t("inventory.assignModal.notes")}>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("inventory.assignModal.notesPlaceholder")} />
        </FormField>
      </form>
    </Modal>
  );
}

/** Teslim al */
export function ReturnModal({
  item,
  state,
  onClose,
  onSubmit,
}: {
  item: InventoryItem;
  state: SubmitState;
  onClose: () => void;
  onSubmit: (input: ReturnInput, markMaintenance: boolean) => void;
}) {
  const formId = useId();
  const t = useT();
  const assignedAt = item.assignment?.assignedAt ?? "";
  const [returnedAt, setReturnedAt] = useState(today() < assignedAt ? assignedAt : today());
  const [condition, setCondition] = useState<ReturnCondition>("good");
  const [notes, setNotes] = useState("");
  const [markMaintenance, setMarkMaintenance] = useState(false);

  return (
    <Modal
      open
      onClose={onClose}
      title={t("inventory.returnModal.title")}
      description={`${item.name} · ${item.assignment?.assigneeName ?? ""}`}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form={formId} loading={state.saving}>
            {t("inventory.returnModal.submit")}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ returnedAt, condition, notes }, condition === "damaged" && markMaintenance);
        }}
      >
        <ErrorText message={state.error} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("inventory.returnModal.returnedAt")} required>
            <DatePicker value={returnedAt} onChange={setReturnedAt} min={assignedAt || undefined} />
          </FormField>
          <FormField label={t("inventory.returnModal.condition")}>
            <Select value={condition} onChange={(e) => setCondition(e.target.value as ReturnCondition)}>
              {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        {condition === "damaged" && (
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={markMaintenance}
              onChange={(e) => setMarkMaintenance(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 accent-cyan-500"
            />
            {t("inventory.returnModal.markMaintenance")}
          </label>
        )}
        {condition === "lost" && (
          <p className="text-xs text-amber-400/90">
            {t("inventory.returnModal.lostHint")}
          </p>
        )}
        <FormField label={t("inventory.returnModal.notes")}>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("inventory.returnModal.notesPlaceholder")} />
        </FormField>
      </form>
    </Modal>
  );
}

/** Zimmet geçmişi */
export function HistoryModal({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const [state, setState] = useState<{ status: "loading" } | { status: "error" } | { status: "ready"; rows: InventoryAssignment[] }>({
    status: "loading",
  });
  const { stores } = useStores();
  const t = useT();

  useEffect(() => {
    let cancelled = false;
    fetchAssignments(item.id)
      .then((rows) => !cancelled && setState({ status: "ready", rows }))
      .catch((err) => {
        console.error("Zimmet geçmişi yüklenemedi:", err);
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  return (
    <Modal open onClose={onClose} className="sm:max-w-2xl" title={t("inventory.historyModal.title")} description={`${item.code ? `${item.code} · ` : ""}${item.name}`}>
      {state.status === "loading" && <p className="py-6 text-center text-sm text-zinc-500">{t("inventory.historyModal.loading")}</p>}
      {state.status === "error" && <p className="py-6 text-center text-sm text-red-400">{t("inventory.historyModal.error")}</p>}
      {state.status === "ready" &&
        (state.rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">{t("inventory.historyModal.empty")}</p>
        ) : (
          <ol className="space-y-3">
            {state.rows.map((row) => {
              const storeName = stores.find((store) => store.id === row.storeId)?.name;
              return (
                <li key={row.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-zinc-100">{row.assigneeName}</span>
                    {row.returnedAt ? (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs",
                          row.returnCondition === "good"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : row.returnCondition === "damaged"
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-red-500/10 text-red-400"
                        )}
                      >
                        {t("inventory.historyModal.returned", { condition: CONDITION_LABELS[row.returnCondition ?? "good"] })}
                      </span>
                    ) : (
                      <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-300">{t("inventory.historyModal.assigned")}</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {formatDay(row.assignedAt)} → {row.returnedAt ? formatDay(row.returnedAt) : "…"}
                    {storeName && ` · ${storeName}`}
                    {row.createdByName && t("inventory.historyModal.assignedBy", { name: row.createdByName })}
                    {row.returnedByName && t("inventory.historyModal.returnedBy", { name: row.returnedByName })}
                  </p>
                  {row.notes && <p className="mt-1.5 text-xs text-zinc-400">{t("inventory.historyModal.notes", { notes: row.notes })}</p>}
                  {row.returnNotes && <p className="mt-1 text-xs text-zinc-400">{t("inventory.historyModal.returnNotes", { notes: row.returnNotes })}</p>}
                </li>
              );
            })}
          </ol>
        ))}
    </Modal>
  );
}

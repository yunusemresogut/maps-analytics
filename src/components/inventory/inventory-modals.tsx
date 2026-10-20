"use client";

import { useEffect, useId, useState } from "react";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
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
  return value ? format(parseISO(value), "d MMM yyyy", { locale: tr }) : "—";
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
  const [form, setForm] = useState<InventoryItemInput>({
    code: item?.code ?? "",
    name: item?.name ?? "",
    category: item?.category ?? "equipment",
    brand: item?.brand ?? "",
    serialNo: item?.serialNo ?? "",
    status: item?.status ?? "active",
    purchaseDate: item?.purchaseDate ?? "",
    notes: item?.notes ?? "",
  });
  const [nameError, setNameError] = useState("");
  const set = <K extends keyof InventoryItemInput>(key: K, value: InventoryItemInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <Modal
      open
      onClose={onClose}
      className="sm:max-w-2xl"
      title={item ? "Envanteri düzenle" : "Yeni envanter"}
      description="Ekipman, araç ya da alet bilgilerini girin."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" form={formId} loading={state.saving}>
            {item ? "Kaydet" : "Ekle"}
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
            setNameError("Ad zorunludur");
            return;
          }
          onSubmit(form);
        }}
      >
        <ErrorText message={state.error} />
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Demirbaş no">
            <Input value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="ör. DMR-0012" className="font-mono" />
          </FormField>
          <FormField label="Ad" required error={nameError} className="sm:col-span-2">
            <Input
              value={form.name}
              aria-invalid={!!nameError}
              placeholder="ör. Kırıcı delici, Ford Transit"
              onChange={(e) => {
                set("name", e.target.value);
                if (nameError) setNameError("");
              }}
            />
          </FormField>
          <FormField label="Kategori">
            <Select value={form.category} onChange={(e) => set("category", e.target.value as InventoryCategory)}>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Marka / model">
            <Input value={form.brand} onChange={(e) => set("brand", e.target.value)} />
          </FormField>
          <FormField label={form.category === "vehicle" ? "Plaka" : "Seri no"}>
            <Input
              value={form.serialNo}
              onChange={(e) => set("serialNo", e.target.value)}
              className="font-mono"
              placeholder={form.category === "vehicle" ? "34 ABC 123" : undefined}
            />
          </FormField>
          <FormField label="Durum">
            <Select value={form.status} onChange={(e) => set("status", e.target.value as InventoryStatus)}>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Alış tarihi">
            <DatePicker value={form.purchaseDate} onChange={(value) => set("purchaseDate", value)} />
          </FormField>
        </div>
        <FormField label="Not">
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
  const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name, "tr"));

  return (
    <Modal
      open
      onClose={onClose}
      className="sm:max-w-xl"
      title={existing ? "Zimmeti düzenle" : "Zimmetle"}
      description={`${item.code ? `${item.code} · ` : ""}${item.name}`}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" form={formId} loading={state.saving}>
            {existing ? "Kaydet" : "Zimmetle"}
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
            setError("Zimmetlenecek kişiyi seçin ya da adını yazın");
            return;
          }
          if (expectedReturn && expectedReturn < assignedAt) {
            setError("Teslim tarihi zimmet tarihinden önce olamaz");
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
        <FormField label="Kişi" required>
          <Select value={personId} onChange={(e) => setPersonId(e.target.value)} placeholder="Kişi seçin">
            {sortedUsers.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
            <option value={OTHER_PERSON}>Listede yok (adını yaz)</option>
          </Select>
        </FormField>
        {personId === OTHER_PERSON && (
          <FormField label="Ad soyad" required hint="Uygulamada hesabı olmayan kişi (ör. taşeron ustası).">
            <Input value={otherName} onChange={(e) => setOtherName(e.target.value)} autoFocus />
          </FormField>
        )}
        <FormField label="Kullanılacağı şantiye" hint="İsteğe bağlı">
          <Select value={storeId} onChange={(e) => setStoreId(e.target.value)} placeholder="Şantiye seçin">
            <option value="">Belirtilmedi</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Zimmet tarihi" required>
            <DatePicker value={assignedAt} onChange={setAssignedAt} />
          </FormField>
          <FormField label="Planlanan teslim" hint="İsteğe bağlı">
            <DatePicker value={expectedReturn} onChange={setExpectedReturn} min={assignedAt || undefined} />
          </FormField>
        </div>
        <FormField label="Not">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ör. Şarj aleti ve 2 batarya ile verildi" />
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
  const assignedAt = item.assignment?.assignedAt ?? "";
  const [returnedAt, setReturnedAt] = useState(today() < assignedAt ? assignedAt : today());
  const [condition, setCondition] = useState<ReturnCondition>("good");
  const [notes, setNotes] = useState("");
  const [markMaintenance, setMarkMaintenance] = useState(false);

  return (
    <Modal
      open
      onClose={onClose}
      title="Teslim al"
      description={`${item.name} · ${item.assignment?.assigneeName ?? ""}`}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" form={formId} loading={state.saving}>
            Teslim al
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
          <FormField label="Teslim tarihi" required>
            <DatePicker value={returnedAt} onChange={setReturnedAt} min={assignedAt || undefined} />
          </FormField>
          <FormField label="Durumu">
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
            Eşyayı bakıma al
          </label>
        )}
        {condition === "lost" && (
          <p className="text-xs text-amber-400/90">
            Kayıp eşya envanterde kalır; gerekirse düzenleyerek “Hurdaya ayrıldı” yapabilirsiniz.
          </p>
        )}
        <FormField label="Not">
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ör. Kablosu yıpranmış" />
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
    <Modal open onClose={onClose} className="sm:max-w-2xl" title="Zimmet geçmişi" description={`${item.code ? `${item.code} · ` : ""}${item.name}`}>
      {state.status === "loading" && <p className="py-6 text-center text-sm text-zinc-500">Yükleniyor…</p>}
      {state.status === "error" && <p className="py-6 text-center text-sm text-red-400">Geçmiş yüklenemedi.</p>}
      {state.status === "ready" &&
        (state.rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">Bu eşya henüz kimseye zimmetlenmedi.</p>
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
                        Teslim alındı · {CONDITION_LABELS[row.returnCondition ?? "good"]}
                      </span>
                    ) : (
                      <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-300">Zimmette</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {formatDay(row.assignedAt)} → {row.returnedAt ? formatDay(row.returnedAt) : "…"}
                    {storeName && ` · ${storeName}`}
                    {row.createdByName && ` · zimmetleyen ${row.createdByName}`}
                    {row.returnedByName && ` · teslim alan ${row.returnedByName}`}
                  </p>
                  {row.notes && <p className="mt-1.5 text-xs text-zinc-400">Not: {row.notes}</p>}
                  {row.returnNotes && <p className="mt-1 text-xs text-zinc-400">Teslim notu: {row.returnNotes}</p>}
                </li>
              );
            })}
          </ol>
        ))}
    </Modal>
  );
}

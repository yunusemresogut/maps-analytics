"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { Ban, Check, CircleCheckBig, Info, Pencil, Plus, Trash2, X } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { useMyPersonnelId } from "@/hooks/use-my-personnel";
import { usePermissions } from "@/hooks/use-permissions";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { logActivity } from "@/lib/activity-log";
import { formatMoney } from "@/lib/currency";
import { fetchAllPersonnel, fetchPersonnel, hrErrorMessage, type Personnel } from "@/lib/hr";
import {
  REQUEST_COMPLETE_LABELS,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_STYLES,
  REQUEST_TYPE_LABELS,
  createPersonnelRequest,
  deletePersonnelRequest,
  fetchPersonnelRequests,
  refreshHrNotifications,
  setPersonnelRequestStatus,
  updatePersonnelRequest,
  type PersonnelRequest,
  type PersonnelRequestInput,
  type RequestStatus,
  type RequestType,
} from "@/lib/hr-admin";
import { cn } from "@/lib/utils";

type Tab = "pending" | "mine" | "all";
type SubmitState = { saving: boolean; error: string };

const REQUEST_HINTS: Partial<Record<RequestType, string>> = {
  advance:
    "Avans sonraki ücretten mahsup edilir. Mahsup için personelin yazılı onayının alınması önerilir; tutar bordroda gösterilmelidir.",
  document: "İşten ayrılan personel istediğinde çalışma belgesi verilmesi zorunludur (İş Kanunu md. 28).",
};

const formatStamp = (value: string) => format(parseISO(value), "d MMM yyyy", { locale: tr });

function RequestsContent() {
  const { user } = useAuth();
  const { canView, canAdd, canEdit, canDelete } = usePermissions("hrRequests");
  const { myPersonnelId, loaded: myLoaded } = useMyPersonnelId();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [statusFilter, setStatusFilter] = usePersistentState("hrRequests", "status", "all");
  const [typeFilter, setTypeFilter] = usePersistentState("hrRequests", "type", "all");
  const [tab, setTab] = useState<Tab | null>(null);
  const [requests, setRequests] = useState<PersonnelRequest[] | null>(null);
  const [pending, setPending] = useState<PersonnelRequest[]>([]);
  const [people, setPeople] = useState<Personnel[]>([]);
  const [version, setVersion] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState<{ request: PersonnelRequest | null } | null>(null);
  const [deciding, setDeciding] = useState<{ request: PersonnelRequest; status: RequestStatus } | null>(null);
  const [submit, setSubmit] = useState<SubmitState>({ saving: false, error: "" });
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const flash = (tone: "success" | "error", text: string) => {
    setNotice({ tone, text });
    window.setTimeout(() => setNotice(null), 3500);
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchPersonnelRequests({ year }), fetchPersonnelRequests({ statuses: ["pending", "approved"] })])
      .then(([yearRows, openRows]) => {
        if (cancelled) return;
        setRequests(yearRows);
        setPending(openRows);
        setLoadError("");
      })
      .catch((err) => {
        console.error("Talepler yüklenemedi:", err);
        if (!cancelled) setLoadError("Talepler yüklenemedi. Veritabanı güncellemesi (İK Faz 4 migration'ı) uygulanmamış olabilir.");
      });
    return () => {
      cancelled = true;
    };
  }, [year, version]);

  useEffect(() => {
    let cancelled = false;
    const load = canAdd
      ? fetchAllPersonnel().then((all) => all.filter((p) => p.state === "active"))
      : myPersonnelId
        ? fetchPersonnel(myPersonnelId).then((p) => (p ? [p] : []))
        : Promise.resolve([]);
    load.then((rows) => !cancelled && setPeople(rows)).catch((err) => console.error("Personel yüklenemedi:", err));
    return () => {
      cancelled = true;
    };
  }, [canAdd, myPersonnelId]);

  // Sonuçlandırılacaklar: bekleyen (onay / ret) ve onaylanmış (tamamlama) talepler, kendi talebi hariç
  const toHandle = useMemo(
    () => (canEdit ? pending.filter((r) => r.personnelUserId !== user?.id || user?.role === "admin") : []),
    [pending, canEdit, user]
  );
  const mine = useMemo(() => (requests ?? []).filter((r) => r.personnelId === myPersonnelId), [requests, myPersonnelId]);

  const tabs = useMemo(() => {
    const list: { key: Tab; label: string; count?: number }[] = [];
    if (canEdit) list.push({ key: "pending", label: "Sonuçlandırılacaklar", count: toHandle.length });
    if (myPersonnelId) list.push({ key: "mine", label: "Taleplerim" });
    if (canView) list.push({ key: "all", label: "Tüm talepler" });
    return list;
  }, [canEdit, canView, myPersonnelId, toHandle.length]);
  const activeTab: Tab | undefined = tab && tabs.some((t) => t.key === tab) ? tab : tabs[0]?.key;

  const log = useCallback(
    (action: string, message: string, request: Pick<PersonnelRequest, "personnelId" | "personnelName">) => {
      if (!user) return;
      logActivity({
        category: "hr",
        action,
        message,
        actorId: user.id,
        actorName: user.name,
        targetId: request.personnelId,
        targetLabel: request.personnelName,
      });
    },
    [user]
  );

  const listFor = (key: Tab) => {
    if (key === "pending") return toHandle;
    const base = key === "mine" ? mine : (requests ?? []);
    return base.filter((r) => (statusFilter === "all" || r.status === statusFilter) && (typeFilter === "all" || r.type === typeFilter));
  };

  const cancel = async (request: PersonnelRequest) => {
    if (!confirm("Talep iptal edilsin mi?")) return;
    try {
      await setPersonnelRequestStatus(request.id, "cancelled");
      log("cancel", `Talep iptal edildi: ${request.personnelName} · ${request.title}`, request);
      setVersion((v) => v + 1);
      refreshHrNotifications();
    } catch (err) {
      flash("error", hrErrorMessage(err, "Talep iptal edilemedi."));
    }
  };

  const remove = async (request: PersonnelRequest) => {
    if (!confirm("Talep kalıcı olarak silinsin mi?")) return;
    try {
      await deletePersonnelRequest(request.id);
      log("delete", `Talep silindi: ${request.personnelName} · ${request.title}`, request);
      setVersion((v) => v + 1);
    } catch (err) {
      flash("error", hrErrorMessage(err, "Talep silinemedi."));
    }
  };

  if (myLoaded && !myPersonnelId && tabs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-zinc-500">
        Hesabınız bir personel kartına bağlı değil. İnsan kaynaklarına başvurun.
      </div>
    );
  }

  return (
    <div className="scrollbar-themed h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Talep kutusu</h1>
          <p className="mt-1 text-sm text-zinc-500">Avans, belge, malzeme, eğitim ve diğer talepler insan kaynaklarına iletilir.</p>
        </div>
        {(canAdd || myPersonnelId) && people.length > 0 && (
          <Button
            onClick={() => {
              setSubmit({ saving: false, error: "" });
              setEditing({ request: null });
            }}
          >
            <Plus className="h-4 w-4" />
            Yeni talep
          </Button>
        )}
      </div>

      {tabs.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1 border-b border-zinc-800" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={activeTab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors",
                activeTab === t.key ? "border-cyan-400 text-cyan-300" : "border-transparent text-zinc-400 hover:text-zinc-200"
              )}
            >
              {t.label}
              {!!t.count && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-brand-on">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={cn(
            "mb-4 rounded-lg border px-4 py-2.5 text-sm",
            notice.tone === "error" ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          )}
        >
          {notice.text}
        </p>
      )}
      {loadError && (
        <p role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {loadError}
        </p>
      )}

      {activeTab !== "pending" && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-auto min-w-[110px]" aria-label="Yıl">
            {[0, 1, 2, 3].map((offset) => {
              const value = new Date().getFullYear() - offset;
              return (
                <option key={value} value={value}>
                  {value}
                </option>
              );
            })}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto min-w-[150px]" aria-label="Durum">
            <option value="all">Tüm durumlar</option>
            {Object.entries(REQUEST_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-auto min-w-[160px]" aria-label="Tür">
            <option value="all">Tüm türler</option>
            {Object.entries(REQUEST_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label.split(" (")[0]}
              </option>
            ))}
          </Select>
        </div>
      )}

      {requests === null && !loadError ? (
        <ul className="flex flex-col gap-2" aria-hidden>
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i} className="h-[76px] animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40" />
          ))}
        </ul>
      ) : !activeTab || listFor(activeTab).length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-12 text-center text-sm text-zinc-500">
          {activeTab === "pending" ? "Sonuçlandırılacak talep yok." : "Bu dönemde talep yok."}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {listFor(activeTab).map((request) => {
            const own = request.personnelId === myPersonnelId;
            const decidable = canEdit && (!own || user?.role === "admin");
            return (
              <li
                key={request.id}
                className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-3.5 lg:flex-row lg:items-center lg:gap-6"
              >
                <div className="min-w-0 lg:w-[30%] lg:shrink-0">
                  <p className="truncate text-sm font-medium text-zinc-100">{request.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {REQUEST_TYPE_LABELS[request.type].split(" (")[0]}
                    {request.amount !== null && ` · ${formatMoney(request.amount, "TRY")}`}
                  </p>
                </div>
                <div className="min-w-0 lg:w-[22%]">
                  <Link href={`/hr/personnel/${request.personnelId}`} className="truncate text-sm text-zinc-200 hover:text-cyan-300">
                    {request.personnelName}
                  </Link>
                  <p className="text-xs text-zinc-500">{formatStamp(request.createdAt)}</p>
                </div>
                <div className="min-w-0 flex-1 text-xs text-zinc-500">
                  <span className={cn("inline-flex rounded-full border px-2 py-0.5 font-medium", REQUEST_STATUS_STYLES[request.status])}>
                    {request.status === "completed" ? REQUEST_COMPLETE_LABELS[request.type] : REQUEST_STATUS_LABELS[request.status]}
                  </span>
                  {request.description && <p className="mt-1 line-clamp-2 text-zinc-400">{request.description}</p>}
                  {request.decidedByName && (
                    <p className="mt-1">
                      {request.decidedByName}
                      {request.decidedAt && ` · ${formatStamp(request.decidedAt)}`}
                      {request.decisionNote && <span className="text-zinc-400"> — “{request.decisionNote}”</span>}
                    </p>
                  )}
                  {request.completedByName && request.completedAt && (
                    <p>
                      {REQUEST_COMPLETE_LABELS[request.type]}: {request.completedByName} · {formatStamp(request.completedAt)}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {decidable && request.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSubmit({ saving: false, error: "" });
                          setDeciding({ request, status: "approved" });
                        }}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Onayla
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          setSubmit({ saving: false, error: "" });
                          setDeciding({ request, status: "rejected" });
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                        Reddet
                      </Button>
                    </>
                  )}
                  {decidable && request.status === "approved" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSubmit({ saving: false, error: "" });
                        setDeciding({ request, status: "completed" });
                      }}
                    >
                      <CircleCheckBig className="h-3.5 w-3.5" />
                      {REQUEST_COMPLETE_LABELS[request.type]}
                    </Button>
                  )}
                  {request.status === "pending" && (own || canEdit) && (
                    <Button size="sm" variant="ghost" onClick={() => void cancel(request)}>
                      <Ban className="h-3.5 w-3.5" />
                      İptal
                    </Button>
                  )}
                  {canEdit && (request.status === "pending" || request.status === "approved") && (
                    <button
                      type="button"
                      aria-label="Düzelt"
                      title="Düzelt"
                      onClick={() => {
                        setSubmit({ saving: false, error: "" });
                        setEditing({ request });
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-100"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      aria-label="Sil"
                      title="Sil"
                      onClick={() => void remove(request)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <RequestModal
          people={editing.request ? [] : people}
          request={editing.request}
          state={submit}
          onClose={() => setEditing(null)}
          onSubmit={(input) => {
            setSubmit({ saving: true, error: "" });
            const existing = editing.request;
            const task = existing ? updatePersonnelRequest(existing.id, input) : createPersonnelRequest(input);
            task
              .then(() => {
                const name = existing?.personnelName ?? people.find((p) => p.id === input.personnelId)?.fullName ?? "";
                log(existing ? "update" : "create", `Talep ${existing ? "düzeltildi" : "oluşturuldu"}: ${name} · ${input.title}`, {
                  personnelId: input.personnelId,
                  personnelName: name,
                });
                setEditing(null);
                setVersion((v) => v + 1);
                refreshHrNotifications();
                flash("success", existing ? "Talep düzeltildi." : "Talebiniz insan kaynaklarına iletildi.");
                if (!existing && input.personnelId === myPersonnelId) setTab("mine");
              })
              .catch((err) => {
                console.error("Talep kaydedilemedi:", err);
                setSubmit({ saving: false, error: hrErrorMessage(err, "Talep kaydedilemedi.") });
              });
          }}
        />
      )}
      {deciding && (
        <DecisionModal
          request={deciding.request}
          status={deciding.status}
          state={submit}
          onClose={() => setDeciding(null)}
          onSubmit={(note) => {
            setSubmit({ saving: true, error: "" });
            setPersonnelRequestStatus(deciding.request.id, deciding.status, note)
              .then(() => {
                const label =
                  deciding.status === "completed"
                    ? REQUEST_COMPLETE_LABELS[deciding.request.type].toLocaleLowerCase("tr-TR")
                    : REQUEST_STATUS_LABELS[deciding.status].toLocaleLowerCase("tr-TR");
                log(deciding.status, `Talep ${label}: ${deciding.request.personnelName} · ${deciding.request.title}`, deciding.request);
                setDeciding(null);
                setVersion((v) => v + 1);
                refreshHrNotifications();
                flash("success", `Talep ${label}.`);
              })
              .catch((err) => setSubmit({ saving: false, error: hrErrorMessage(err, "İşlem yapılamadı.") }));
          }}
        />
      )}
    </div>
  );
}

function RequestModal({
  people,
  request,
  state,
  onClose,
  onSubmit,
}: {
  people: Personnel[];
  request: PersonnelRequest | null;
  state: SubmitState;
  onClose: () => void;
  onSubmit: (input: PersonnelRequestInput) => void;
}) {
  const formId = useId();
  const [form, setForm] = useState<PersonnelRequestInput>({
    personnelId: request?.personnelId ?? (people.length === 1 ? people[0].id : ""),
    type: request?.type ?? "advance",
    title: request?.title ?? "",
    description: request?.description ?? "",
    amount: request?.amount ?? null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof PersonnelRequestInput>(key: K, value: PersonnelRequestInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.personnelId) next.personnelId = "Personel seçin";
    if (!form.title.trim()) next.title = "Başlık zorunludur";
    if (form.type === "advance" && !(form.amount && form.amount > 0)) next.amount = "Avans tutarı 0'dan büyük olmalı";
    return next;
  };

  return (
    <Modal
      open
      onClose={onClose}
      className="sm:max-w-xl"
      title={request ? "Talebi düzelt" : "Yeni talep"}
      description={request?.personnelName}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" form={formId} loading={state.saving}>
            {request ? "Kaydet" : "Gönder"}
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
          const next = validate();
          setErrors(next);
          if (Object.keys(next).length === 0) onSubmit(form);
        }}
      >
        {(state.error || Object.keys(errors).length > 0) && (
          <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {state.error || "Lütfen işaretli alanları kontrol edin."}
          </p>
        )}
        {people.length > 1 && (
          <FormField label="Personel" required error={errors.personnelId}>
            <Select
              value={form.personnelId}
              onChange={(e) => set("personnelId", e.target.value)}
              placeholder="Personel seçin"
              aria-invalid={!!errors.personnelId}
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                  {p.code ? ` (${p.code})` : ""}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Talep türü" required>
            <Select value={form.type} onChange={(e) => set("type", e.target.value as RequestType)}>
              {Object.entries(REQUEST_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          {form.type === "advance" && (
            <FormField label="Tutar (TL)" required error={errors.amount}>
              <Input
                type="number"
                min={0}
                step={50}
                value={form.amount ?? ""}
                onChange={(e) => set("amount", e.target.value === "" ? null : Number(e.target.value))}
                aria-invalid={!!errors.amount}
                className="tabular-nums"
              />
            </FormField>
          )}
        </div>
        <FormField label="Başlık" required error={errors.title}>
          <Input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder={form.type === "advance" ? "ör. Kasım ayı avansı" : form.type === "document" ? "ör. SGK hizmet dökümü" : undefined}
            aria-invalid={!!errors.title}
          />
        </FormField>
        <FormField label="Açıklama">
          <Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </FormField>
        {REQUEST_HINTS[form.type] && (
          <p className="flex gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {REQUEST_HINTS[form.type]}
          </p>
        )}
      </form>
    </Modal>
  );
}

function DecisionModal({
  request,
  status,
  state,
  onClose,
  onSubmit,
}: {
  request: PersonnelRequest;
  status: RequestStatus;
  state: SubmitState;
  onClose: () => void;
  onSubmit: (note: string) => void;
}) {
  const formId = useId();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const title =
    status === "approved" ? "Talebi onayla" : status === "rejected" ? "Talebi reddet" : `${REQUEST_COMPLETE_LABELS[request.type]} olarak işaretle`;

  return (
    <Modal
      open
      onClose={onClose}
      className="sm:max-w-lg"
      title={title}
      description={`${request.personnelName} · ${request.title}${request.amount !== null ? ` · ${formatMoney(request.amount, "TRY")}` : ""}`}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" form={formId} loading={state.saving} variant={status === "rejected" ? "danger" : "default"}>
            {status === "approved" ? "Onayla" : status === "rejected" ? "Reddet" : REQUEST_COMPLETE_LABELS[request.type]}
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
          if (status === "rejected" && !note.trim()) {
            setError("Ret gerekçesi zorunludur");
            return;
          }
          onSubmit(note);
        }}
      >
        {state.error && (
          <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {state.error}
          </p>
        )}
        {request.description && (
          <p className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-300">{request.description}</p>
        )}
        <FormField
          label={status === "rejected" ? "Ret gerekçesi" : "Not"}
          required={status === "rejected"}
          error={error}
          hint={status === "completed" && request.type === "advance" ? "ör. ödeme tarihi, dekont no, mahsup edilecek ay" : undefined}
        >
          <Textarea
            rows={3}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              if (error) setError("");
            }}
            aria-invalid={!!error}
          />
        </FormField>
      </form>
    </Modal>
  );
}

export default function RequestsPage() {
  return (
    <AuthGuard routeKey="hrRequests">
      <RequestsContent />
    </AuthGuard>
  );
}

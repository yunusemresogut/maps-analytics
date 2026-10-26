"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { Info } from "lucide-react";
import { formatDay, today, type SubmitState } from "@/components/hr/hr-modals";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSettings } from "@/contexts/settings-context";
import { fetchPersonnelPrivate, formatHours, type Personnel } from "@/lib/hr";
import {
  LEAVE_STATUS_LABELS,
  LEAVE_TYPE_HINTS,
  LEAVE_TYPE_LABELS,
  PENDING_STATUSES,
  computeLeaveBalance,
  countLeaveDays,
  fetchLeaveRequests,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveRequestInput,
  type LeaveType,
} from "@/lib/leaves";
import { cn } from "@/lib/utils";

type Errors = Record<string, string>;

function ErrorText({ message }: { message: string }) {
  return message ? (
    <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
      {message}
    </p>
  ) : null;
}

/** Personelin yıllık izin durumu ve mevcut talepleri (çakışma kontrolü için) */
export function usePersonnelLeaves(person: Personnel | undefined, refreshKey?: unknown) {
  const [state, setState] = useState<{ personId: string; requests: LeaveRequest[]; birthDate?: string } | null>(null);
  const personId = person?.id;

  useEffect(() => {
    if (!personId) return;
    let cancelled = false;
    Promise.all([
      fetchLeaveRequests({ personnelId: personId }),
      // Doğum tarihi yalnızca yetkiliye açıktır; yoksa yaş kuralı uygulanmaz
      fetchPersonnelPrivate(personId).catch(() => null),
    ])
      .then(([requests, privateInfo]) => {
        if (!cancelled) setState({ personId, requests, birthDate: privateInfo?.birthDate || undefined });
      })
      .catch((err) => console.error("İzinler yüklenemedi:", err));
    return () => {
      cancelled = true;
    };
  }, [personId, refreshKey]);

  const current = state && state.personId === personId ? state : null;
  const balance = useMemo<LeaveBalance | null>(
    () =>
      person && current
        ? computeLeaveBalance({
            startDate: person.startDate,
            birthDate: current.birthDate,
            adjustment: person.leaveAdjustment,
            requests: current.requests,
          })
        : null,
    [person, current]
  );
  return { requests: current?.requests ?? null, balance };
}

/** Yıllık izin özeti (kart ve form) */
export function LeaveBalanceSummary({ balance, compact }: { balance: LeaveBalance; compact?: boolean }) {
  const items = [
    { label: "Hak edilen", value: balance.earned + balance.adjustment },
    { label: "Kullanılan", value: balance.used },
    { label: "Onay bekleyen", value: balance.pending },
    { label: "Kalan", value: balance.remaining, tone: balance.remaining < 0 ? "text-red-400" : "text-emerald-400" },
  ];
  return (
    <div>
      <dl className={cn("grid gap-3", compact ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-4")}>
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-xs text-zinc-500">{item.label}</dt>
            <dd className={cn("font-semibold tabular-nums text-zinc-100", item.tone)}>{formatHours(item.value)} gün</dd>
          </div>
        ))}
      </dl>
      {!compact && (
        <p className="mt-3 text-xs text-zinc-500">
          {balance.serviceYears} yıl hizmet
          {balance.adjustment !== 0 && ` · ${balance.adjustment > 0 ? "+" : ""}${formatHours(balance.adjustment)} gün düzeltme dahil`}
          {balance.nextAccrual && ` · ${formatDay(balance.nextAccrual.date)} tarihinde +${balance.nextAccrual.days} gün`}
          {balance.ageUnknown && " · Yaş kuralı (18 yaş altı / 50 yaş üstü en az 20 gün) için doğum tarihi gerekir"}
        </p>
      )}
    </div>
  );
}

/** İzin talebi: personel kendisi için, İK herkes için oluşturur; İK düzeltme de yapar */
export function LeaveRequestModal({
  people,
  request,
  state,
  onClose,
  onSubmit,
}: {
  /** Seçilebilecek personel (tek kişiyse seçim gösterilmez) */
  people: Personnel[];
  /** Düzeltme (İK) */
  request?: LeaveRequest | null;
  state: SubmitState;
  onClose: () => void;
  onSubmit: (input: LeaveRequestInput) => void;
}) {
  const formId = useId();
  const { org } = useSettings();
  const saturdayWorking = org.hr.saturdayWorking;
  const [form, setForm] = useState<LeaveRequestInput>({
    personnelId: request?.personnelId ?? (people.length === 1 ? people[0].id : ""),
    type: request?.type ?? "annual",
    startDate: request?.startDate ?? "",
    endDate: request?.endDate ?? "",
    dayCount: request?.dayCount ?? 0,
    reason: request?.reason ?? "",
  });
  // Gün sayısı elle değiştirilmedikçe tarihlerden hesaplanır
  const [dayCountTouched, setDayCountTouched] = useState(!!request);
  const [errors, setErrors] = useState<Errors>({});
  const person = people.find((p) => p.id === form.personnelId);
  const { requests, balance } = usePersonnelLeaves(person);

  const autoDays = countLeaveDays(form.startDate, form.endDate, saturdayWorking);
  const dayCount = dayCountTouched ? form.dayCount : autoDays;
  const calendarDays =
    form.startDate && form.endDate && form.endDate >= form.startDate
      ? differenceInCalendarDays(parseISO(form.endDate), parseISO(form.startDate)) + 1
      : 0;

  const set = <K extends keyof LeaveRequestInput>(key: K, value: LeaveRequestInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const overlapping = (requests ?? []).find(
    (other) =>
      other.id !== request?.id &&
      (other.status === "approved" || PENDING_STATUSES.includes(other.status)) &&
      form.startDate &&
      form.endDate &&
      other.startDate <= form.endDate &&
      other.endDate >= form.startDate
  );

  const validate = (): Errors => {
    const next: Errors = {};
    if (!form.personnelId) next.personnelId = "Personel seçin";
    if (!form.startDate) next.startDate = "Başlangıç tarihi zorunludur";
    if (!form.endDate) next.endDate = "Bitiş tarihi zorunludur";
    else if (form.startDate && form.endDate < form.startDate) next.endDate = "Bitiş tarihi başlangıçtan önce olamaz";
    else if (calendarDays > 366) next.endDate = "İzin en fazla bir yıl olabilir";
    if (!(dayCount > 0)) next.dayCount = "Gün sayısı 0'dan büyük olmalı";
    else if (calendarDays && dayCount > calendarDays) next.dayCount = `En fazla ${calendarDays} gün olabilir`;
    if (overlapping) {
      next.startDate = `Bu tarihlerde ${LEAVE_STATUS_LABELS[overlapping.status].toLocaleLowerCase("tr-TR")} bir izin var (${formatDay(overlapping.startDate)} – ${formatDay(overlapping.endDate)})`;
    }
    return next;
  };

  // Düzeltilen talep zaten kullanılan / bekleyen günlerde sayılıdır
  const ownDays =
    request && request.type === "annual" && (request.status === "approved" || PENDING_STATUSES.includes(request.status))
      ? request.dayCount
      : 0;
  const remainingAfter =
    balance && form.type === "annual" ? balance.remaining - balance.pending + ownDays - dayCount : null;

  return (
    <Modal
      open
      onClose={onClose}
      className="sm:max-w-2xl"
      title={request ? "İzin talebini düzelt" : "İzin talebi"}
      description={request ? request.personnelName : "Talep önce yöneticinize, sonra insan kaynaklarına onaya gider."}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" form={formId} loading={state.saving}>
            {request ? "Kaydet" : "Talep oluştur"}
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
          if (Object.keys(next).length === 0) onSubmit({ ...form, dayCount });
        }}
      >
        <ErrorText message={state.error || (Object.keys(errors).length > 0 ? "Lütfen işaretli alanları kontrol edin." : "")} />
        <div className="grid gap-4 sm:grid-cols-2">
          {people.length > 1 && !request && (
            <FormField label="Personel" required error={errors.personnelId} className="sm:col-span-2">
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
          <FormField label="İzin türü" required className="sm:col-span-2">
            <Select
              value={form.type}
              onChange={(e) => set("type", e.target.value as LeaveType)}
              disabled={request?.status === "approved"}
            >
              {Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Başlangıç" required error={errors.startDate}>
            <DatePicker
              value={form.startDate}
              onChange={(value) => {
                set("startDate", value);
                if (!form.endDate || form.endDate < value) set("endDate", value);
              }}
              disabled={request?.status === "approved"}
              aria-invalid={!!errors.startDate}
            />
          </FormField>
          <FormField label="Bitiş (dahil)" required error={errors.endDate}>
            <DatePicker
              value={form.endDate}
              onChange={(value) => set("endDate", value)}
              min={form.startDate || undefined}
              disabled={request?.status === "approved"}
              aria-invalid={!!errors.endDate}
            />
          </FormField>
          <FormField
            label="İzinden düşülecek gün"
            required
            error={errors.dayCount}
            hint={
              dayCountTouched && dayCount !== autoDays
                ? `Hesaplanan: ${autoDays} gün`
                : `Pazar${saturdayWorking ? "" : ", Cumartesi"} ve sabit resmî tatiller sayılmaz; dini bayramları düşün`
            }
          >
            <Input
              type="number"
              min={0.5}
              step={0.5}
              value={dayCount || ""}
              onChange={(e) => {
                setDayCountTouched(true);
                set("dayCount", Number(e.target.value));
              }}
              aria-invalid={!!errors.dayCount}
            />
          </FormField>
          {form.type === "annual" && balance && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400">
              <p>
                Kalan yıllık izin: <b className="text-zinc-100">{formatHours(balance.remaining - balance.pending)} gün</b>
                {balance.pending > 0 && ` (${formatHours(balance.pending)} gün onay bekliyor)`}
              </p>
              {remainingAfter !== null && remainingAfter < 0 && (
                <p className="mt-1 text-amber-400">Bu talep kalan hakkı {formatHours(-remainingAfter)} gün aşıyor (avans izin).</p>
              )}
            </div>
          )}
        </div>
        {LEAVE_TYPE_HINTS[form.type] && (
          <p className="flex gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {LEAVE_TYPE_HINTS[form.type]}
          </p>
        )}
        {form.type === "annual" && person && !person.startDate && (
          <p className="text-xs text-amber-400">Personelin işe giriş tarihi girilmemiş; yıllık izin hakkı hesaplanamıyor.</p>
        )}
        {person?.employmentType === "subcontractor" && (
          <p className="text-xs text-amber-400">
            Taşeron personelin yıllık izni alt işverenin yükümlülüğündedir; bu kayıt yalnızca puantaj ve takip içindir.
          </p>
        )}
        <FormField label="Açıklama">
          <Textarea rows={2} value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="ör. Yaz tatili, evlilik izni" />
        </FormField>
      </form>
    </Modal>
  );
}

/** Onay / ret; ret gerekçesi zorunludur */
export function LeaveDecisionModal({
  request,
  approve,
  finalStep,
  state,
  onClose,
  onSubmit,
}: {
  request: LeaveRequest;
  approve: boolean;
  /** Onay izni kesinleştirip puantaja yazar mı (İK onayı) */
  finalStep: boolean;
  state: SubmitState;
  onClose: () => void;
  onSubmit: (note: string) => void;
}) {
  const formId = useId();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  return (
    <Modal
      open
      onClose={onClose}
      className="sm:max-w-lg"
      title={approve ? "İzni onayla" : "İzni reddet"}
      description={`${request.personnelName} · ${LEAVE_TYPE_LABELS[request.type]} · ${formatDay(request.startDate)} – ${formatDay(request.endDate)} (${formatHours(request.dayCount)} gün)`}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" form={formId} loading={state.saving} variant={approve ? "default" : "danger"}>
            {approve ? "Onayla" : "Reddet"}
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
          if (!approve && !note.trim()) {
            setError("Ret gerekçesi zorunludur");
            return;
          }
          onSubmit(note);
        }}
      >
        <ErrorText message={state.error} />
        {approve && (
          <p className="text-sm text-zinc-400">
            {finalStep
              ? "İzin kesinleşir ve günler puantaja yazılır. O günlere ait mevcut puantaj kayıtları izinle değiştirilir."
              : "Talep insan kaynaklarının onayına gönderilir."}
          </p>
        )}
        {request.reason && (
          <p className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-sm text-zinc-300">
            <span className="text-xs text-zinc-500">Açıklama: </span>
            {request.reason}
          </p>
        )}
        <FormField label={approve ? "Not" : "Ret gerekçesi"} required={!approve} error={error}>
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
        {request.startDate < today() && approve && finalStep && (
          <p className="text-xs text-amber-400">İzin başlangıcı geçmiş bir tarih; kapatılmış aylara yazılamaz.</p>
        )}
      </form>
    </Modal>
  );
}

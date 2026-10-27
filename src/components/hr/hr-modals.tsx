"use client";

import { useId, useState } from "react";
import { format, parseISO } from "date-fns";
import { Paperclip, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-context";
import { useI18n, useT } from "@/contexts/i18n-context";
import { getDateLocale } from "@/i18n/runtime";
import { useStores } from "@/contexts/stores-context";
import { ALLOWED_FILE_ACCEPT } from "@/lib/file-types";
import {
  CERTIFICATE_TYPE_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  MAX_DAILY_HOURS,
  TIMESHEET_STATUS,
  TIMESHEET_STATUSES,
  WORKING_STATUSES,
  formatIban,
  isValidIban,
  isValidNationalId,
  suggestedExpiry,
  validateHrFile,
  type Certificate,
  type CertificateInput,
  type CertificateType,
  type EmploymentType,
  type Personnel,
  type PersonnelInput,
  type PersonnelPrivateInput,
  type TimesheetEntryInput,
  type TimesheetStatus,
} from "@/lib/hr";
import { getRoleLabel } from "@/lib/roles";
import { isValidEmail, isValidPhone } from "@/lib/validation";

export type SubmitState = { saving: boolean; error: string };
type Errors = Record<string, string>;

export const today = () => format(new Date(), "yyyy-MM-dd");

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

function ModalFooter({ formId, onClose, saving, label }: { formId: string; onClose: () => void; saving: boolean; label: string }) {
  const t = useT();
  return (
    <>
      <Button type="button" variant="ghost" onClick={onClose}>
        {t("hr.common.cancel")}
      </Button>
      <Button type="submit" form={formId} loading={saving}>
        {label}
      </Button>
    </>
  );
}

/** Form durumu + alan hataları; alan değişince hatası temizlenir */
function useForm<T extends Record<string, unknown>>(initial: T) {
  const [form, setForm] = useState<T>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const set = <K extends keyof T>(key: K, value: T[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };
  return { form, set, errors, setErrors };
}

// ---------------------------------------------------------------------------
// Personel kartı
// ---------------------------------------------------------------------------

export function PersonnelModal({
  person,
  state,
  onClose,
  onSubmit,
}: {
  person: Personnel | null;
  state: SubmitState;
  onClose: () => void;
  onSubmit: (input: PersonnelInput) => void;
}) {
  const formId = useId();
  const { t, locale } = useI18n();
  const { users, organization } = useAuth();
  const { stores } = useStores();
  const { form, set, errors, setErrors } = useForm<PersonnelInput>({
    code: person?.code ?? "",
    fullName: person?.fullName ?? "",
    userId: person?.userId,
    employmentType: person?.employmentType ?? "office",
    subcontractorCompany: person?.subcontractorCompany ?? "",
    department: person?.department ?? "",
    jobTitle: person?.jobTitle ?? "",
    phone: person?.phone ?? "",
    email: person?.email ?? "",
    storeId: person?.storeId,
    startDate: person?.startDate ?? "",
    endDate: person?.endDate ?? "",
    privacyNoticeDate: person?.privacyNoticeDate ?? "",
    notes: person?.notes ?? "",
    managerId: person?.managerId,
    leaveAdjustment: person?.leaveAdjustment ?? 0,
  });
  const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name, locale));

  const validate = (): Errors => {
    const next: Errors = {};
    if (!form.fullName.trim()) next.fullName = t("hr.personnelForm.fullNameRequired");
    if (!form.startDate) next.startDate = t("hr.personnelForm.startDateRequired");
    if (form.employmentType === "subcontractor" && !form.subcontractorCompany.trim())
      next.subcontractorCompany = t("hr.personnelForm.subcontractorRequired");
    if (form.endDate && form.startDate && form.endDate < form.startDate)
      next.endDate = t("hr.personnelForm.endBeforeStart");
    if (!isValidPhone(form.phone)) next.phone = t("hr.common.invalidPhone");
    if (form.email.trim() && !isValidEmail(form.email)) next.email = t("hr.common.invalidEmail");
    if (form.managerId && form.managerId === form.userId) next.managerId = t("hr.personnelForm.selfManager");
    if (!Number.isFinite(form.leaveAdjustment) || Math.abs(form.leaveAdjustment) > 365)
      next.leaveAdjustment = t("hr.personnelForm.adjustmentRange");
    return next;
  };

  return (
    <Modal
      open
      onClose={onClose}
      className="sm:max-w-3xl"
      title={person ? t("hr.personnelForm.editTitle") : t("hr.personnelForm.newTitle")}
      description={t("hr.personnelForm.description")}
      footer={<ModalFooter formId={formId} onClose={onClose} saving={state.saving} label={person ? t("common.save") : t("common.add")} />}
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
        <ErrorText message={state.error || (Object.keys(errors).length > 0 ? t("hr.common.checkFields") : "")} />
        <div className="grid gap-4 sm:grid-cols-4">
          <FormField label={t("hr.common.code")}>
            <Input value={form.code} onChange={(e) => set("code", e.target.value)} className="font-mono" placeholder={t("hr.personnelForm.codePlaceholder")} />
          </FormField>
          <FormField label={t("hr.common.fullName")} required error={errors.fullName} className="sm:col-span-3">
            <Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} aria-invalid={!!errors.fullName} />
          </FormField>
          <FormField label={t("hr.common.employmentType")} required className="sm:col-span-2">
            <Select value={form.employmentType} onChange={(e) => set("employmentType", e.target.value as EmploymentType)}>
              {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          {form.employmentType === "subcontractor" ? (
            <FormField label={t("hr.common.subcontractor")} required error={errors.subcontractorCompany} className="sm:col-span-2">
              <Input
                value={form.subcontractorCompany}
                onChange={(e) => set("subcontractorCompany", e.target.value)}
                aria-invalid={!!errors.subcontractorCompany}
              />
            </FormField>
          ) : (
            <FormField label={t("hr.common.department")} className="sm:col-span-2">
              <Input value={form.department} onChange={(e) => set("department", e.target.value)} placeholder={t("hr.personnelForm.departmentPlaceholder")} />
            </FormField>
          )}
          <FormField label={t("hr.common.jobTitle")} className="sm:col-span-2">
            <Input value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} placeholder={t("hr.personnelForm.jobTitlePlaceholder")} />
          </FormField>
          <FormField label={t("hr.personnelForm.location")} className="sm:col-span-2">
            <Select value={form.storeId ?? ""} onChange={(e) => set("storeId", e.target.value || undefined)}>
              <option value="">{t("hr.common.headOffice")}</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t("hr.common.phone")} error={errors.phone} className="sm:col-span-2">
            <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" aria-invalid={!!errors.phone} />
          </FormField>
          <FormField label={t("hr.common.email")} error={errors.email} className="sm:col-span-2">
            <Input value={form.email} onChange={(e) => set("email", e.target.value)} type="email" aria-invalid={!!errors.email} />
          </FormField>
          <FormField label={t("hr.common.startDate")} required error={errors.startDate}>
            <DatePicker value={form.startDate} onChange={(value) => set("startDate", value)} aria-invalid={!!errors.startDate} />
          </FormField>
          <FormField label={t("hr.common.endDate")} error={errors.endDate}>
            <DatePicker
              value={form.endDate}
              onChange={(value) => set("endDate", value)}
              min={form.startDate || undefined}
              aria-invalid={!!errors.endDate}
            />
          </FormField>
          <FormField label={t("hr.personnelForm.appUser")} hint={t("hr.personnelForm.appUserHint")} className="sm:col-span-2">
            <Select value={form.userId ?? ""} onChange={(e) => set("userId", e.target.value || undefined)}>
              <option value="">{t("hr.personnelForm.notLinked")}</option>
              {sortedUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {getRoleLabel(u.role, organization)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label={t("hr.personnelForm.manager")}
            error={errors.managerId}
            hint={t("hr.personnelForm.managerHint")}
            className="sm:col-span-2"
          >
            <Select
              value={form.managerId ?? ""}
              onChange={(e) => set("managerId", e.target.value || undefined)}
              aria-invalid={!!errors.managerId}
            >
              <option value="">{t("hr.personnelForm.noManager")}</option>
              {sortedUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {getRoleLabel(u.role, organization)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label={t("hr.personnelForm.leaveAdjustment")}
            error={errors.leaveAdjustment}
            hint={t("hr.personnelForm.leaveAdjustmentHint")}
          >
            <Input
              type="number"
              step={0.5}
              value={form.leaveAdjustment}
              onChange={(e) => set("leaveAdjustment", Number(e.target.value))}
              aria-invalid={!!errors.leaveAdjustment}
            />
          </FormField>
          <FormField label={t("hr.personnelForm.privacyNotice")} hint={t("hr.personnelForm.privacyNoticeHint")}>
            <DatePicker value={form.privacyNoticeDate} onChange={(value) => set("privacyNoticeDate", value)} />
          </FormField>
        </div>
        <FormField label={t("hr.common.note")}>
          <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </FormField>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Özlük (hassas) bilgileri
// ---------------------------------------------------------------------------

export function PrivateInfoModal({
  person,
  value,
  state,
  onClose,
  onSubmit,
}: {
  person: Personnel;
  value: PersonnelPrivateInput | null;
  state: SubmitState;
  onClose: () => void;
  onSubmit: (input: PersonnelPrivateInput) => void;
}) {
  const formId = useId();
  const t = useT();
  const { form, set, errors, setErrors } = useForm<PersonnelPrivateInput>({
    nationalId: value?.nationalId ?? "",
    birthDate: value?.birthDate ?? "",
    address: value?.address ?? "",
    iban: value?.iban ? formatIban(value.iban) : "",
    emergencyContactName: value?.emergencyContactName ?? "",
    emergencyContactPhone: value?.emergencyContactPhone ?? "",
  });

  const validate = (): Errors => {
    const next: Errors = {};
    if (form.nationalId.trim() && !isValidNationalId(form.nationalId.trim()))
      next.nationalId = t("hr.privateForm.invalidNationalId");
    if (form.iban.trim() && !isValidIban(form.iban)) next.iban = t("hr.privateForm.invalidIban");
    if (form.birthDate && form.birthDate > today()) next.birthDate = t("hr.privateForm.birthDateFuture");
    if (!isValidPhone(form.emergencyContactPhone)) next.emergencyContactPhone = t("hr.common.invalidPhone");
    return next;
  };

  return (
    <Modal
      open
      onClose={onClose}
      className="sm:max-w-2xl"
      title={t("hr.privateForm.title")}
      description={person.fullName}
      footer={<ModalFooter formId={formId} onClose={onClose} saving={state.saving} label={t("common.save")} />}
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
        <p className="flex gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {t("hr.privateForm.kvkkNotice")}
        </p>
        <ErrorText message={state.error || (Object.keys(errors).length > 0 ? t("hr.common.checkFields") : "")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("hr.privateForm.nationalId")} error={errors.nationalId}>
            <Input
              value={form.nationalId}
              onChange={(e) => set("nationalId", e.target.value.replace(/\D/g, "").slice(0, 11))}
              inputMode="numeric"
              className="font-mono"
              aria-invalid={!!errors.nationalId}
            />
          </FormField>
          <FormField label={t("hr.privateForm.birthDate")} error={errors.birthDate}>
            <DatePicker value={form.birthDate} onChange={(v) => set("birthDate", v)} max={today()} aria-invalid={!!errors.birthDate} />
          </FormField>
          <FormField label="IBAN" error={errors.iban} className="sm:col-span-2">
            <Input
              value={form.iban}
              onChange={(e) => set("iban", e.target.value.toUpperCase())}
              placeholder="TR00 0000 0000 0000 0000 0000 00"
              className="font-mono"
              aria-invalid={!!errors.iban}
            />
          </FormField>
          <FormField label={t("hr.privateForm.address")} className="sm:col-span-2">
            <Textarea rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} />
          </FormField>
          <FormField label={t("hr.privateForm.emergencyContact")}>
            <Input value={form.emergencyContactName} onChange={(e) => set("emergencyContactName", e.target.value)} />
          </FormField>
          <FormField label={t("hr.privateForm.emergencyPhone")} error={errors.emergencyContactPhone}>
            <Input
              value={form.emergencyContactPhone}
              onChange={(e) => set("emergencyContactPhone", e.target.value)}
              inputMode="tel"
              aria-invalid={!!errors.emergencyContactPhone}
            />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Belge / sertifika
// ---------------------------------------------------------------------------

export function CertificateModal({
  certificate,
  canVerify,
  state,
  onClose,
  onSubmit,
}: {
  certificate: Certificate | null;
  /** İK onayı verebilir mi (personel düzenleme yetkisi) */
  canVerify: boolean;
  state: SubmitState;
  onClose: () => void;
  onSubmit: (input: CertificateInput, file: File | null) => void;
}) {
  const formId = useId();
  const t = useT();
  const { form, set, errors, setErrors } = useForm<CertificateInput>({
    type: certificate?.type ?? "isg_training",
    name: certificate?.name ?? "",
    documentNo: certificate?.documentNo ?? "",
    issuer: certificate?.issuer ?? "",
    issuedAt: certificate?.issuedAt ?? "",
    expiresAt: certificate?.expiresAt ?? "",
    notes: certificate?.notes ?? "",
    // İK'nın eklediği belge varsayılan olarak onaylıdır
    verified: certificate ? certificate.verified : canVerify,
  });
  const [file, setFile] = useState<File | null>(null);
  const suggestion = suggestedExpiry(form.type, form.issuedAt);

  const validate = (): Errors => {
    const next: Errors = {};
    if (form.type === "other" && !form.name.trim()) next.name = t("hr.certificateForm.nameRequired");
    if (form.expiresAt && form.issuedAt && form.expiresAt < form.issuedAt)
      next.expiresAt = t("hr.certificateForm.expiryBeforeIssue");
    if (file) {
      const fileError = validateHrFile(file);
      if (fileError) next.file = fileError;
    }
    return next;
  };

  return (
    <Modal
      open
      onClose={onClose}
      className="sm:max-w-2xl"
      title={certificate ? t("hr.certificateForm.editTitle") : t("hr.certificateForm.newTitle")}
      description={certificate?.personnelName}
      footer={<ModalFooter formId={formId} onClose={onClose} saving={state.saving} label={certificate ? t("common.save") : t("common.add")} />}
    >
      <form
        id={formId}
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          const next = validate();
          setErrors(next);
          if (Object.keys(next).length === 0) onSubmit(form, file);
        }}
      >
        <ErrorText message={state.error || (Object.keys(errors).length > 0 ? t("hr.common.checkFields") : "")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("hr.certificateForm.type")} required>
            <Select value={form.type} onChange={(e) => set("type", e.target.value as CertificateType)}>
              {Object.entries(CERTIFICATE_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={t("hr.certificateForm.name")} required={form.type === "other"} error={errors.name} hint={t("hr.certificateForm.nameHint")}>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!errors.name} />
          </FormField>
          <FormField label={t("hr.certificateForm.documentNo")}>
            <Input value={form.documentNo} onChange={(e) => set("documentNo", e.target.value)} className="font-mono" />
          </FormField>
          <FormField label={t("hr.certificateForm.issuer")}>
            <Input value={form.issuer} onChange={(e) => set("issuer", e.target.value)} placeholder={t("hr.certificateForm.issuerPlaceholder")} />
          </FormField>
          <FormField label={t("hr.certificateForm.issuedAt")}>
            <DatePicker value={form.issuedAt} onChange={(value) => set("issuedAt", value)} max={today()} />
          </FormField>
          <FormField
            label={t("hr.certificateForm.expiresAt")}
            error={errors.expiresAt}
            hint={form.expiresAt ? undefined : t("hr.certificateForm.expiresAtHint")}
          >
            <DatePicker
              value={form.expiresAt}
              onChange={(value) => set("expiresAt", value)}
              min={form.issuedAt || undefined}
              aria-invalid={!!errors.expiresAt}
            />
            {suggestion && suggestion !== form.expiresAt && (
              <button
                type="button"
                onClick={() => set("expiresAt", suggestion)}
                className="mt-1 text-xs text-cyan-400 hover:underline"
              >
                {t("hr.certificateForm.suggested", { date: formatDay(suggestion) })}
              </button>
            )}
          </FormField>
        </div>
        {form.type === "health_check" && (
          <p className="flex gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {t("hr.certificateForm.healthNotice")}
          </p>
        )}
        <FormField
          label={t("hr.certificateForm.file")}
          error={errors.file}
          hint={
            certificate?.fileName && !file
              ? t("hr.certificateForm.currentFile", { name: certificate.fileName })
              : t("hr.certificateForm.fileHint")
          }
        >
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-700 px-3 py-2.5 text-sm text-zinc-400 hover:border-zinc-600 hover:text-zinc-200">
            <Paperclip className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{file ? file.name : certificate?.fileName ? t("hr.certificateForm.changeFile") : t("hr.certificateForm.chooseFile")}</span>
            <input
              type="file"
              accept={ALLOWED_FILE_ACCEPT}
              className="sr-only"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.file;
                  return next;
                });
              }}
            />
          </label>
        </FormField>
        <FormField label={t("hr.common.note")}>
          <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </FormField>
        {canVerify ? (
          <Switch
            checked={form.verified}
            onChange={(checked) => set("verified", checked)}
            label={t("hr.certificateForm.verified")}
          />
        ) : (
          <p className="text-xs text-zinc-500">{t("hr.certificateForm.pendingNotice")}</p>
        )}
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Puantaj günü
// ---------------------------------------------------------------------------

export function TimesheetEntryModal({
  person,
  date,
  entry,
  defaultHours,
  state,
  onClose,
  onSubmit,
  onClear,
}: {
  person: Personnel;
  date: string;
  entry: TimesheetEntryInput | null;
  defaultHours: number;
  state: SubmitState;
  onClose: () => void;
  onSubmit: (input: TimesheetEntryInput) => void;
  onClear?: () => void;
}) {
  const formId = useId();
  const { t, dateLocale } = useI18n();
  const { stores } = useStores();
  const { form, set, errors, setErrors } = useForm<TimesheetEntryInput>({
    status: entry?.status ?? "worked",
    hours: entry?.hours ?? defaultHours,
    overtimeHours: entry?.overtimeHours ?? 0,
    storeId: entry?.storeId ?? person.storeId,
    notes: entry?.notes ?? "",
  });
  const working = WORKING_STATUSES.includes(form.status);

  const setStatus = (status: TimesheetStatus) => {
    set("status", status);
    if (status === "half_day") set("hours", defaultHours / 2);
    else if (status === "worked" && form.status !== "worked") set("hours", defaultHours);
  };

  const validate = (): Errors => {
    const next: Errors = {};
    if (!working) return next;
    if (!Number.isFinite(form.hours) || form.hours < 0 || form.hours > 24) next.hours = t("hr.timesheetForm.hoursRange");
    if (!Number.isFinite(form.overtimeHours) || form.overtimeHours < 0) next.overtimeHours = t("hr.timesheetForm.overtimeMin");
    if (form.hours + form.overtimeHours > 24) next.overtimeHours = t("hr.timesheetForm.totalMax");
    return next;
  };
  const total = working ? form.hours + form.overtimeHours : 0;

  return (
    <Modal
      open
      onClose={onClose}
      className="sm:max-w-lg"
      title={person.fullName}
      description={format(parseISO(date), "d MMMM yyyy, EEEE", { locale: dateLocale })}
      footer={
        <>
          {onClear && (
            <Button type="button" variant="ghost" className="mr-auto text-red-400 hover:text-red-300" onClick={onClear}>
              {t("hr.timesheetForm.clearDay")}
            </Button>
          )}
          <ModalFooter formId={formId} onClose={onClose} saving={state.saving} label={t("common.save")} />
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
        <ErrorText message={state.error} />
        <FormField label={t("common.status")} required>
          <Select value={form.status} onChange={(e) => setStatus(e.target.value as TimesheetStatus)}>
            {TIMESHEET_STATUSES.map((status) => (
              <option key={status} value={status}>
                {TIMESHEET_STATUS[status].code} — {TIMESHEET_STATUS[status].label}
              </option>
            ))}
          </Select>
        </FormField>
        {working && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t("hr.timesheetForm.hours")} error={errors.hours}>
              <Input
                type="number"
                min={0}
                max={24}
                step={0.5}
                value={form.hours}
                onChange={(e) => set("hours", Number(e.target.value))}
                aria-invalid={!!errors.hours}
              />
            </FormField>
            <FormField label={t("hr.timesheetForm.overtime")} error={errors.overtimeHours}>
              <Input
                type="number"
                min={0}
                max={24}
                step={0.5}
                value={form.overtimeHours}
                onChange={(e) => set("overtimeHours", Number(e.target.value))}
                aria-invalid={!!errors.overtimeHours}
              />
            </FormField>
          </div>
        )}
        {total > MAX_DAILY_HOURS && (
          <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90">
            {t("hr.timesheetForm.maxDailyWarning", { total })}
          </p>
        )}
        <FormField label={t("hr.timesheetForm.site")}>
          <Select value={form.storeId ?? ""} onChange={(e) => set("storeId", e.target.value || undefined)}>
            <option value="">{t("hr.common.headOffice")}</option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label={t("hr.common.note")}>
          <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder={t("hr.timesheetForm.notePlaceholder")} />
        </FormField>
      </form>
    </Modal>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ModuleFormShell } from "@/components/modules/module-form-shell";
import { PendingAttachments } from "@/components/modules/pending-attachments";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/contexts/i18n-context";
import { uploadModuleAttachments } from "@/lib/upload-module-attachment";
import { useModules } from "@/contexts/modules-context";
import { useDb } from "@/contexts/db-context";
import { usePermissions } from "@/hooks/use-permissions";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/money-input";
import { useSettings } from "@/contexts/settings-context";
import type { CurrencyCode } from "@/lib/currency";
import { encodePaymentPeriod, PAYMENT_STATUS_LABELS } from "@/lib/module-finance";
import type { ProgressPaymentStatus } from "@/types";

function NewPaymentContent() {
  const t = useT();
  const router = useRouter();
  const { createPayment } = useModules();
  const { contracts } = useDb();
  const { canAdd } = usePermissions("progressPayments");
  const { user } = useAuth();
  const { org } = useSettings();

  const [title, setTitle] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [currency, setCurrency] = useState<CurrencyCode>(org.defaults.currency);
  const [contractId, setContractId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [status, setStatus] = useState<ProgressPaymentStatus>("draft");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const invalid = {
    contract: !contractId,
    title: !title.trim(),
    start: !periodStart,
    end: !periodEnd || (!!periodStart && periodEnd < periodStart),
  };

  if (!canAdd) {
    return <div className="flex h-full items-center justify-center text-sm text-zinc-500">{t("finance.shared.noAddPermission")}</div>;
  }

  const onContractChange = (id: string) => {
    const c = contracts.find((x) => x.id === id);
    setContractId(id);
    setStoreId(c?.storeId ?? "");
    // Hakediş varsayılan olarak sözleşmenin para biriminde
    if (c) setCurrency(c.currency);
  };

  const save = async () => {
    if (createdId) return;
    setShowErrors(true);
    if (invalid.contract || invalid.title || invalid.start || !periodEnd) {
      setSaveError(t("finance.payments.requiredFields"));
      return;
    }
    if (periodEnd < periodStart) {
      setSaveError(t("finance.shared.endBeforeStart"));
      return;
    }
    setSaveError("");
    setSaving(true);
    const id = await createPayment({
      title: title.trim(),
      periodLabel: encodePaymentPeriod(periodStart, periodEnd),
      amount: amount ?? 0,
      currency,
      contractId,
      storeId: storeId || undefined,
      status,
    });
    if (!id) {
      setSaving(false);
      setSaveError(t("finance.payments.createFailed"));
      return;
    }
    setCreatedId(id);
    if (attachments.length > 0 && user) {
      const errors = await uploadModuleAttachments({
        table: "progress_payment_attachments",
        parentId: id,
        files: attachments,
        user,
      });
      if (errors.length > 0) {
        setSaving(false);
        setSaveError(t("finance.payments.attachmentsFailed", { errors: errors.join(" ") }));
        return;
      }
    }
    router.push("/progress-payments");
  };

  return (
    <ModuleFormShell backHref="/progress-payments" backLabel={t("finance.payments.backLabel")} title={t("finance.payments.newTitle")} onSave={save} saving={saving} saveLabel={t("finance.shared.create")} canSave={!createdId}>
      {saveError && (
        <p role="alert" className="text-sm text-red-400">
          {saveError}
          {createdId && (
            <Link href={`/progress-payments/${createdId}/edit`} className="ml-2 underline underline-offset-2">
              {t("finance.payments.open")}
            </Link>
          )}
        </p>
      )}
      <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div>
          <label className="text-xs text-zinc-500">{t("finance.shared.contract")} *</label>
          <Select className="mt-1" value={contractId} onChange={(e) => onContractChange(e.target.value)} aria-invalid={showErrors && invalid.contract}>
            <option value="">{t("finance.shared.select")}</option>
            {contracts.filter((c) => c.status === "active" || c.status === "draft").map((c) => (
              <option key={c.id} value={c.id}>{c.code ? `${c.code} — ` : ""}{c.title}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="text-xs text-zinc-500">{t("finance.shared.title")} *</label>
          <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={showErrors && invalid.title} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-500">{t("finance.payments.periodStart")} *</label>
            <DatePicker className="mt-1" value={periodStart} onChange={setPeriodStart} aria-invalid={showErrors && invalid.start} />
          </div>
          <div>
            <label className="text-xs text-zinc-500">{t("finance.payments.periodEnd")} *</label>
            <DatePicker className="mt-1" value={periodEnd} onChange={setPeriodEnd} min={periodStart || undefined} aria-invalid={showErrors && invalid.end} />
          </div>
          <div>
            <label className="text-xs text-zinc-500">{t("finance.payments.totalAmount")}</label>
            <MoneyInput className="mt-1" value={amount} onValueChange={setAmount} currency={currency} onCurrencyChange={setCurrency} />
          </div>
          <div>
            <label className="text-xs text-zinc-500">{t("finance.shared.status")}</label>
            <Select className="mt-1" value={status} onChange={(e) => setStatus(e.target.value as ProgressPaymentStatus)}>
              {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>
        </div>
        <PendingAttachments files={attachments} onChange={setAttachments} />
      </div>
    </ModuleFormShell>
  );
}

export default function NewPaymentPage() {
  return (
    <AuthGuard routeKey="progressPayments">
      <NewPaymentContent />
    </AuthGuard>
  );
}

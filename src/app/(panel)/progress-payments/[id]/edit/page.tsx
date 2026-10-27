"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ModuleFormShell } from "@/components/modules/module-form-shell";
import { ModuleAttachments } from "@/components/modules/module-attachments";
import { useModules } from "@/contexts/modules-context";
import { useDb } from "@/contexts/db-context";
import { useT } from "@/contexts/i18n-context";
import { usePageTitle } from "@/contexts/page-title-context";
import { usePermissions } from "@/hooks/use-permissions";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/money-input";
import { DEFAULT_CURRENCY, formatMoney, formatMoneyTotals, type CurrencyCode } from "@/lib/currency";
import {
  encodePaymentPeriod,
  paidAmountForPayment,
  parsePaymentPeriod,
  PAYMENT_STATUS_LABELS,
} from "@/lib/module-finance";
import type { ProgressPaymentStatus } from "@/types";

function EditPaymentContent({ id }: { id: string }) {
  const router = useRouter();
  const { progressPayments, updatePayment, deletePayment } = useModules();
  const { contracts, invoices } = useDb();
  const { canEdit, canDelete } = usePermissions("progressPayments");
  const t = useT();
  const payment = progressPayments.find((p) => p.id === id);
  usePageTitle(payment?.title);
  const initialPeriod = parsePaymentPeriod(payment?.periodLabel ?? "");

  const [title, setTitle] = useState(payment?.title ?? "");
  const periodLabel = payment?.periodLabel ?? "";
  const [periodStart, setPeriodStart] = useState(initialPeriod.startDate);
  const [periodEnd, setPeriodEnd] = useState(initialPeriod.endDate);
  const [amount, setAmount] = useState<number | null>(payment?.amount ?? null);
  const [currency, setCurrency] = useState<CurrencyCode>(payment?.currency ?? DEFAULT_CURRENCY);
  const [contractId, setContractId] = useState(payment?.contractId ?? "");
  const [status, setStatus] = useState<ProgressPaymentStatus>(payment?.status ?? "draft");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  if (!payment) {
    return <div className="flex h-full items-center justify-center text-sm text-zinc-500">{t("common.noData")}</div>;
  }

  const contract = contracts.find((c) => c.id === contractId);
  const paid = paidAmountForPayment(id, invoices);
  // Dönem isteğe bağlı; girildiyse iki tarih birlikte ve sıralı olmalı
  const periodPartial = (!!periodStart || !!periodEnd) && (!periodStart || !periodEnd);
  const invalid = {
    title: !title.trim(),
    start: periodPartial && !periodStart,
    end: (periodPartial && !periodEnd) || (!!periodStart && !!periodEnd && periodEnd < periodStart),
  };

  const save = async () => {
    if (!canEdit) return;
    setShowErrors(true);
    if (invalid.title) {
      setSaveError(t("finance.shared.titleRequired"));
      return;
    }
    if (periodPartial) {
      setSaveError(t("finance.payments.periodPartial"));
      return;
    }
    if (periodStart && periodEnd && periodEnd < periodStart) {
      setSaveError(t("finance.shared.endBeforeStart"));
      return;
    }
    setSaveError("");
    setSaving(true);
    const ok = await updatePayment(id, {
      title: title.trim(),
      periodLabel:
        periodStart && periodEnd
          ? encodePaymentPeriod(periodStart, periodEnd)
          : periodLabel,
      amount: amount ?? 0,
      currency,
      contractId: contractId || undefined,
      storeId: contract?.storeId,
      status,
    });
    setSaving(false);
    if (ok) router.push("/progress-payments");
    else setSaveError(t("finance.payments.saveFailed"));
  };

  const remove = async () => {
    if (!canDelete || !confirm(t("finance.payments.deleteConfirm"))) return;
    const ok = await deletePayment(id);
    if (ok) router.push("/progress-payments");
    else setSaveError(t("finance.payments.deleteFailed"));
  };

  return (
    <ModuleFormShell backHref="/progress-payments" backLabel={t("finance.payments.backLabel")} title={title || t("finance.payments.editTitle")} onSave={save} onDelete={remove} saving={saving} canSave={canEdit} canDelete={canDelete}>
      {saveError && <p role="alert" className="text-sm text-red-400">{saveError}</p>}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
        {t("finance.payments.summary", {
          total: formatMoney(payment.amount, payment.currency),
          paid: formatMoneyTotals(paid, payment.currency),
        })}
        {contract && (
          <Link href={`/contracts/${contract.id}/edit`} className="mt-1 block text-cyan-400 hover:underline">
            {t("finance.shared.contractLink", { name: contract.title })}
          </Link>
        )}
      </div>
      <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div>
          <label className="text-xs text-zinc-500">{t("finance.shared.contract")}</label>
          <Select className="mt-1" value={contractId} onChange={(e) => setContractId(e.target.value)} disabled={!canEdit}>
            <option value="">{t("finance.shared.select")}</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="text-xs text-zinc-500">{t("finance.shared.title")} *</label>
          <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} aria-invalid={showErrors && invalid.title} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-500">{t("finance.payments.periodStart")}</label>
            <DatePicker className="mt-1" value={periodStart} onChange={setPeriodStart} disabled={!canEdit} aria-invalid={showErrors && invalid.start} />
            {!periodStart && periodLabel && <p className="mt-1 text-xs text-zinc-500">{t("finance.payments.currentPeriod", { period: periodLabel })}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-500">{t("finance.payments.periodEnd")}</label>
            <DatePicker className="mt-1" value={periodEnd} onChange={setPeriodEnd} min={periodStart || undefined} disabled={!canEdit} aria-invalid={showErrors && invalid.end} />
          </div>
          <div>
            <label className="text-xs text-zinc-500">{t("finance.payments.totalAmount")}</label>
            <MoneyInput className="mt-1" value={amount} onValueChange={setAmount} currency={currency} onCurrencyChange={setCurrency} disabled={!canEdit} />
          </div>
          <div>
            <label className="text-xs text-zinc-500">{t("finance.shared.status")}</label>
            <Select className="mt-1" value={status} onChange={(e) => setStatus(e.target.value as ProgressPaymentStatus)} disabled={!canEdit}>
              {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <ModuleAttachments table="progress_payment_attachments" parentId={id} canEdit={canEdit} />
    </ModuleFormShell>
  );
}

export default function EditPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGuard routeKey="progressPayments">
      <EditPaymentContent id={id} />
    </AuthGuard>
  );
}

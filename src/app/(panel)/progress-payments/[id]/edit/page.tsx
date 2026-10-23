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
import { encodePaymentPeriod, paidAmountForPayment, parsePaymentPeriod } from "@/lib/module-finance";
import type { ProgressPaymentStatus } from "@/types";

const STATUS_TR: Record<ProgressPaymentStatus, string> = {
  draft: "Taslak",
  submitted: "Gönderildi",
  approved: "Onaylandı",
  paid: "Ödendi",
};

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

  if (!payment) {
    return <div className="flex h-full items-center justify-center text-sm text-zinc-500">{t("common.noData")}</div>;
  }

  const contract = contracts.find((c) => c.id === contractId);
  const paid = paidAmountForPayment(id, invoices);

  const save = async () => {
    if (!canEdit) return;
    if ((periodStart || periodEnd) && (!periodStart || !periodEnd)) {
      setSaveError("Dönem için başlangıç ve bitiş tarihlerini birlikte girin.");
      return;
    }
    if (periodStart && periodEnd && periodEnd < periodStart) {
      setSaveError("Bitiş tarihi başlangıç tarihinden önce olamaz.");
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
    else setSaveError("Hakediş kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.");
  };

  const remove = async () => {
    if (!canDelete || !confirm("Hakediş silinsin mi?")) return;
    const ok = await deletePayment(id);
    if (ok) router.push("/progress-payments");
    else setSaveError("Hakediş silinemedi. Tekrar deneyin.");
  };

  return (
    <ModuleFormShell backHref="/progress-payments" backLabel="Hakedişler" title={title || "Hakediş düzenle"} onSave={save} onDelete={remove} saving={saving} canSave={canEdit} canDelete={canDelete}>
      {saveError && <p role="alert" className="text-sm text-red-400">{saveError}</p>}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
        Toplam hakediş {formatMoney(payment.amount, payment.currency)} · Ödenen {formatMoneyTotals(paid, payment.currency)}
        {contract && (
          <Link href={`/contracts/${contract.id}/edit`} className="mt-1 block text-cyan-400 hover:underline">
            Sözleşme: {contract.title}
          </Link>
        )}
      </div>
      <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div>
          <label className="text-xs text-zinc-500">Sözleşme</label>
          <Select className="mt-1" value={contractId} onChange={(e) => setContractId(e.target.value)} disabled={!canEdit}>
            <option value="">Seçiniz</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="text-xs text-zinc-500">Başlık</label>
          <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-500">Dönem başlangıcı</label>
            <DatePicker className="mt-1" value={periodStart} onChange={setPeriodStart} disabled={!canEdit} />
            {!periodStart && periodLabel && <p className="mt-1 text-xs text-zinc-500">Mevcut dönem: {periodLabel}</p>}
          </div>
          <div>
            <label className="text-xs text-zinc-500">Dönem bitişi</label>
            <DatePicker className="mt-1" value={periodEnd} onChange={setPeriodEnd} min={periodStart || undefined} disabled={!canEdit} />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Toplam hakediş</label>
            <MoneyInput className="mt-1" value={amount} onValueChange={setAmount} currency={currency} onCurrencyChange={setCurrency} disabled={!canEdit} />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Durum</label>
            <Select className="mt-1" value={status} onChange={(e) => setStatus(e.target.value as ProgressPaymentStatus)} disabled={!canEdit}>
              {Object.entries(STATUS_TR).map(([k, v]) => (
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

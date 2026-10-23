"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ModuleFormShell } from "@/components/modules/module-form-shell";
import { useModules } from "@/contexts/modules-context";
import { useDb } from "@/contexts/db-context";
import { useT } from "@/contexts/i18n-context";
import { usePageTitle } from "@/contexts/page-title-context";
import { usePermissions } from "@/hooks/use-permissions";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/money-input";
import { DEFAULT_CURRENCY, formatMoney, type CurrencyCode } from "@/lib/currency";
import { calculateVat, inferVatRate, VAT_RATE_OPTIONS } from "@/lib/module-finance";
import type { InvoiceStatus } from "@/types";

const STATUS_TR: Record<InvoiceStatus, string> = {
  draft: "Taslak",
  issued: "Kesildi",
  paid: "Ödendi",
  cancelled: "İptal",
};

function EditInvoiceContent({ id }: { id: string }) {
  const router = useRouter();
  const { invoices, updateInvoice, deleteInvoice } = useModules();
  const { progressPayments, contracts } = useDb();
  const { canEdit, canDelete } = usePermissions("invoices");
  const t = useT();
  const invoice = invoices.find((i) => i.id === id);
  usePageTitle(invoice?.invoiceNumber);

  const [invoiceNumber, setInvoiceNumber] = useState(invoice?.invoiceNumber ?? "");
  const [amount, setAmount] = useState<number | null>(invoice?.amount ?? null);
  const [currency, setCurrency] = useState<CurrencyCode>(invoice?.currency ?? DEFAULT_CURRENCY);
  const [vatRate, setVatRate] = useState(inferVatRate(invoice?.amount ?? 0, invoice?.taxAmount ?? 0));
  const [progressPaymentId, setProgressPaymentId] = useState(invoice?.progressPaymentId ?? "");
  const [status, setStatus] = useState<InvoiceStatus>(invoice?.status ?? "draft");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  if (!invoice) {
    return <div className="flex h-full items-center justify-center text-sm text-zinc-500">{t("common.noData")}</div>;
  }

  const payment = progressPayments.find((p) => p.id === progressPaymentId);
  const amountValue = amount ?? 0;
  const taxAmount = calculateVat(amountValue, vatRate);
  const contractCurrency = contracts.find((c) => c.id === payment?.contractId)?.currency;
  const currencyMismatch = !!contractCurrency && contractCurrency !== currency;
  const isCustomVatRate = !VAT_RATE_OPTIONS.some((rate) => rate === vatRate);

  const save = async () => {
    if (!canEdit) return;
    if (!invoiceNumber.trim() || !progressPaymentId || amountValue <= 0) {
      setSaveError("Fatura numarası, hakediş ve sıfırdan büyük tutar zorunludur.");
      return;
    }
    setSaveError("");
    setSaving(true);
    const ok = await updateInvoice(id, {
      invoiceNumber: invoiceNumber.trim(),
      amount: amountValue,
      taxAmount,
      currency,
      progressPaymentId: progressPaymentId || undefined,
      storeId: payment?.storeId,
      status,
    });
    setSaving(false);
    if (ok) router.push("/invoices");
    else setSaveError("Fatura kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.");
  };

  const remove = async () => {
    if (!canDelete || !confirm("Fatura silinsin mi?")) return;
    const ok = await deleteInvoice(id);
    if (ok) router.push("/invoices");
    else setSaveError("Fatura silinemedi. Tekrar deneyin.");
  };

  return (
    <ModuleFormShell backHref="/invoices" backLabel="Faturalar" title={invoiceNumber || "Fatura düzenle"} onSave={save} onDelete={remove} saving={saving} canSave={canEdit} canDelete={canDelete}>
      {saveError && <p role="alert" className="text-sm text-red-400">{saveError}</p>}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
        Toplam {formatMoney(invoice.amount + invoice.taxAmount, invoice.currency)}
        {payment && (
          <Link href={`/progress-payments/${payment.id}/edit`} className="mt-1 block text-cyan-400 hover:underline">
            Hakediş: {payment.title}
          </Link>
        )}
      </div>
      <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div>
          <label className="text-xs text-zinc-500">Hakediş</label>
          <Select className="mt-1" value={progressPaymentId} onChange={(e) => setProgressPaymentId(e.target.value)} disabled={!canEdit}>
            <option value="">Seçiniz</option>
            {progressPayments.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="text-xs text-zinc-500">Fatura no</label>
          <Input className="mt-1" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} disabled={!canEdit} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-500">Tutar (KDV hariç)</label>
            <MoneyInput className="mt-1" value={amount} onValueChange={setAmount} currency={currency} onCurrencyChange={setCurrency} disabled={!canEdit} />
          </div>
          <div>
            <label className="text-xs text-zinc-500">KDV oranı</label>
            <Select className="mt-1" value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))} disabled={!canEdit}>
              {isCustomVatRate && <option value={vatRate}>Özel (%{vatRate})</option>}
              {VAT_RATE_OPTIONS.map((rate) => <option key={rate} value={rate}>%{rate}</option>)}
            </Select>
          </div>
          {currencyMismatch && (
            <p className="sm:col-span-2 text-xs text-amber-400/90">
              Sözleşme {contractCurrency} cinsinden. Kur çevrimi yapılmadığı için {currency} fatura, sözleşme ilerlemesine sayılmaz.
            </p>
          )}
          <div className="sm:col-span-2 flex flex-wrap gap-x-6 gap-y-2 border-t border-zinc-800 pt-3 text-sm">
            <p className="text-zinc-500">KDV: <span className="font-medium text-zinc-200">{formatMoney(taxAmount, currency)}</span></p>
            <p className="text-zinc-500">Toplam: <span className="font-semibold text-zinc-100">{formatMoney(amountValue + taxAmount, currency)}</span></p>
          </div>
          <div>
            <label className="text-xs text-zinc-500">Durum</label>
            <Select className="mt-1" value={status} onChange={(e) => setStatus(e.target.value as InvoiceStatus)} disabled={!canEdit}>
              {Object.entries(STATUS_TR).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>
        </div>
      </div>
    </ModuleFormShell>
  );
}

export default function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGuard routeKey="invoices">
      <EditInvoiceContent id={id} />
    </AuthGuard>
  );
}

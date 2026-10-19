"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ModuleFormShell } from "@/components/modules/module-form-shell";
import { useModules } from "@/contexts/modules-context";
import { useDb } from "@/contexts/db-context";
import { usePermissions } from "@/hooks/use-permissions";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatTry } from "@/lib/currency";
import { calculateVat, VAT_RATE_OPTIONS } from "@/lib/module-finance";
import { useSettings } from "@/contexts/settings-context";
import type { InvoiceStatus } from "@/types";

const STATUS_TR: Record<InvoiceStatus, string> = {
  draft: "Taslak",
  issued: "Kesildi",
  paid: "Ödendi",
  cancelled: "İptal",
};

function NewInvoiceContent() {
  const router = useRouter();
  const { createInvoice } = useModules();
  const { progressPayments } = useDb();
  const { canAdd } = usePermissions("invoices");

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amount, setAmount] = useState("");
  const { org } = useSettings();
  const [vatRate, setVatRate] = useState(org.defaults.vatRate);
  const [progressPaymentId, setProgressPaymentId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [status, setStatus] = useState<InvoiceStatus>("draft");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const amountValue = Number(amount) || 0;
  const taxAmount = calculateVat(amountValue, vatRate);

  if (!canAdd) {
    return <div className="flex h-full items-center justify-center text-sm text-zinc-500">Ekleme yetkiniz yok</div>;
  }

  const onPaymentChange = (id: string) => {
    const p = progressPayments.find((x) => x.id === id);
    setProgressPaymentId(id);
    setStoreId(p?.storeId ?? "");
  };

  const save = async () => {
    if (!invoiceNumber.trim() || !progressPaymentId || amountValue <= 0) {
      setSaveError("Fatura numarası, hakediş ve sıfırdan büyük tutar zorunludur.");
      return;
    }
    setSaveError("");
    setSaving(true);
    const id = await createInvoice({
      invoiceNumber: invoiceNumber.trim(),
      amount: amountValue,
      taxAmount,
      progressPaymentId,
      storeId: storeId || undefined,
      status,
    });
    setSaving(false);
    if (id) router.push("/invoices");
    else setSaveError("Fatura oluşturulamadı. Bağlantınızı kontrol edip tekrar deneyin.");
  };

  return (
    <ModuleFormShell backHref="/invoices" backLabel="Faturalar" title="Yeni fatura" onSave={save} saving={saving} saveLabel="Oluştur" canSave={!!invoiceNumber.trim() && !!progressPaymentId && amountValue > 0}>
      {saveError && <p role="alert" className="text-sm text-red-400">{saveError}</p>}
      <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div>
          <label className="text-xs text-zinc-500">Hakediş *</label>
          <Select className="mt-1" value={progressPaymentId} onChange={(e) => onPaymentChange(e.target.value)}>
            <option value="">Seçiniz</option>
            {progressPayments.map((p) => (
              <option key={p.id} value={p.id}>{p.title}{p.periodLabel ? ` (${p.periodLabel})` : ""}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="text-xs text-zinc-500">Fatura no *</label>
          <Input className="mt-1" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-500">Tutar (TRY, KDV hariç)</label>
            <Input className="mt-1" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-zinc-500">KDV oranı</label>
            <Select className="mt-1" value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))}>
              {VAT_RATE_OPTIONS.map((rate) => <option key={rate} value={rate}>%{rate}</option>)}
            </Select>
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-x-6 gap-y-2 border-t border-zinc-800 pt-3 text-sm">
            <p className="text-zinc-500">KDV: <span className="font-medium text-zinc-200">{formatTry(taxAmount)}</span></p>
            <p className="text-zinc-500">Toplam: <span className="font-semibold text-zinc-100">{formatTry(amountValue + taxAmount)}</span></p>
          </div>
          <div>
            <label className="text-xs text-zinc-500">Durum</label>
            <Select className="mt-1" value={status} onChange={(e) => setStatus(e.target.value as InvoiceStatus)}>
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

export default function NewInvoicePage() {
  return (
    <AuthGuard routeKey="invoices">
      <NewInvoiceContent />
    </AuthGuard>
  );
}

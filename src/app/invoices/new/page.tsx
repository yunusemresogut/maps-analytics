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
  const [taxAmount, setTaxAmount] = useState("");
  const [progressPaymentId, setProgressPaymentId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [status, setStatus] = useState<InvoiceStatus>("draft");
  const [saving, setSaving] = useState(false);

  if (!canAdd) {
    return <div className="flex h-full items-center justify-center text-sm text-zinc-500">Ekleme yetkiniz yok</div>;
  }

  const onPaymentChange = (id: string) => {
    const p = progressPayments.find((x) => x.id === id);
    setProgressPaymentId(id);
    setStoreId(p?.storeId ?? "");
  };

  const save = async () => {
    if (!invoiceNumber.trim() || !progressPaymentId) return;
    setSaving(true);
    const id = await createInvoice({
      invoiceNumber: invoiceNumber.trim(),
      amount: Number(amount) || 0,
      taxAmount: Number(taxAmount) || 0,
      progressPaymentId,
      storeId: storeId || undefined,
      status,
    });
    setSaving(false);
    if (id) router.push(`/invoices/${id}/edit`);
  };

  return (
    <ModuleFormShell backHref="/invoices" backLabel="Faturalar" title="Yeni fatura" onSave={save} saving={saving} saveLabel="Oluştur" canSave>
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
            <label className="text-xs text-zinc-500">Tutar (TRY)</label>
            <Input className="mt-1" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-zinc-500">KDV (TRY)</label>
            <Input className="mt-1" type="number" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} />
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

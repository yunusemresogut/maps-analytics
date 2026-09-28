"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ModuleFormShell } from "@/components/modules/module-form-shell";
import { useModules } from "@/contexts/modules-context";
import { useDb } from "@/contexts/db-context";
import { useT } from "@/contexts/i18n-context";
import { usePermissions } from "@/hooks/use-permissions";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatTry } from "@/lib/currency";
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
  const { progressPayments } = useDb();
  const { canEdit, canDelete } = usePermissions("invoices");
  const t = useT();
  const invoice = invoices.find((i) => i.id === id);

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [progressPaymentId, setProgressPaymentId] = useState("");
  const [status, setStatus] = useState<InvoiceStatus>("draft");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!invoice) return;
    setInvoiceNumber(invoice.invoiceNumber);
    setAmount(String(invoice.amount));
    setTaxAmount(String(invoice.taxAmount));
    setProgressPaymentId(invoice.progressPaymentId ?? "");
    setStatus(invoice.status);
  }, [invoice]);

  if (!invoice) {
    return <div className="flex h-full items-center justify-center text-sm text-zinc-500">{t("common.noData")}</div>;
  }

  const payment = progressPayments.find((p) => p.id === invoice.progressPaymentId);

  const save = async () => {
    if (!canEdit) return;
    setSaving(true);
    await updateInvoice(id, {
      invoiceNumber: invoiceNumber.trim(),
      amount: Number(amount) || 0,
      taxAmount: Number(taxAmount) || 0,
      progressPaymentId: progressPaymentId || undefined,
      storeId: payment?.storeId,
      status,
    });
    setSaving(false);
    router.push("/invoices");
  };

  const remove = async () => {
    if (!canDelete || !confirm("Fatura silinsin mi?")) return;
    await deleteInvoice(id);
    router.push("/invoices");
  };

  return (
    <ModuleFormShell backHref="/invoices" backLabel="Faturalar" title={invoiceNumber || "Fatura düzenle"} onSave={save} onDelete={remove} saving={saving} canSave={canEdit} canDelete={canDelete}>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
        Toplam {formatTry(invoice.amount + invoice.taxAmount)}
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
            <label className="text-xs text-zinc-500">Tutar (TRY)</label>
            <Input className="mt-1" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <label className="text-xs text-zinc-500">KDV (TRY)</label>
            <Input className="mt-1" type="number" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} disabled={!canEdit} />
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

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
import { paidAmountForPayment } from "@/lib/module-finance";
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

  const [title, setTitle] = useState("");
  const [periodLabel, setPeriodLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [contractId, setContractId] = useState("");
  const [status, setStatus] = useState<ProgressPaymentStatus>("draft");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!payment) return;
    setTitle(payment.title);
    setPeriodLabel(payment.periodLabel);
    setAmount(String(payment.amount));
    setContractId(payment.contractId ?? "");
    setStatus(payment.status);
  }, [payment]);

  if (!payment) {
    return <div className="flex h-full items-center justify-center text-sm text-zinc-500">{t("common.noData")}</div>;
  }

  const contract = contracts.find((c) => c.id === payment.contractId);
  const paid = paidAmountForPayment(id, invoices);

  const save = async () => {
    if (!canEdit) return;
    setSaving(true);
    await updatePayment(id, {
      title: title.trim(),
      periodLabel,
      amount: Number(amount) || 0,
      contractId: contractId || undefined,
      storeId: contract?.storeId,
      status,
    });
    setSaving(false);
    router.push("/progress-payments");
  };

  const remove = async () => {
    if (!canDelete || !confirm("Hakediş silinsin mi?")) return;
    await deletePayment(id);
    router.push("/progress-payments");
  };

  return (
    <ModuleFormShell backHref="/progress-payments" backLabel="Hakedişler" title={title || "Hakediş düzenle"} onSave={save} onDelete={remove} saving={saving} canSave={canEdit} canDelete={canDelete}>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
        Toplam hakediş {formatTry(payment.amount)} · Ödenen {formatTry(paid)}
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
            <label className="text-xs text-zinc-500">Dönem</label>
            <Input className="mt-1" value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Toplam hakediş (TRY)</label>
            <Input className="mt-1" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={!canEdit} />
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

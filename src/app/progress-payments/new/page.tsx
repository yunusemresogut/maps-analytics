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
import type { ProgressPaymentStatus } from "@/types";

const STATUS_TR: Record<ProgressPaymentStatus, string> = {
  draft: "Taslak",
  submitted: "Gönderildi",
  approved: "Onaylandı",
  paid: "Ödendi",
};

function NewPaymentContent() {
  const router = useRouter();
  const { createPayment } = useModules();
  const { contracts } = useDb();
  const { canAdd } = usePermissions("progressPayments");

  const [title, setTitle] = useState("");
  const [periodLabel, setPeriodLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [contractId, setContractId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [status, setStatus] = useState<ProgressPaymentStatus>("draft");
  const [saving, setSaving] = useState(false);

  if (!canAdd) {
    return <div className="flex h-full items-center justify-center text-sm text-zinc-500">Ekleme yetkiniz yok</div>;
  }

  const onContractChange = (id: string) => {
    const c = contracts.find((x) => x.id === id);
    setContractId(id);
    setStoreId(c?.storeId ?? "");
  };

  const save = async () => {
    if (!title.trim() || !contractId) return;
    setSaving(true);
    const id = await createPayment({
      title: title.trim(),
      periodLabel: periodLabel.trim(),
      amount: Number(amount) || 0,
      contractId,
      storeId: storeId || undefined,
      status,
    });
    setSaving(false);
    if (id) router.push(`/progress-payments/${id}/edit`);
  };

  return (
    <ModuleFormShell backHref="/progress-payments" backLabel="Hakedişler" title="Yeni hakediş" onSave={save} saving={saving} saveLabel="Oluştur" canSave>
      <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div>
          <label className="text-xs text-zinc-500">Sözleşme *</label>
          <Select className="mt-1" value={contractId} onChange={(e) => onContractChange(e.target.value)}>
            <option value="">Seçiniz</option>
            {contracts.filter((c) => c.status === "active" || c.status === "draft").map((c) => (
              <option key={c.id} value={c.id}>{c.code ? `${c.code} — ` : ""}{c.title}</option>
            ))}
          </Select>
        </div>
        <div>
          <label className="text-xs text-zinc-500">Başlık *</label>
          <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-500">Dönem</label>
            <Input className="mt-1" value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} placeholder="2026-Q1" />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Toplam hakediş (TRY)</label>
            <Input className="mt-1" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Durum</label>
            <Select className="mt-1" value={status} onChange={(e) => setStatus(e.target.value as ProgressPaymentStatus)}>
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

export default function NewPaymentPage() {
  return (
    <AuthGuard routeKey="progressPayments">
      <NewPaymentContent />
    </AuthGuard>
  );
}

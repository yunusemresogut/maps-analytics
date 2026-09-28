"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ModuleAttachments } from "@/components/modules/module-attachments";
import { ModuleFormShell } from "@/components/modules/module-form-shell";
import { useModules } from "@/contexts/modules-context";
import { useDb } from "@/contexts/db-context";
import { useStores } from "@/contexts/stores-context";
import { useT } from "@/contexts/i18n-context";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatTry } from "@/lib/currency";
import { contractProgressPercent, paidAmountForContract } from "@/lib/module-finance";
import { cn } from "@/lib/utils";
import type { ContractStatus } from "@/types";

const STATUS_TR: Record<ContractStatus, string> = {
  draft: "Taslak",
  active: "Aktif",
  expired: "Süresi doldu",
  cancelled: "İptal",
  terminated: "Fesih",
  completed: "Tamamlandı",
};

function EditContractContent({ id }: { id: string }) {
  const router = useRouter();
  const { contracts, updateContract, deleteContract } = useModules();
  const { progressPayments, invoices } = useDb();
  const { stores } = useStores();
  const { canEdit, canDelete } = usePermissions("contracts");
  const t = useT();
  const contract = contracts.find((x) => x.id === id);

  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [partyName, setPartyName] = useState("");
  const [amount, setAmount] = useState("");
  const [storeId, setStoreId] = useState("");
  const [status, setStatus] = useState<ContractStatus>("draft");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!contract) return;
    setCode(contract.code ?? "");
    setTitle(contract.title);
    setPartyName(contract.partyName);
    setAmount(String(contract.amount));
    setStoreId(contract.storeId ?? "");
    setStatus(contract.status);
  }, [contract]);

  if (!contract) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        {t("common.noData")}
      </div>
    );
  }

  const paid = paidAmountForContract(id, progressPayments, invoices);
  const progress = contractProgressPercent(contract, progressPayments, invoices);
  const store = stores.find((s) => s.id === contract.storeId);

  const save = async () => {
    if (!canEdit) return;
    setSaving(true);
    await updateContract(id, {
      code: code.trim() || undefined,
      title: title.trim(),
      partyName,
      amount: Number(amount) || 0,
      storeId: storeId || undefined,
      status,
    });
    setSaving(false);
    router.push("/contracts");
  };

  const terminate = async () => {
    if (!canEdit || !confirm("Sözleşme feshedilsin mi?")) return;
    await updateContract(id, { status: "terminated" });
    setStatus("terminated");
  };

  const remove = async () => {
    if (!canDelete || !confirm("Sözleşme silinsin mi?")) return;
    await deleteContract(id);
    router.push("/contracts");
  };

  return (
    <ModuleFormShell
      backHref="/contracts"
      backLabel="Sözleşmeler"
      title={title || "Sözleşme düzenle"}
      subtitle={
        status === "terminated"
          ? "Feshedilmiş sözleşme"
          : status === "completed"
            ? "Tamamlanmış sözleşme"
            : store?.name
      }
      onSave={save}
      onDelete={remove}
      saving={saving}
      canSave={canEdit}
      canDelete={canDelete}
    >
      <div className={cn("rounded-xl border border-zinc-800 bg-zinc-900/40 p-4", status === "terminated" && "border-red-500/30")}>
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-zinc-400">Ödeme ilerlemesi</span>
          <span className="font-medium">%{progress}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
          <div className="h-full rounded-full bg-cyan-500" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Toplam {formatTry(contract.amount)} · Ödenen {formatTry(paid)}
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        {store && (
          <Link href={`/stores/${store.id}`} className="text-sm text-cyan-400 hover:underline">
            Mağaza: {store.name}
          </Link>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-500">Kod</label>
            <Input className="mt-1 font-mono" value={code} onChange={(e) => setCode(e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Durum</label>
            <Select className="mt-1" value={status} onChange={(e) => setStatus(e.target.value as ContractStatus)} disabled={!canEdit}>
              {Object.entries(STATUS_TR).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <label className="text-xs text-zinc-500">Başlık</label>
          <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-500">Taraf</label>
            <Input className="mt-1" value={partyName} onChange={(e) => setPartyName(e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Tutar (TRY)</label>
            <Input className="mt-1" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-zinc-500">Mağaza</label>
            <Select className="mt-1" value={storeId} onChange={(e) => setStoreId(e.target.value)} disabled={!canEdit}>
              <option value="">Seçiniz</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>
        </div>
        {canEdit && status !== "terminated" && (
          <Button type="button" variant="danger" size="sm" onClick={terminate}>
            Feshet
          </Button>
        )}
      </div>

      <ModuleAttachments table="contract_attachments" parentId={id} parentField="contract_id" canEdit={canEdit} />
    </ModuleFormShell>
  );
}

export default function EditContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGuard routeKey="contracts">
      <EditContractContent id={id} />
    </AuthGuard>
  );
}

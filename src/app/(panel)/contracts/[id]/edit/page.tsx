"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ModuleAttachments } from "@/components/modules/module-attachments";
import { ModuleFormShell } from "@/components/modules/module-form-shell";
import { useModules } from "@/contexts/modules-context";
import { useStores } from "@/contexts/stores-context";
import { useT } from "@/contexts/i18n-context";
import { usePageTitle } from "@/contexts/page-title-context";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/money-input";
import { DEFAULT_CURRENCY, type CurrencyCode } from "@/lib/currency";
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
  const { stores } = useStores();
  const { canEdit, canDelete } = usePermissions("contracts");
  const t = useT();
  const contract = contracts.find((x) => x.id === id);
  usePageTitle(contract?.title);

  const [code, setCode] = useState(contract?.code ?? "");
  const [title, setTitle] = useState(contract?.title ?? "");
  const [partyName, setPartyName] = useState(contract?.partyName ?? "");
  const [amount, setAmount] = useState<number | null>(contract?.amount ?? null);
  const [currency, setCurrency] = useState<CurrencyCode>(contract?.currency ?? DEFAULT_CURRENCY);
  const [storeId, setStoreId] = useState(contract?.storeId ?? "");
  const [status, setStatus] = useState<ContractStatus>(contract?.status ?? "draft");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  if (!contract) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        {t("common.noData")}
      </div>
    );
  }

  const store = stores.find((s) => s.id === contract.storeId);

  const save = async () => {
    if (!canEdit) return;
    setSaveError("");
    setSaving(true);
    const ok = await updateContract(id, {
      code: code.trim() || undefined,
      title: title.trim(),
      partyName,
      amount: amount ?? 0,
      currency,
      storeId: storeId || undefined,
      status,
    });
    setSaving(false);
    if (ok) router.push("/contracts");
    else setSaveError("Sözleşme kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.");
  };

  const terminate = async () => {
    if (!canEdit || !confirm("Sözleşme feshedilsin mi?")) return;
    const ok = await updateContract(id, { status: "terminated" });
    if (ok) setStatus("terminated");
    else setSaveError("Fesih işlemi tamamlanamadı. Tekrar deneyin.");
  };

  const remove = async () => {
    if (!canDelete || !confirm("Sözleşme silinsin mi?")) return;
    const ok = await deleteContract(id);
    if (ok) router.push("/contracts");
    else setSaveError("Sözleşme silinemedi. Tekrar deneyin.");
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
      <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        {saveError && <p role="alert" className="text-sm text-red-400">{saveError}</p>}
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
            <label className="text-xs text-zinc-500">Tutar</label>
            <MoneyInput className="mt-1" value={amount} onValueChange={setAmount} currency={currency} onCurrencyChange={setCurrency} disabled={!canEdit} />
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

      <ModuleAttachments table="contract_attachments" parentId={id} canEdit={canEdit} />
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

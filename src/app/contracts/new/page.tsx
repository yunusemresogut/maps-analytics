"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ModuleFormShell } from "@/components/modules/module-form-shell";
import { useModules } from "@/contexts/modules-context";
import { useStores } from "@/contexts/stores-context";
import { usePermissions } from "@/hooks/use-permissions";
import { nextContractCode } from "@/lib/module-codes";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ContractStatus } from "@/types";

function NewContractContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { contracts, createContract } = useModules();
  const { stores } = useStores();
  const { canAdd } = usePermissions("contracts");

  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [partyName, setPartyName] = useState("");
  const [amount, setAmount] = useState("");
  const [storeId, setStoreId] = useState(searchParams.get("storeId") ?? "");
  const [status, setStatus] = useState<ContractStatus>("active");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const selectedStore = stores.find((s) => s.id === storeId);
  const contractCode = codeTouched ? code : nextContractCode(contracts);
  const contractTitle =
    titleTouched || !selectedStore ? title : `${selectedStore.name} Sözleşmesi`;

  if (!canAdd) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Ekleme yetkiniz yok
      </div>
    );
  }

  const save = async () => {
    if (!contractTitle.trim()) {
      setSaveError("Başlık zorunludur.");
      return;
    }
    setSaveError("");
    setSaving(true);
    const id = await createContract({
      title: contractTitle.trim(),
      code: contractCode.trim() || undefined,
      partyName: partyName.trim(),
      amount: Number(amount) || 0,
      storeId: storeId || undefined,
      status,
    });
    setSaving(false);
    if (id) {
      router.push("/contracts");
      return;
    }
    setSaveError(
      "Sözleşme oluşturulamadı. Organizasyon bağlantısı veya yetkinizi kontrol edin."
    );
  };

  return (
    <ModuleFormShell
      backHref="/contracts"
      backLabel="Sözleşmeler"
      title="Yeni sözleşme"
      onSave={save}
      saving={saving}
      saveLabel="Oluştur"
      canSave={!!contractTitle.trim()}
    >
      {saveError && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {saveError}
        </p>
      )}
      <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-500">Başlık *</label>
            <Input
              className="mt-1"
              value={contractTitle}
              onChange={(e) => {
                setTitleTouched(true);
                setTitle(e.target.value);
              }}
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Kod</label>
            <Input
              className="mt-1 font-mono"
              value={contractCode}
              onChange={(e) => {
                setCodeTouched(true);
                setCode(e.target.value);
              }}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-500">Taraf</label>
            <Input className="mt-1" value={partyName} onChange={(e) => setPartyName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Tutar (TRY)</label>
            <Input className="mt-1" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Mağaza</label>
            <Select className="mt-1" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              <option value="">Seçiniz</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs text-zinc-500">Durum</label>
            <Select className="mt-1" value={status} onChange={(e) => setStatus(e.target.value as ContractStatus)}>
              <option value="draft">Taslak</option>
              <option value="active">Aktif</option>
            </Select>
          </div>
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        Kaydettikten sonra sözleşme eklerini (dosya) düzenleme ekranından yükleyebilirsiniz.
      </p>
    </ModuleFormShell>
  );
}

export default function NewContractPage() {
  return (
    <AuthGuard routeKey="contracts">
      <NewContractContent />
    </AuthGuard>
  );
}

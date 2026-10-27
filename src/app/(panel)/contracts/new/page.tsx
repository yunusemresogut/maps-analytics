"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/auth/auth-guard";
import { ModuleFormShell } from "@/components/modules/module-form-shell";
import { PendingAttachments } from "@/components/modules/pending-attachments";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/contexts/i18n-context";
import { uploadModuleAttachments } from "@/lib/upload-module-attachment";
import { useModules } from "@/contexts/modules-context";
import { useStores } from "@/contexts/stores-context";
import { usePermissions } from "@/hooks/use-permissions";
import { nextContractCode } from "@/lib/module-codes";
import { CONTRACT_STATUS_LABELS } from "@/lib/module-finance";
import { useSettings } from "@/contexts/settings-context";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/money-input";
import type { CurrencyCode } from "@/lib/currency";
import type { ContractStatus } from "@/types";

function NewContractContent() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { contracts, createContract } = useModules();
  const { stores } = useStores();
  const { canAdd } = usePermissions("contracts");
  const { org } = useSettings();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [partyName, setPartyName] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [currency, setCurrency] = useState<CurrencyCode>(org.defaults.currency);
  const [storeId, setStoreId] = useState(searchParams.get("storeId") ?? "");
  const [status, setStatus] = useState<ContractStatus>("active");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const selectedStore = stores.find((s) => s.id === storeId);
  const contractCode = codeTouched ? code : nextContractCode(contracts, org.defaults.contractCodePrefix);
  const contractTitle =
    titleTouched || !selectedStore ? title : t("finance.contracts.defaultTitle", { store: selectedStore.name });

  if (!canAdd) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        {t("finance.shared.noAddPermission")}
      </div>
    );
  }

  const save = async () => {
    if (createdId) return;
    setShowErrors(true);
    if (!contractTitle.trim()) {
      setSaveError(t("finance.shared.titleRequired"));
      return;
    }
    setSaveError("");
    setSaving(true);
    const id = await createContract({
      title: contractTitle.trim(),
      code: contractCode.trim() || undefined,
      partyName: partyName.trim(),
      amount: amount ?? 0,
      currency,
      storeId: storeId || undefined,
      status,
    });
    if (id) {
      setCreatedId(id);
      if (attachments.length > 0 && user) {
        const errors = await uploadModuleAttachments({
          table: "contract_attachments",
          parentId: id,
          files: attachments,
          user,
        });
        if (errors.length > 0) {
          setSaving(false);
          setSaveError(t("finance.contracts.attachmentsFailed", { errors: errors.join(" ") }));
          return;
        }
      }
      router.push("/contracts");
      return;
    }
    setSaving(false);
    setSaveError(t("finance.contracts.createFailed"));
  };

  return (
    <ModuleFormShell
      backHref="/contracts"
      backLabel={t("finance.contracts.title")}
      title={t("finance.contracts.newTitle")}
      onSave={save}
      saving={saving}
      saveLabel={t("finance.shared.create")}
      canSave={!createdId}
    >
      {saveError && (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {saveError}
          {createdId && (
            <Link href={`/contracts/${createdId}/edit`} className="ml-2 underline underline-offset-2">
              {t("finance.contracts.open")}
            </Link>
          )}
        </p>
      )}
      <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-zinc-500">{t("finance.shared.title")} *</label>
            <Input
              className="mt-1"
              value={contractTitle}
              aria-invalid={showErrors && !contractTitle.trim()}
              onChange={(e) => {
                setTitleTouched(true);
                setTitle(e.target.value);
              }}
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500">{t("finance.shared.code")}</label>
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
            <label className="text-xs text-zinc-500">{t("finance.shared.party")}</label>
            <Input className="mt-1" value={partyName} onChange={(e) => setPartyName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-zinc-500">{t("finance.shared.amount")}</label>
            <MoneyInput className="mt-1" value={amount} onValueChange={setAmount} currency={currency} onCurrencyChange={setCurrency} />
          </div>
          <div>
            <label className="text-xs text-zinc-500">{t("finance.shared.store")}</label>
            <Select className="mt-1" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
              <option value="">{t("finance.shared.select")}</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs text-zinc-500">{t("finance.shared.status")}</label>
            <Select className="mt-1" value={status} onChange={(e) => setStatus(e.target.value as ContractStatus)}>
              <option value="draft">{CONTRACT_STATUS_LABELS.draft}</option>
              <option value="active">{CONTRACT_STATUS_LABELS.active}</option>
            </Select>
          </div>
        </div>
        <PendingAttachments files={attachments} onChange={setAttachments} />
      </div>
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

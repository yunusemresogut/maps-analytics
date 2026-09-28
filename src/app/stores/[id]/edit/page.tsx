"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useAuth } from "@/contexts/auth-context";
import { useStores } from "@/contexts/stores-context";
import { useDb } from "@/contexts/db-context";
import { useT } from "@/contexts/i18n-context";
import { usePermissions } from "@/hooks/use-permissions";
import {
  StoreFormFields,
  formToStoreData,
  storeToForm,
  type StoreFormData,
} from "@/components/map/store-form-fields";
import { ApprovalSwitches } from "@/components/projects/approval-switches";
import { StoreDetailSections } from "@/components/stores/store-detail-sections";
import { StoreContractsList } from "@/components/contracts/store-contracts-list";
import { ContractIhaleWarning } from "@/components/contracts/contract-ihale-warning";
import {
  StoreOpeningAlert,
  storeOpeningBadgeLabel,
  storeOpeningIsOverdue,
} from "@/components/map/store-opening-alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormError } from "@/components/ui/field-error";
import { getProjectStatusLabel, projectStatusConfig } from "@/lib/project-status";
import { hasErrors, validateStoreForm, type FieldErrors } from "@/lib/validation";
import { cn } from "@/lib/utils";

function StoreEditContent({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { getStore, updateStore } = useStores();
  const { contracts } = useDb();
  const { canEdit } = usePermissions("stores");
  const t = useT();

  const store = getStore(id);
  const [form, setForm] = useState<StoreFormData | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (store) setForm(storeToForm(store));
  }, [store?.id]);

  if (!store) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        {t("common.noData")}
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-zinc-500">
        <p>Düzenleme yetkiniz yok.</p>
        <Link href={`/stores/${id}`} className="text-cyan-400 hover:underline">
          Detaya dön
        </Link>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Yükleniyor…
      </div>
    );
  }

  const config = projectStatusConfig[store.projectStatus];
  const openingBadge = storeOpeningBadgeLabel(store);

  const handleSave = async () => {
    if (!user) return;
    const nextErrors = validateStoreForm(form);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    setSaveError("");
    setSaving(true);
    const ok = await updateStore(
      store.id,
      formToStoreData(form, {
        latitude: store.latitude,
        longitude: store.longitude,
      }),
      { userId: user.id, userName: user.name }
    );
    setSaving(false);

    if (!ok) {
      setSaveError("Kayıt başarısız. Yetkinizi veya bağlantınızı kontrol edin.");
      return;
    }

    setSaved(true);
    setTimeout(() => {
      router.push(`/stores/${store.id}`);
    }, 600);
  };

  return (
    <div className="scrollbar-themed h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/stores/${store.id}`}
              className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Detay
            </Link>
            <span className="text-zinc-700">·</span>
            <Link
              href="/stores"
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              {t("nav.stores")}
            </Link>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/stores/${store.id}`)}
            >
              İptal
            </Button>
            <Button size="sm" loading={saving} onClick={handleSave}>
              <Save className="h-3.5 w-3.5" />
              {saved ? "Kaydedildi!" : "Kaydet"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold text-zinc-100">{store.name}</h1>
          <Badge className="border border-zinc-600/40 bg-zinc-800/60 text-zinc-400">
            Düzenleme
          </Badge>
          <Badge
            className={`${config.color} border border-current/20 bg-current/10`}
          >
            {getProjectStatusLabel(store.projectStatus, t)}
          </Badge>
          {openingBadge && (
            <Badge
              className={cn(
                "border border-current/20 bg-current/10",
                storeOpeningIsOverdue(store)
                  ? "text-amber-400"
                  : "text-red-400"
              )}
            >
              {openingBadge}
            </Badge>
          )}
        </div>

        {(saveError || hasErrors(errors)) && (
          <div className="space-y-1">
            {saveError && <FormError message={saveError} />}
            {hasErrors(errors) && (
              <FormError message="Lütfen zorunlu alanları kontrol edin." />
            )}
          </div>
        )}

        <div className="space-y-3">
          <StoreOpeningAlert store={store} />
          <ContractIhaleWarning store={store} contracts={contracts} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr] lg:items-start">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-500">
              Mağaza bilgileri
            </h2>
            <StoreFormFields
              form={form}
              onChange={setForm}
              errors={errors}
              onErrorsChange={setErrors}
            />
          </div>

          <div className="lg:sticky lg:top-6">
            <ApprovalSwitches store={store} />
          </div>
        </div>

        <StoreContractsList store={store} />

        <StoreDetailSections store={store} />
      </div>
    </div>
  );
}

export default function StoreEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <AuthGuard routeKey="stores">
      <StoreEditContent id={id} />
    </AuthGuard>
  );
}

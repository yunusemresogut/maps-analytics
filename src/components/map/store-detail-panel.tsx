"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Pencil, Save, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/contexts/i18n-context";
import { useDb } from "@/contexts/db-context";
import { useStores } from "@/contexts/stores-context";
import { usePermissions } from "@/hooks/use-permissions";
import { ContractIhaleWarning } from "@/components/contracts/contract-ihale-warning";
import { StoreOpeningAlert, storeOpeningBadgeLabel, storeOpeningIsOverdue } from "@/components/map/store-opening-alert";
import {
  StoreFormFields,
  formToStoreData,
  storeToForm,
  type StoreFormData,
} from "@/components/map/store-form-fields";
import { StoreViewFields } from "@/components/map/store-view-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MAP_PANEL_HEIGHT_CLASS,
  MAP_PANEL_SHELL_CLASS,
} from "@/lib/map-panel-styles";
import {
  getProjectStatusLabel,
  projectStatusConfig,
} from "@/lib/project-status";
import type { Store } from "@/types";

type StoreDetailPanelProps = {
  store: Store;
  onClose: () => void;
};

export function StoreDetailPanel({ store, onClose }: StoreDetailPanelProps) {
  const router = useRouter();
  const { user } = useAuth();
  const t = useT();
  const { canEdit, canDelete } = usePermissions("map");
  const { updateStore, deleteStore } = useStores();
  const { contracts } = useDb();

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<StoreFormData>(storeToForm(store));
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const storeId = store.id;

  useEffect(() => {
    setForm(storeToForm(store));
    setIsEditing(false);
    setSaved(false);
    setSaveError("");
  }, [storeId]);

  useEffect(() => {
    if (!isEditing) {
      setForm(storeToForm(store));
    }
  }, [store, isEditing]);

  const projectConfig = projectStatusConfig[store.projectStatus];
  const openingBadge = storeOpeningBadgeLabel(store);

  const handleSave = async () => {
    if (!user || !canEdit) return;
    setSaveError("");
    const ok = await updateStore(
      store.id,
      formToStoreData(form, {
        latitude: store.latitude,
        longitude: store.longitude,
      }),
      { userId: user.id, userName: user.name }
    );
    if (!ok) {
      setSaveError("Kayıt başarısız. Yetkinizi veya bağlantınızı kontrol edin.");
      return;
    }
    setSaved(true);
    setIsEditing(false);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDelete = () => {
    if (!canDelete) return;
    if (confirm("Bu konumu silmek istediğinize emin misiniz?")) {
      deleteStore(store.id);
      onClose();
    }
  };

  return (
    <div className="pointer-events-auto absolute bottom-4 right-4 z-20 flex w-full max-w-md animate-in sm:w-[min(420px,calc(100vw-2rem))]">
      <div className={cn("flex w-full flex-col", MAP_PANEL_HEIGHT_CLASS, MAP_PANEL_SHELL_CLASS)}>
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 p-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold text-zinc-100">{store.name}</h3>
            <Badge
              className={`${projectConfig.color} border border-current/20 bg-current/10`}
            >
              {getProjectStatusLabel(store.projectStatus, t)}
            </Badge>
            {openingBadge && (
              <Badge
                className={cn(
                  "border border-current/20 bg-current/10",
                  storeOpeningIsOverdue(store)
                    ? "animate-none text-amber-400"
                    : "animate-pulse text-red-400"
                )}
              >
                {openingBadge}
              </Badge>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              className="text-cyan-300"
              onClick={() => router.push(`/stores/${store.id}`)}
              aria-label={t("common.openFullPage")}
              title={t("common.openFullPage")}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
              aria-label="Kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
          <StoreOpeningAlert store={store} />
          <ContractIhaleWarning store={store} contracts={contracts} compact />
          {isEditing ? (
            <StoreFormFields form={form} onChange={setForm} />
          ) : (
            <StoreViewFields store={store} />
          )}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-zinc-800 p-4">
          {saveError && (
            <p className="w-full text-xs text-red-400">{saveError}</p>
          )}
          {!isEditing && canEdit && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Düzenle
            </Button>
          )}
          {isEditing && (
            <>
              {canDelete && (
                <Button variant="danger" size="sm" onClick={handleDelete}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setForm(storeToForm(store));
                  setIsEditing(false);
                }}
              >
                İptal
              </Button>
              <Button className="flex-1" size="sm" onClick={handleSave}>
                <Save className="h-3.5 w-3.5" />
                {saved ? "Kaydedildi!" : "Kaydet"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

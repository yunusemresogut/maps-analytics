"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Pencil, Save, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/contexts/i18n-context";
import { useDb } from "@/contexts/db-context";
import { useStores } from "@/contexts/stores-context";
import { usePermissions } from "@/hooks/use-permissions";
import { useStoreForm } from "@/hooks/use-store-form";
import { useMapPickBridge } from "@/hooks/use-map-pick-bridge";
import { ContractIhaleWarning } from "@/components/contracts/contract-ihale-warning";
import { StoreOpeningAlert, storeOpeningBadgeLabel, storeOpeningIsOverdue } from "@/components/map/store-opening-alert";
import { StoreFormFields } from "@/components/map/store-form-fields";
import { StoreLocationFields } from "@/components/location/store-location-fields";
import { StoreViewFields } from "@/components/map/store-view-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MAP_PANEL_HEIGHT_CLASS,
  MAP_PANEL_SHELL_CLASS,
  MAP_PANEL_BOTTOM_CLASS,
} from "@/lib/map-panel-styles";
import {
  getProjectStatusLabel,
  projectStatusConfig,
} from "@/lib/project-status";
import type { Coords, MapPick } from "@/lib/geocode";
import type { Store } from "@/types";

type MapBridgeProps = {
  /** Ana haritadan gelen son seçim (tıklama ya da taslak pini sürükleme) */
  mapPick: MapPick | null;
  onPickModeChange: (active: boolean) => void;
  onDraftChange: (coords: Coords | null) => void;
};

type StoreDetailPanelProps = MapBridgeProps & {
  store: Store;
  onClose: () => void;
  /** Düzenleme açıkken harita tıklamaları paneli kapatmaz */
  onEditingChange: (editing: boolean) => void;
};

/** Düzenleme oturumu: her açılışta mağazanın güncel hâlinden başlar */
function StoreEditor({
  store,
  mapPick,
  onPickModeChange,
  onDraftChange,
  canDelete,
  onDelete,
  onCancel,
  onSaved,
}: MapBridgeProps & {
  store: Store;
  canDelete: boolean;
  onDelete: () => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const { user } = useAuth();
  const { updateStore } = useStores();
  const { form, setForm, errors, setErrors, location, prepare } = useStoreForm(store);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useMapPickBridge({
    mapPick,
    controller: location,
    pickActive: picking,
    // Taslak pin yalnızca konum değiştiyse ya da seçim yapılırken gösterilir
    showDraft: picking || location.changed,
    onPickModeChange,
    onDraftChange,
  });

  const handleSave = async () => {
    if (!user) return;
    setSaveError("");
    const prepared = prepare();
    if (!prepared.ok) {
      setSaveError(prepared.message);
      return;
    }
    setSaving(true);
    const ok = await updateStore(store.id, prepared.data, { userId: user.id, userName: user.name });
    setSaving(false);
    if (!ok) {
      setSaveError(t("site.mapPanels.saveFailed"));
      return;
    }
    onSaved();
  };

  return (
    <>
      <div className="scrollbar-themed min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <StoreLocationFields
          controller={location}
          mapPick={{
            active: picking,
            onToggle: () => setPicking((value) => !value),
            hint: picking
              ? t("site.mapPanels.pickActiveHint")
              : t("site.mapPanels.pickIdleHint"),
          }}
          errors={{ city: errors.city, address: errors.address }}
        />
        <StoreFormFields form={form} onChange={setForm} errors={errors} onErrorsChange={setErrors} />
      </div>

      <div className="flex shrink-0 flex-wrap gap-2 border-t border-zinc-800 p-4">
        {saveError && (
          <p className="w-full text-xs text-red-400" role="alert">
            {saveError}
          </p>
        )}
        {canDelete && (
          <Button variant="danger" size="sm" onClick={onDelete} aria-label={t("common.delete")}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button className="flex-1" size="sm" loading={saving} onClick={() => void handleSave()}>
          <Save className="h-3.5 w-3.5" />
          {t("common.save")}
        </Button>
      </div>
    </>
  );
}

export function StoreDetailPanel({
  store,
  onClose,
  mapPick,
  onPickModeChange,
  onDraftChange,
  onEditingChange,
}: StoreDetailPanelProps) {
  const router = useRouter();
  const t = useT();
  const { canEdit, canDelete } = usePermissions("map");
  const { deleteStore } = useStores();
  const { contracts } = useDb();

  // Başka mağazaya geçilince düzenleme kendiliğinden kapanır
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const isEditing = editingStoreId === store.id;

  useEffect(() => {
    onEditingChange(isEditing);
    return () => onEditingChange(false);
  }, [isEditing, onEditingChange]);

  const projectConfig = projectStatusConfig[store.projectStatus];
  const openingBadge = storeOpeningBadgeLabel(store);

  const handleDelete = () => {
    if (!canDelete) return;
    if (confirm(t("site.mapPanels.confirmDelete"))) {
      deleteStore(store.id);
      onClose();
    }
  };

  return (
    <div className={cn(MAP_PANEL_BOTTOM_CLASS, "pointer-events-auto absolute right-4 z-20 flex w-full max-w-md animate-in sm:w-[min(420px,calc(100vw-2rem))]")}>
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
                  storeOpeningIsOverdue(store) ? "text-amber-400" : "text-red-400"
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
              className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
              aria-label={t("common.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {isEditing ? (
          <StoreEditor
            key={store.id}
            store={store}
            mapPick={mapPick}
            onPickModeChange={onPickModeChange}
            onDraftChange={onDraftChange}
            canDelete={canDelete}
            onDelete={handleDelete}
            onCancel={() => setEditingStoreId(null)}
            onSaved={() => {
              setEditingStoreId(null);
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            }}
          />
        ) : (
          <>
            <div className="scrollbar-themed min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              <StoreOpeningAlert store={store} />
              <ContractIhaleWarning store={store} contracts={contracts} compact />
              <StoreViewFields store={store} />
            </div>

            <div className="flex shrink-0 items-center gap-2 border-t border-zinc-800 p-4">
              {saved && <p className="text-xs text-emerald-400">{t("site.mapPanels.saved")}</p>}
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditingStoreId(store.id)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {t("common.edit")}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/contexts/i18n-context";
import { useStores } from "@/contexts/stores-context";
import { useLocationTypes } from "@/hooks/use-location-types";
import { DEFAULT_LOCATION_TYPES, newLocationTypeKey } from "@/lib/location-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SaveIndicator, SettingsSection, useAutoSave } from "@/components/settings/settings-ui";
import type { LocationTypeOption } from "@/types";

const normalizeLabel = (label: string) => label.trim().toLocaleLowerCase("tr-TR");

/** Kurucunun saha türlerini eklediği, adlandırdığı ve sildiği bölüm */
export function LocationTypesSection() {
  const { updateOrganization } = useAuth();
  const t = useT();
  const { stores } = useStores();
  const { types } = useLocationTypes();
  const { state, run } = useAutoSave();
  const [draft, setDraft] = useState<LocationTypeOption[]>(types);
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState("");
  const [invalidKeys, setInvalidKeys] = useState<Set<string>>(new Set());
  const [newLabelInvalid, setNewLabelInvalid] = useState(false);

  const usage = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const store of stores) counts[store.locationType] = (counts[store.locationType] ?? 0) + 1;
    return counts;
  }, [stores]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(types);

  const rename = (key: string, label: string) => {
    setDraft((prev) => prev.map((type) => (type.key === key ? { ...type, label } : type)));
    setInvalidKeys(new Set());
    setError("");
  };

  const remove = (key: string) => {
    setDraft((prev) => prev.filter((type) => type.key !== key));
    setError("");
  };

  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    if (draft.some((type) => normalizeLabel(type.label) === normalizeLabel(label))) {
      setNewLabelInvalid(true);
      setError(t("settings.locationTypes.duplicateNew", { name: label }));
      return;
    }
    setDraft((prev) => [...prev, { key: newLocationTypeKey(), label }]);
    setNewLabel("");
    setError("");
  };

  // Varsayılan türlerden listede olmayanları geri ekler; mevcut adlar korunur
  const restoreDefaults = () => {
    setDraft((prev) => [...prev, ...DEFAULT_LOCATION_TYPES.filter((d) => !prev.some((type) => type.key === d.key))]);
    setError("");
  };

  const save = () => {
    const cleaned = draft.map((type) => ({ ...type, label: type.label.trim() }));
    if (cleaned.length === 0) return setError(t("settings.locationTypes.atLeastOne"));
    const empty = cleaned.filter((type) => !type.label).map((type) => type.key);
    if (empty.length > 0) {
      setInvalidKeys(new Set(empty));
      return setError(t("settings.locationTypes.emptyName"));
    }
    const labels = cleaned.map((type) => normalizeLabel(type.label));
    const duplicates = cleaned.filter((_, i) => labels.indexOf(labels[i]) !== labels.lastIndexOf(labels[i]));
    if (duplicates.length > 0) {
      setInvalidKeys(new Set(duplicates.map((type) => type.key)));
      return setError(t("settings.locationTypes.duplicate"));
    }
    setInvalidKeys(new Set());
    setError("");
    void run(async () => {
      const ok = await updateOrganization({ locationTypes: cleaned });
      if (!ok) setError(t("settings.locationTypes.saveFailed"));
      return ok;
    });
  };

  const missingDefaults = DEFAULT_LOCATION_TYPES.some((d) => !draft.some((type) => type.key === d.key));

  return (
    <SettingsSection
      title={t("settings.locationTypes.title")}
      description={t("settings.locationTypes.description")}
      action={<SaveIndicator state={state} />}
    >
      <ul>
        {draft.map((type) => {
          const count = usage[type.key] ?? 0;
          const lastOne = draft.length === 1;
          return (
            <li key={type.key} className="flex items-center gap-3 px-5 py-2.5">
              <Input
                value={type.label}
                onChange={(e) => rename(type.key, e.target.value)}
                maxLength={40}
                aria-label={t("settings.locationTypes.nameLabel")}
                aria-invalid={invalidKeys.has(type.key)}
                className="h-9 max-w-xs"
              />
              <span className="flex-1 text-xs text-zinc-500 tabular-nums">
                {count > 0 ? t(count === 1 ? "settings.locationTypes.usedOne" : "settings.locationTypes.usedOther", { count }) : t("settings.locationTypes.unused")}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove(type.key)}
                disabled={count > 0 || lastOne}
                title={count > 0 ? t("settings.locationTypes.inUse") : lastOne ? t("settings.locationTypes.keepOne") : t("common.delete")}
                aria-label={t("settings.locationTypes.deleteLabel", { name: type.label })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-2 px-5 py-3.5">
        <Input
          value={newLabel}
          onChange={(e) => {
            setNewLabel(e.target.value);
            setNewLabelInvalid(false);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          maxLength={40}
          placeholder={t("settings.locationTypes.newPlaceholder")}
          aria-label={t("settings.locationTypes.newLabel")}
          aria-invalid={newLabelInvalid}
          className="h-9 max-w-xs"
        />
        <Button variant="outline" size="sm" onClick={add} disabled={!newLabel.trim()}>
          <Plus className="h-3.5 w-3.5" />
          {t("common.add")}
        </Button>
        {missingDefaults && (
          <Button variant="ghost" size="sm" onClick={restoreDefaults}>
            <RotateCcw className="h-3.5 w-3.5" />
            {t("settings.locationTypes.restoreDefaults")}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
        <Button onClick={save} loading={state === "saving"} disabled={!dirty}>
          {t("common.save")}
        </Button>
        {dirty && (
          <Button variant="ghost" onClick={() => setDraft(types)}>
            {t("settings.locationTypes.discard")}
          </Button>
        )}
        {error && (
          <p className="text-xs text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
    </SettingsSection>
  );
}

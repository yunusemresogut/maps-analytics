"use client";

import { useMemo, useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
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
  const { stores } = useStores();
  const { types } = useLocationTypes();
  const { state, run } = useAutoSave();
  const [draft, setDraft] = useState<LocationTypeOption[]>(types);
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState("");

  const usage = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const store of stores) counts[store.locationType] = (counts[store.locationType] ?? 0) + 1;
    return counts;
  }, [stores]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(types);

  const rename = (key: string, label: string) => {
    setDraft((prev) => prev.map((type) => (type.key === key ? { ...type, label } : type)));
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
      setError(`"${label}" zaten listede.`);
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
    if (cleaned.length === 0) return setError("En az bir saha türü olmalı.");
    if (cleaned.some((type) => !type.label)) return setError("Saha türü adı boş olamaz.");
    const labels = cleaned.map((type) => normalizeLabel(type.label));
    if (new Set(labels).size !== labels.length) return setError("Aynı adda iki saha türü olamaz.");
    setError("");
    void run(async () => {
      const ok = await updateOrganization({ locationTypes: cleaned });
      if (!ok) setError("Kaydedilemedi. Kullanımdaki bir tür silinmiş olabilir ya da veritabanı güncel değil.");
      return ok;
    });
  };

  const missingDefaults = DEFAULT_LOCATION_TYPES.some((d) => !draft.some((type) => type.key === d.key));

  return (
    <SettingsSection
      title="Saha türleri"
      description="Saha eklerken ve düzenlerken seçilen türler. Sahalarda kullanılan bir tür silinemez."
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
                aria-label="Saha türü adı"
                className="h-9 max-w-xs"
              />
              <span className="flex-1 text-xs text-zinc-500 tabular-nums">
                {count > 0 ? `${count} sahada kullanılıyor` : "Kullanılmıyor"}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove(type.key)}
                disabled={count > 0 || lastOne}
                title={count > 0 ? "Bu türdeki sahaların türünü değiştirmeden silinemez" : lastOne ? "En az bir tür kalmalı" : "Sil"}
                aria-label={`${type.label} türünü sil`}
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
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          maxLength={40}
          placeholder="Yeni saha türü (ör. Depo)"
          aria-label="Yeni saha türü"
          className="h-9 max-w-xs"
        />
        <Button variant="outline" size="sm" onClick={add} disabled={!newLabel.trim()}>
          <Plus className="h-3.5 w-3.5" />
          Ekle
        </Button>
        {missingDefaults && (
          <Button variant="ghost" size="sm" onClick={restoreDefaults}>
            <RotateCcw className="h-3.5 w-3.5" />
            Varsayılanları geri ekle
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
        <Button onClick={save} loading={state === "saving"} disabled={!dirty}>
          Kaydet
        </Button>
        {dirty && (
          <Button variant="ghost" onClick={() => setDraft(types)}>
            Vazgeç
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

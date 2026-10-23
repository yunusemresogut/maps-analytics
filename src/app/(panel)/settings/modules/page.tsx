"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { useSettings } from "@/contexts/settings-context";
import { TOGGLEABLE_MODULES } from "@/lib/settings";
import { Select } from "@/components/ui/select";
import {
  SettingRow,
  SettingsPageHeader,
  SettingsSection,
  SwitchRow,
  useAutoSave,
} from "@/components/settings/settings-ui";

const RETENTION_OPTIONS = [1, 3, 7, 14, 30];

function ModulesContent() {
  const { org, updateOrgSettings } = useSettings();
  const { state, run } = useAutoSave();

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        title="Modüller ve özellikler"
        description="Firmanızda kullanılmayan modülleri kapatın ve ekip sohbeti ile asistanı yapılandırın."
        status={state}
      />

      <SettingsSection
        title="Modüller"
        description="Kapatılan modül tüm kullanıcılar için menüden kalkar, sayfaları açılmaz ve bildirim üretmez. Kayıtlar silinmez."
      >
        {TOGGLEABLE_MODULES.map((module) => (
          <SwitchRow
            key={module.key}
            label={module.label}
            description={module.description}
            checked={org.modules[module.key]}
            onChange={(enabled) => void run(() => updateOrgSettings({ modules: { [module.key]: enabled } }))}
          />
        ))}
      </SettingsSection>

      {org.modules.team && (
        <SettingsSection title="Ekip sohbeti">
          <SettingRow
            label="Mesaj saklama süresi"
            description="Bu süreyi dolduran mesajlar ve dosyalar kalıcı olarak silinir. Süreyi kısaltmak eski mesajları hemen gizler."
          >
            <Select
              aria-label="Mesaj saklama süresi"
              value={org.team.retentionDays}
              onChange={(e) =>
                void run(() => updateOrgSettings({ team: { retentionDays: Number(e.target.value) } }))
              }
              className="h-9 w-32"
            >
              {RETENTION_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  {days} gün
                </option>
              ))}
            </Select>
          </SettingRow>
          <SwitchRow
            label="Dosya paylaşımı"
            description="Kapatılırsa sohbette dosya gönderilemez (en fazla 10 MB)"
            checked={org.team.fileSharing}
            onChange={(enabled) => void run(() => updateOrgSettings({ team: { fileSharing: enabled } }))}
          />
        </SettingsSection>
      )}

      <SettingsSection title="Asistan" description="Sayfanın altındaki “Maps'e Sor” yapay zekâ asistanı">
        <SwitchRow
          label="Asistanı etkinleştir"
          description="Kapatılırsa asistan hiçbir kullanıcıya gösterilmez"
          checked={org.assistant.enabled}
          onChange={(enabled) => void run(() => updateOrgSettings({ assistant: { enabled } }))}
        />
        <SwitchRow
          label="Asistanla kayıt ekleme"
          description="Saha, ticket, iş planı ve keşif kalemlerinin sohbetten (önizleme ve onayla) eklenmesine izin verir. Kullanıcı yetkileri yine geçerlidir."
          checked={org.assistant.allowActions}
          disabled={!org.assistant.enabled}
          indent
          onChange={(allowActions) => void run(() => updateOrgSettings({ assistant: { allowActions } }))}
        />
      </SettingsSection>
    </div>
  );
}

export default function ModulesSettingsPage() {
  return (
    <AuthGuard routeKey="adminSettings">
      <ModulesContent />
    </AuthGuard>
  );
}

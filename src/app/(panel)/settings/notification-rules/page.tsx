"use client";

import { useState } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useI18n } from "@/contexts/i18n-context";
import { useSettings } from "@/contexts/settings-context";
import { NOTIFICATION_MODULES, NOTIFICATION_TYPES, notificationModuleDisabled } from "@/lib/settings";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SettingRow, SettingsPageHeader, SettingsSection, useAutoSave } from "@/components/settings/settings-ui";
import type { NotificationType } from "@/types";

/** Gün eşiği: odaktan çıkınca kaydedilir, aralık dışı değer reddedilir */
function DaysInput({
  label,
  value,
  min,
  max,
  onSave,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onSave: (days: number) => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(String(value));
  const days = Number(draft);
  const invalid = !Number.isInteger(days) || days < min || days > max;
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={min}
        max={max}
        aria-label={label}
        aria-invalid={invalid}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (invalid) setDraft(String(value));
          else if (days !== value) onSave(days);
        }}
        className="h-9 w-24"
      />
      <span className="text-xs text-zinc-500">{t("settings.common.days")}</span>
    </div>
  );
}

function NotificationRulesContent() {
  const { t } = useI18n();
  const { org, updateOrgSettings } = useSettings();
  const { state, run } = useAutoSave();
  const rules = org.notifications.rules;

  const setRule = (type: NotificationType, patch: { enabled?: boolean; mandatory?: boolean }) =>
    void run(() => updateOrgSettings({ notifications: { rules: { [type]: patch } } }));

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        title={t("pageTitle.settingsNotificationRules")}
        description={t("settings.rules.description")}
        status={state}
      />

      <SettingsSection title={t("settings.rules.thresholds")}>
        <SettingRow label={t("settings.rules.openingSoon")} description={t("settings.rules.openingSoonDescription")}>
          <DaysInput
            label={t("settings.rules.openingSoon")}
            value={org.notifications.openingSoonDays}
            min={1}
            max={90}
            onSave={(days) => void run(() => updateOrgSettings({ notifications: { openingSoonDays: days } }))}
          />
        </SettingRow>
        <SettingRow label={t("settings.rules.contractExpiry")} description={t("settings.rules.contractExpiryDescription")}>
          <DaysInput
            label={t("settings.rules.contractExpiry")}
            value={org.notifications.contractExpiryDays}
            min={1}
            max={180}
            onSave={(days) => void run(() => updateOrgSettings({ notifications: { contractExpiryDays: days } }))}
          />
        </SettingRow>
        <SettingRow label={t("settings.rules.certificateExpiry")} description={t("settings.rules.certificateExpiryDescription")}>
          <DaysInput
            label={t("settings.rules.certificateExpiry")}
            value={org.notifications.certificateExpiryDays}
            min={1}
            max={180}
            onSave={(days) => void run(() => updateOrgSettings({ notifications: { certificateExpiryDays: days } }))}
          />
        </SettingRow>
        <SettingRow label={t("settings.rules.vehicleExpiry")} description={t("settings.rules.vehicleExpiryDescription")}>
          <DaysInput
            label={t("settings.rules.vehicleExpiry")}
            value={org.notifications.vehicleExpiryDays}
            min={1}
            max={180}
            onSave={(days) => void run(() => updateOrgSettings({ notifications: { vehicleExpiryDays: days } }))}
          />
        </SettingRow>
      </SettingsSection>

      {NOTIFICATION_MODULES.map((module) => {
        const moduleDisabled = notificationModuleDisabled(module.key, org);
        return (
          <SettingsSection
            key={module.key}
            title={module.label}
            description={moduleDisabled ? t("settings.rules.moduleDisabled") : undefined}
          >
            {NOTIFICATION_TYPES.filter((item) => item.module === module.key).map((item) => {
              const rule = rules[item.type];
              return (
                <SettingRow key={item.type} label={item.label} description={item.description}>
                  <Switch
                    label={t("settings.rules.active")}
                    ariaLabel={t("settings.rules.activeLabel", { name: item.label })}
                    checked={rule.enabled}
                    disabled={moduleDisabled}
                    onChange={(enabled) => setRule(item.type, enabled ? { enabled } : { enabled, mandatory: false })}
                  />
                  <Switch
                    label={t("settings.rules.mandatory")}
                    ariaLabel={t("settings.rules.mandatoryLabel", { name: item.label })}
                    checked={rule.enabled && rule.mandatory}
                    disabled={moduleDisabled || !rule.enabled}
                    onChange={(mandatory) => setRule(item.type, { mandatory })}
                  />
                </SettingRow>
              );
            })}
          </SettingsSection>
        );
      })}
    </div>
  );
}

export default function NotificationRulesPage() {
  return (
    <AuthGuard routeKey="adminSettings">
      <NotificationRulesContent />
    </AuthGuard>
  );
}

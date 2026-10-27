"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { useI18n } from "@/contexts/i18n-context";
import { useSettings } from "@/contexts/settings-context";
import { DAILY_HOUR_OPTIONS, TOGGLEABLE_MODULES } from "@/lib/settings";
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
  const { t, locale } = useI18n();
  const { org, updateOrgSettings } = useSettings();
  const { state, run } = useAutoSave();

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        title={t("pageTitle.settingsModules")}
        description={t("settings.modules.description")}
        status={state}
      />

      <SettingsSection
        title={t("settings.modules.modulesTitle")}
        description={t("settings.modules.modulesDescription")}
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
        <SettingsSection title={t("settings.modules.teamChat")}>
          <SettingRow
            label={t("settings.modules.retention")}
            description={t("settings.modules.retentionDescription")}
          >
            <Select
              aria-label={t("settings.modules.retention")}
              value={org.team.retentionDays}
              onChange={(e) =>
                void run(() => updateOrgSettings({ team: { retentionDays: Number(e.target.value) } }))
              }
              className="h-9 w-32"
            >
              {RETENTION_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  {t(days === 1 ? "settings.common.dayOne" : "settings.common.dayOther", { count: days })}
                </option>
              ))}
            </Select>
          </SettingRow>
          <SwitchRow
            label={t("settings.modules.fileSharing")}
            description={t("settings.modules.fileSharingDescription")}
            checked={org.team.fileSharing}
            onChange={(enabled) => void run(() => updateOrgSettings({ team: { fileSharing: enabled } }))}
          />
        </SettingsSection>
      )}

      {org.modules.hr && (
        <SettingsSection title={t("settings.modules.hr")}>
          <SwitchRow
            label={t("settings.modules.saturdayWorking")}
            description={t("settings.modules.saturdayWorkingDescription")}
            checked={org.hr.saturdayWorking}
            onChange={(enabled) => void run(() => updateOrgSettings({ hr: { saturdayWorking: enabled } }))}
          />
          <SettingRow
            label={t("settings.modules.dailyHours")}
            description={t("settings.modules.dailyHoursDescription")}
          >
            <Select
              aria-label={t("settings.modules.dailyHours")}
              value={org.hr.dailyHours}
              onChange={(e) => void run(() => updateOrgSettings({ hr: { dailyHours: Number(e.target.value) } }))}
              className="h-9 w-32"
            >
              {DAILY_HOUR_OPTIONS.map((hours) => (
                <option key={hours} value={hours}>
                  {t("settings.modules.hoursValue", { hours: locale === "en" ? String(hours) : String(hours).replace(".", ",") })}
                </option>
              ))}
            </Select>
          </SettingRow>
        </SettingsSection>
      )}

      <SettingsSection title={t("settings.modules.assistant")} description={t("settings.modules.assistantDescription")}>
        <SwitchRow
          label={t("settings.modules.assistantEnabled")}
          description={t("settings.modules.assistantEnabledDescription")}
          checked={org.assistant.enabled}
          onChange={(enabled) => void run(() => updateOrgSettings({ assistant: { enabled } }))}
        />
        <SwitchRow
          label={t("settings.modules.assistantActions")}
          description={t("settings.modules.assistantActionsDescription")}
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

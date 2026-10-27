"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useSettings } from "@/contexts/settings-context";
import { useI18n } from "@/contexts/i18n-context";
import { useTheme, type ThemeMode } from "@/contexts/theme-context";
import { LOCALES, type Locale, type TranslationKey } from "@/i18n";
import { canAccessRoute } from "@/lib/permissions";
import { PAGE_SIZE_OPTIONS, START_PAGES } from "@/lib/settings";
import { getHiddenRegionsKey, getMapViewKey } from "@/lib/storage-keys";
import { clearTableMemory } from "@/lib/table-memory";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  SettingRow,
  SettingsPageHeader,
  SettingsSection,
  SwitchRow,
  useAutoSave,
} from "@/components/settings/settings-ui";

const THEME_OPTIONS: { value: ThemeMode; labelKey: TranslationKey }[] = [
  { value: "dark", labelKey: "settings.preferences.themeDark" },
  { value: "light", labelKey: "settings.preferences.themeLight" },
  { value: "system", labelKey: "settings.preferences.themeSystem" },
];

/** Diller kendi adlarıyla gösterilir (seçili dilden bağımsız) */
const LOCALE_LABELS: Record<Locale, string> = { tr: "Türkçe", en: "English" };

export default function PreferencesPage() {
  const { user } = useAuth();
  const { org, prefs, updatePreferences, isModuleEnabled } = useSettings();
  const { mode, setMode } = useTheme();
  const { t, locale, setLocale } = useI18n();
  const { state, run } = useAutoSave();
  const [cleared, setCleared] = useState<"tables" | "map" | null>(null);

  if (!user) return null;

  const startPages = START_PAGES.filter(
    (page) => canAccessRoute(user, page.routeKey) && isModuleEnabled(page.routeKey)
  );

  const clearMap = () => {
    try {
      localStorage.removeItem(getMapViewKey(user.id));
      localStorage.removeItem(getHiddenRegionsKey(user.id));
    } catch {
      // depolama yoksa silinecek bir şey de yok
    }
    setCleared("map");
  };

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        title={t("pageTitle.settingsPreferences")}
        description={t("settings.preferences.description")}
        status={state}
      />

      <SettingsSection title={t("settings.preferences.appearance")} description={t("settings.preferences.appearanceDescription")}>
        <SettingRow label={t("settings.preferences.theme")}>
          <Select
            aria-label={t("settings.preferences.theme")}
            value={mode}
            onChange={(e) => setMode(e.target.value as ThemeMode)}
            className="h-9 w-40"
          >
            {THEME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </Select>
        </SettingRow>
        <SettingRow label={t("language.label")}>
          <Select
            aria-label={t("language.label")}
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className="h-9 w-40"
          >
            {LOCALES.map((value) => (
              <option key={value} value={value}>
                {LOCALE_LABELS[value]}
              </option>
            ))}
          </Select>
        </SettingRow>
        <SettingRow label={t("settings.preferences.startPage")} description={t("settings.preferences.startPageDescription")}>
          <Select
            aria-label={t("settings.preferences.startPage")}
            value={prefs.startPage}
            onChange={(e) => void run(() => updatePreferences({ startPage: e.target.value }))}
            className="h-9 w-40"
          >
            {startPages.map((page) => (
              <option key={page.value} value={page.value}>
                {page.label}
              </option>
            ))}
          </Select>
        </SettingRow>
      </SettingsSection>

      <SettingsSection title={t("settings.preferences.tables")}>
        <SettingRow label={t("settings.preferences.pageSize")} description={t("settings.preferences.pageSizeDescription")}>
          <Select
            aria-label={t("settings.preferences.pageSize")}
            value={prefs.pageSize}
            onChange={(e) => void run(() => updatePreferences({ pageSize: Number(e.target.value) }))}
            className="h-9 w-40"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </SettingRow>
        <SwitchRow
          label={t("settings.preferences.tableMemory")}
          description={t("settings.preferences.tableMemoryDescription")}
          checked={prefs.tableMemory}
          onChange={(enabled) => void run(() => updatePreferences({ tableMemory: enabled }))}
        />
        {prefs.tableMemory && (
          <SettingRow label={t("settings.preferences.clearMemory")} description={t("settings.preferences.clearMemoryDescription")} indent>
            {cleared === "tables" && <span className="text-xs text-emerald-400">{t("settings.preferences.cleared")}</span>}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                clearTableMemory();
                setCleared("tables");
              }}
            >
              {t("settings.preferences.clear")}
            </Button>
          </SettingRow>
        )}
      </SettingsSection>

      <SettingsSection title={t("nav.map")} description={t("settings.preferences.mapDescription")}>
        <SwitchRow
          label={t("settings.preferences.rememberView")}
          description={t("settings.preferences.rememberViewDescription")}
          checked={prefs.map.rememberView}
          onChange={(enabled) => void run(() => updatePreferences({ map: { rememberView: enabled } }))}
        />
        <SwitchRow
          label={t("settings.preferences.rememberRegions")}
          description={t("settings.preferences.rememberRegionsDescription")}
          checked={prefs.map.rememberRegions}
          onChange={(enabled) => void run(() => updatePreferences({ map: { rememberRegions: enabled } }))}
        />
        <SettingRow label={t("settings.preferences.resetMap")}>
          {cleared === "map" && <span className="text-xs text-emerald-400">{t("settings.preferences.reset")}</span>}
          <Button size="sm" variant="outline" onClick={clearMap}>
            {t("settings.preferences.resetButton")}
          </Button>
        </SettingRow>
      </SettingsSection>

      {org.assistant.enabled && (
        <SettingsSection title={t("settings.modules.assistant")} description={t("settings.preferences.assistantDescription")}>
          <SwitchRow
            label={t("settings.preferences.showAssistant")}
            checked={prefs.assistant.visible}
            onChange={(enabled) => void run(() => updatePreferences({ assistant: { visible: enabled } }))}
          />
          <SwitchRow
            label={t("settings.preferences.keepHistory")}
            description={t("settings.preferences.keepHistoryDescription")}
            checked={prefs.assistant.keepHistory}
            onChange={(enabled) => void run(() => updatePreferences({ assistant: { keepHistory: enabled } }))}
          />
        </SettingsSection>
      )}
    </div>
  );
}

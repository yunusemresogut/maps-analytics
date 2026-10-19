"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useSettings } from "@/contexts/settings-context";
import { useI18n } from "@/contexts/i18n-context";
import { useTheme, type ThemeMode } from "@/contexts/theme-context";
import { LOCALES, type Locale } from "@/i18n";
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

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "dark", label: "Koyu" },
  { value: "light", label: "Açık" },
  { value: "system", label: "Sistem" },
];

const LOCALE_LABELS: Record<Locale, string> = { tr: "Türkçe", en: "English" };

export default function PreferencesPage() {
  const { user } = useAuth();
  const { org, prefs, updatePreferences, isModuleEnabled } = useSettings();
  const { mode, setMode } = useTheme();
  const { locale, setLocale } = useI18n();
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
        title="Tercihler"
        description="Uygulamanın size nasıl görüneceğini ve nasıl davranacağını ayarlayın."
        status={state}
      />

      <SettingsSection title="Görünüm" description="Tema ve dil bu cihazda saklanır.">
        <SettingRow label="Tema">
          <Select
            aria-label="Tema"
            value={mode}
            onChange={(e) => setMode(e.target.value as ThemeMode)}
            className="h-9 w-40"
          >
            {THEME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </SettingRow>
        <SettingRow label="Dil">
          <Select
            aria-label="Dil"
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
        <SettingRow label="Açılış sayfası" description="Giriş yaptığınızda ve logoya tıkladığınızda açılan sayfa">
          <Select
            aria-label="Açılış sayfası"
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

      <SettingsSection title="Tablolar">
        <SettingRow label="Sayfa başına satır" description="Tablolarda varsayılan olarak gösterilen satır sayısı">
          <Select
            aria-label="Sayfa başına satır"
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
          label="Tablo hafızası"
          description="Tablolardaki arama, filtre, sıralama ve sayfa konumu siz başka sayfaya geçip döndüğünüzde korunur. Sekme kapanınca sıfırlanır."
          checked={prefs.tableMemory}
          onChange={(enabled) => void run(() => updatePreferences({ tableMemory: enabled }))}
        />
        {prefs.tableMemory && (
          <SettingRow label="Hafızayı temizle" description="Tüm tabloları varsayılan görünümüne döndürür" indent>
            {cleared === "tables" && <span className="text-xs text-emerald-400">Temizlendi</span>}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                clearTableMemory();
                setCleared("tables");
              }}
            >
              Temizle
            </Button>
          </SettingRow>
        )}
      </SettingsSection>

      <SettingsSection title="Harita" description="Harita konumu ve bölge seçimi bu cihazda saklanır.">
        <SwitchRow
          label="Son harita konumunu hatırla"
          description="Harita açıldığında en son baktığınız yer ve yakınlaştırmadan başlar"
          checked={prefs.map.rememberView}
          onChange={(enabled) => void run(() => updatePreferences({ map: { rememberView: enabled } }))}
        />
        <SwitchRow
          label="Bölge filtresini hatırla"
          description="Haritada gizlediğiniz bölgeler bir sonraki açılışta da gizli kalır"
          checked={prefs.map.rememberRegions}
          onChange={(enabled) => void run(() => updatePreferences({ map: { rememberRegions: enabled } }))}
        />
        <SettingRow label="Kayıtlı harita durumunu sıfırla">
          {cleared === "map" && <span className="text-xs text-emerald-400">Sıfırlandı</span>}
          <Button size="sm" variant="outline" onClick={clearMap}>
            Sıfırla
          </Button>
        </SettingRow>
      </SettingsSection>

      {org.assistant.enabled && (
        <SettingsSection title="Asistan" description="Sayfanın altındaki “Maps'e Sor” asistanı">
          <SwitchRow
            label="Asistanı göster"
            checked={prefs.assistant.visible}
            onChange={(enabled) => void run(() => updatePreferences({ assistant: { visible: enabled } }))}
          />
          <SwitchRow
            label="Sohbet geçmişini sakla"
            description="Sayfayı yenilediğinizde son sohbet kaldığı yerden devam eder (bu cihazda, son 40 mesaj)"
            checked={prefs.assistant.keepHistory}
            onChange={(enabled) => void run(() => updatePreferences({ assistant: { keepHistory: enabled } }))}
          />
        </SettingsSection>
      )}
    </div>
  );
}

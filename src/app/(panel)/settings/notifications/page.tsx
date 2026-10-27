"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useT } from "@/contexts/i18n-context";
import { useSettings } from "@/contexts/settings-context";
import { canModule } from "@/lib/permissions";
import {
  NOTIFICATION_MODULES,
  NOTIFICATION_TYPES,
  notificationModuleDisabled,
  notificationState,
  type NotificationModule,
} from "@/lib/settings";
import {
  SettingsPageHeader,
  SettingsSection,
  SwitchRow,
  useAutoSave,
} from "@/components/settings/settings-ui";
import type { NotificationType, User } from "@/types";

/** Modülü görebilen kullanıcıya o modülün bildirim ayarları gösterilir */
function canSeeModule(user: User, module: NotificationModule) {
  // Personel kendi belgelerinin bildirimini de alır
  if (module === "team" || module === "hr") return true;
  // Zimmetli aracın belgesi bitince aracı kullanan da bildirim alır
  if (module === "inventory") return true;
  if (module === "stores") return canModule(user, "map", "view") || canModule(user, "stores", "view");
  return canModule(user, module, "view");
}

export default function NotificationSettingsPage() {
  const { user } = useAuth();
  const t = useT();
  const { org, prefs, updatePreferences } = useSettings();
  const { state, run } = useAutoSave();
  const [desktopError, setDesktopError] = useState("");

  if (!user) return null;

  const setModule = (module: NotificationModule, enabled: boolean) =>
    run(() => updatePreferences({ notifications: { modules: { [module]: enabled } } }));

  const setType = (type: NotificationType, enabled: boolean) =>
    run(() => updatePreferences({ notifications: { types: { [type]: enabled } } }));

  const setDesktop = async (enabled: boolean) => {
    setDesktopError("");
    if (enabled) {
      if (!("Notification" in window)) {
        setDesktopError(t("settings.notifications.desktopUnsupported"));
        return;
      }
      const permission =
        Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      if (permission !== "granted") {
        setDesktopError(t("settings.notifications.desktopDenied"));
        return;
      }
    }
    await run(() => updatePreferences({ notifications: { desktop: enabled } }));
  };

  const modules = NOTIFICATION_MODULES.filter(
    (module) => canSeeModule(user, module.key) && !notificationModuleDisabled(module.key, org)
  );

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        title={t("notifications.title")}
        description={t("settings.notifications.description")}
        status={state}
      />

      <SettingsSection title={t("settings.notifications.desktopTitle")} description={t("settings.notifications.desktopDescription")}>
        <SwitchRow
          label={t("settings.notifications.desktopShow")}
          description={desktopError || t("settings.notifications.desktopHint")}
          checked={prefs.notifications.desktop}
          onChange={(enabled) => void setDesktop(enabled)}
        />
      </SettingsSection>

      {modules.map((module) => {
        const moduleOn = prefs.notifications.modules[module.key];
        const types = NOTIFICATION_TYPES.filter((item) => item.module === module.key);
        return (
          <SettingsSection key={module.key} title={module.label}>
            <SwitchRow
              label={t("settings.notifications.moduleToggle", { name: module.label })}
              description={t("settings.notifications.moduleToggleDescription")}
              checked={moduleOn}
              onChange={(enabled) => void setModule(module.key, enabled)}
            />
            {types.map((item) => {
              const status = notificationState(item.type, item.module, org, prefs);
              return (
                <SwitchRow
                  key={item.type}
                  indent
                  label={item.label}
                  description={item.description}
                  checked={status === "active" || status === "mandatory"}
                  onChange={(enabled) => void setType(item.type, enabled)}
                  disabled={!moduleOn && status !== "mandatory"}
                  lockedReason={
                    status === "mandatory"
                      ? t("settings.notifications.mandatoryByOrg")
                      : status === "disabled_by_org"
                        ? t("settings.notifications.disabledByOrg")
                        : undefined
                  }
                />
              );
            })}
          </SettingsSection>
        );
      })}
    </div>
  );
}

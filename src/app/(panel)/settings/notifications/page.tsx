"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useSettings } from "@/contexts/settings-context";
import { canModule } from "@/lib/permissions";
import {
  NOTIFICATION_MODULES,
  NOTIFICATION_TYPES,
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
  if (module === "team") return true;
  if (module === "stores") return canModule(user, "map", "view") || canModule(user, "stores", "view");
  return canModule(user, module, "view");
}

export default function NotificationSettingsPage() {
  const { user } = useAuth();
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
        setDesktopError("Tarayıcınız masaüstü bildirimlerini desteklemiyor.");
        return;
      }
      const permission =
        Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      if (permission !== "granted") {
        setDesktopError("Tarayıcı bildirim izni verilmedi. İzni tarayıcının site ayarlarından açabilirsiniz.");
        return;
      }
    }
    await run(() => updatePreferences({ notifications: { desktop: enabled } }));
  };

  const modules = NOTIFICATION_MODULES.filter(
    (module) => canSeeModule(user, module.key) && (module.key === "stores" || org.modules[module.key])
  );

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        title="Bildirimler"
        description="Hangi modüllerden bildirim alacağınızı seçin. Değişiklikler anında kaydedilir."
        status={state}
      />

      <SettingsSection title="Masaüstü bildirimleri" description="Uygulama arka plandayken yeni bildirimler işletim sistemi bildirimi olarak da gösterilir.">
        <SwitchRow
          label="Masaüstü bildirimi göster"
          description={desktopError || "Bu ayar her cihazda tarayıcı izni gerektirir."}
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
              label={`${module.label} bildirimleri`}
              description="Kapatırsanız aşağıdaki zorunlu olmayan bildirimlerin tümü kapanır."
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
                      ? "Firma tarafından zorunlu"
                      : status === "disabled_by_org"
                        ? "Firma tarafından kapalı"
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

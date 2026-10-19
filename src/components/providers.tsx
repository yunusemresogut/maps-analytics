"use client";

import { AuthProvider } from "@/contexts/auth-context";
import { RegionsProvider } from "@/contexts/regions-context";
import { StoreDataProvider } from "@/contexts/store-data-context";
import { StoresProvider } from "@/contexts/stores-context";
import { NotificationsProvider } from "@/contexts/notifications-context";
import { MapUiProvider } from "@/contexts/map-ui-context";
import { ThemeProvider } from "@/contexts/theme-context";
import { DbProvider } from "@/contexts/db-context";
import { SidebarProvider } from "@/contexts/sidebar-context";
import { I18nProvider } from "@/contexts/i18n-context";
import { ModulesProvider } from "@/contexts/modules-context";
import { TeamChatProvider } from "@/contexts/team-chat-context";
import { SettingsProvider } from "@/contexts/settings-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <DbProvider>
          <AuthProvider>
            <SettingsProvider>
              <SidebarProvider>
                <RegionsProvider>
                  <StoresProvider>
                    <ModulesProvider>
                      {/* Bildirimler ekip mesajlarını da kullanır */}
                      <TeamChatProvider>
                        <NotificationsProvider>
                          <MapUiProvider>
                            <StoreDataProvider>{children}</StoreDataProvider>
                          </MapUiProvider>
                        </NotificationsProvider>
                      </TeamChatProvider>
                    </ModulesProvider>
                  </StoresProvider>
                </RegionsProvider>
              </SidebarProvider>
            </SettingsProvider>
          </AuthProvider>
        </DbProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

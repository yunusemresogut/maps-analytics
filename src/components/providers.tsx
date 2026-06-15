"use client";

import { AuthProvider } from "@/contexts/auth-context";
import { RegionsProvider } from "@/contexts/regions-context";
import { StoreDataProvider } from "@/contexts/store-data-context";
import { StoresProvider } from "@/contexts/stores-context";
import { NotificationsProvider } from "@/contexts/notifications-context";
import { MapUiProvider } from "@/contexts/map-ui-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <RegionsProvider>
        <StoresProvider>
          <NotificationsProvider>
            <MapUiProvider>
              <StoreDataProvider>{children}</StoreDataProvider>
            </MapUiProvider>
          </NotificationsProvider>
        </StoresProvider>
      </RegionsProvider>
    </AuthProvider>
  );
}

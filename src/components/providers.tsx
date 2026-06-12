"use client";

import { AuthProvider } from "@/contexts/auth-context";
import { RegionsProvider } from "@/contexts/regions-context";
import { StoreDataProvider } from "@/contexts/store-data-context";
import { StoresProvider } from "@/contexts/stores-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <RegionsProvider>
        <StoresProvider>
          <StoreDataProvider>{children}</StoreDataProvider>
        </StoresProvider>
      </RegionsProvider>
    </AuthProvider>
  );
}

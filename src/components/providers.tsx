"use client";

import { AuthProvider } from "@/contexts/auth-context";
import { StoreDataProvider } from "@/contexts/store-data-context";
import { StoresProvider } from "@/contexts/stores-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <StoresProvider>
        <StoreDataProvider>{children}</StoreDataProvider>
      </StoresProvider>
    </AuthProvider>
  );
}

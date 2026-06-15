"use client";

import { createContext, useContext } from "react";

type AdminLayoutContextValue = {
  openMobileMenu: () => void;
};

const AdminLayoutContext = createContext<AdminLayoutContextValue | null>(null);

export function AdminLayoutProvider({
  children,
  openMobileMenu,
}: {
  children: React.ReactNode;
  openMobileMenu: () => void;
}) {
  return (
    <AdminLayoutContext.Provider value={{ openMobileMenu }}>
      {children}
    </AdminLayoutContext.Provider>
  );
}

export function useAdminLayout() {
  const ctx = useContext(AdminLayoutContext);
  if (!ctx) {
    throw new Error("useAdminLayout must be used within AdminLayoutProvider");
  }
  return ctx;
}

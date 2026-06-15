"use client";

import { useState } from "react";
import { AdminGuard } from "@/components/auth/admin-guard";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminLayoutProvider } from "@/contexts/admin-layout-context";

export default function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <AdminGuard>
      <div className="flex h-[calc(100vh-3.5rem)]">
        {mobileOpen && (
          <button
            type="button"
            aria-label="Menüyü kapat"
            className="fixed inset-0 z-40 bg-black/60 lg:hidden"
            style={{ top: "3.5rem" }}
            onClick={() => setMobileOpen(false)}
          />
        )}

        <AdminSidebar
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <AdminLayoutProvider openMobileMenu={() => setMobileOpen(true)}>
            {children}
          </AdminLayoutProvider>
        </div>
      </div>
    </AdminGuard>
  );
}

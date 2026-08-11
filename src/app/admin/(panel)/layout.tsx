"use client";

import { AdminGuard } from "@/components/auth/admin-guard";

export default function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <div className="flex h-full min-h-0 flex-col">{children}</div>
    </AdminGuard>
  );
}

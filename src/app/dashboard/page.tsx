"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { DashboardPlaceholder } from "@/components/dashboard/dashboard-placeholder";

export default function DashboardPage() {
  return (
    <AuthGuard allowedRoles={["user", "admin"]}>
      <DashboardPlaceholder />
    </AuthGuard>
  );
}

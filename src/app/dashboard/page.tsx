"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { UserDashboard } from "@/components/dashboard/user-dashboard";

export default function DashboardPage() {
  return (
    <AuthGuard allowedRoles={["user", "admin"]}>
      <UserDashboard />
    </AuthGuard>
  );
}

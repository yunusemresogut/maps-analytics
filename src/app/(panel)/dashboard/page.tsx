"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { UserDashboard } from "@/components/dashboard/user-dashboard";

export default function DashboardPage() {
  return (
    <AuthGuard routeKey="dashboard">
      <div className="scrollbar-themed h-full overflow-y-auto">
        <UserDashboard />
      </div>
    </AuthGuard>
  );
}

"use client";

import { AdminDashboard } from "@/components/admin/admin-dashboard";
import {
  AdminPageBody,
  AdminPageHeader,
} from "@/components/admin/admin-page-shell";
import { useT } from "@/contexts/i18n-context";

export default function AdminDashboardPage() {
  const t = useT();

  return (
    <>
      <AdminPageHeader
        title={t("adminPages.dashboardTitle")}
        description={t("adminPages.dashboardDescription")}
      />
      <AdminPageBody>
        <AdminDashboard />
      </AdminPageBody>
    </>
  );
}

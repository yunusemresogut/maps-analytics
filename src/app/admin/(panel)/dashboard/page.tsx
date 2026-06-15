"use client";

import { AdminDashboard } from "@/components/admin/admin-dashboard";
import {
  AdminPageBody,
  AdminPageHeader,
} from "@/components/admin/admin-page-shell";

export default function AdminDashboardPage() {
  return (
    <>
      <AdminPageHeader
        title="Admin Dashboard"
        description="Sistem özeti, kullanıcılar ve son aktiviteler"
      />
      <AdminPageBody>
        <AdminDashboard />
      </AdminPageBody>
    </>
  );
}

"use client";

import { AdminBudgetsPanel } from "@/components/admin/admin-budgets-panel";
import {
  AdminPageBody,
  AdminPageHeader,
} from "@/components/admin/admin-page-shell";

export default function AdminBudgetsPage() {
  return (
    <>
      <AdminPageHeader
        title="Bütçe Takibi"
        description="Şantiyelerin bütçe limitlerini belirleyin, harcamalarını takip edin ve aşımları kontrol edin"
      />
      <AdminPageBody>
        <AdminBudgetsPanel />
      </AdminPageBody>
    </>
  );
}

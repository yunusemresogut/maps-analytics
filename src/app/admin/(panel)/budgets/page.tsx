"use client";

import { AdminBudgetsPanel } from "@/components/admin/admin-budgets-panel";
import {
  AdminPageBody,
  AdminPageHeader,
} from "@/components/admin/admin-page-shell";
import { useT } from "@/contexts/i18n-context";

export default function AdminBudgetsPage() {
  const t = useT();

  return (
    <>
      <AdminPageHeader
        title={t("adminPages.budgetsTitle")}
        description={t("adminPages.budgetsDescription")}
      />
      <AdminPageBody>
        <AdminBudgetsPanel />
      </AdminPageBody>
    </>
  );
}

"use client";

import { AdminRegionsPanel } from "@/components/admin/admin-regions-panel";
import {
  AdminPageBody,
  AdminPageHeader,
} from "@/components/admin/admin-page-shell";
import { useT } from "@/contexts/i18n-context";

export default function AdminRegionsPage() {
  const t = useT();

  return (
    <>
      <AdminPageHeader
        title={t("adminPages.regionsTitle")}
        description={t("adminPages.regionsDescription")}
      />
      <AdminPageBody>
        <AdminRegionsPanel />
      </AdminPageBody>
    </>
  );
}

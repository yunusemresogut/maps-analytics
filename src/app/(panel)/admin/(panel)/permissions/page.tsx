"use client";

import { Suspense } from "react";
import { AdminPermissionsPanel } from "@/components/admin/admin-permissions-panel";
import {
  AdminPageBody,
  AdminPageHeader,
} from "@/components/admin/admin-page-shell";
import { useT } from "@/contexts/i18n-context";

export default function AdminPermissionsPage() {
  const t = useT();

  return (
    <>
      <AdminPageHeader
        title={t("adminPages.permissionsTitle")}
        description={t("adminPages.permissionsDescription")}
      />
      <AdminPageBody>
        <Suspense
          fallback={<p className="text-sm text-zinc-600">{t("common.loading")}</p>}
        >
          <AdminPermissionsPanel />
        </Suspense>
      </AdminPageBody>
    </>
  );
}

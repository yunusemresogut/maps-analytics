"use client";

import { AdminUsersPanel } from "@/components/admin/admin-users-panel";
import {
  AdminPageBody,
  AdminPageHeader,
} from "@/components/admin/admin-page-shell";
import { useT } from "@/contexts/i18n-context";

export default function AdminUsersPage() {
  const t = useT();

  return (
    <>
      <AdminPageHeader
        title={t("adminPages.usersTitle")}
        description={t("adminPages.usersDescription")}
      />
      <AdminPageBody>
        <AdminUsersPanel />
      </AdminPageBody>
    </>
  );
}

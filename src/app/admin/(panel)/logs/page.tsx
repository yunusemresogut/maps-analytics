"use client";

import { AdminLogsPanel } from "@/components/admin/admin-logs-panel";
import {
  AdminPageBody,
  AdminPageHeader,
} from "@/components/admin/admin-page-shell";
import { useT } from "@/contexts/i18n-context";

export default function AdminLogsPage() {
  const t = useT();

  return (
    <>
      <AdminPageHeader
        title={t("adminPages.logsTitle")}
        description={t("adminPages.logsDescription")}
      />
      <AdminPageBody>
        <AdminLogsPanel />
      </AdminPageBody>
    </>
  );
}

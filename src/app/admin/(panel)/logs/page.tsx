"use client";

import { AdminLogsPanel } from "@/components/admin/admin-logs-panel";
import {
  AdminPageBody,
  AdminPageHeader,
} from "@/components/admin/admin-page-shell";

export default function AdminLogsPage() {
  return (
    <>
      <AdminPageHeader
        title="Aktivite Logları"
        description="Sistemdeki kullanıcı, bölge ve konum işlemlerinin kaydı"
      />
      <AdminPageBody>
        <AdminLogsPanel />
      </AdminPageBody>
    </>
  );
}

"use client";

import { Suspense } from "react";
import { AdminPermissionsPanel } from "@/components/admin/admin-permissions-panel";
import {
  AdminPageBody,
  AdminPageHeader,
} from "@/components/admin/admin-page-shell";

export default function AdminPermissionsPage() {
  return (
    <>
      <AdminPageHeader
        title="Yetkiler"
        description="Kullanıcı bazlı yetki şablonları ve izin yönetimi"
      />
      <AdminPageBody>
        <Suspense fallback={<p className="text-sm text-zinc-600">Yükleniyor...</p>}>
          <AdminPermissionsPanel />
        </Suspense>
      </AdminPageBody>
    </>
  );
}

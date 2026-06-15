"use client";

import { AdminUsersPanel } from "@/components/admin/admin-users-panel";
import {
  AdminPageBody,
  AdminPageHeader,
} from "@/components/admin/admin-page-shell";

export default function AdminUsersPage() {
  return (
    <>
      <AdminPageHeader
        title="Kullanıcılar"
        description="Yeni kullanıcı ekleyin ve mevcut hesapları yönetin"
      />
      <AdminPageBody>
        <AdminUsersPanel />
      </AdminPageBody>
    </>
  );
}

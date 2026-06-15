"use client";

import { AdminRegionsPanel } from "@/components/admin/admin-regions-panel";
import {
  AdminPageBody,
  AdminPageHeader,
} from "@/components/admin/admin-page-shell";

export default function AdminRegionsPage() {
  return (
    <>
      <AdminPageHeader
        title="Bölgeler"
        description="Bölge tanımları ve şehir atamaları"
      />
      <AdminPageBody>
        <AdminRegionsPanel />
      </AdminPageBody>
    </>
  );
}

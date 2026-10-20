"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { DailySiteReportEditor } from "@/components/reports/daily-site-report-editor";

export default function NewDailySiteReportPage() {
  return (
    <AuthGuard routeKey="reports">
      <DailySiteReportEditor />
    </AuthGuard>
  );
}

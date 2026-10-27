"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/auth/auth-guard";
import { DailySiteReportEditor } from "@/components/reports/daily-site-report-editor";
import { PageLoader } from "@/components/ui/spinner";
import { useT } from "@/contexts/i18n-context";
import { fetchSiteReport } from "@/lib/site-reports";

type Loaded = Awaited<ReturnType<typeof fetchSiteReport>>;

function SavedReportContent({ id }: { id: string }) {
  const t = useT();
  const [state, setState] = useState<{ id: string; status: "ready"; data: Loaded } | { id: string; status: "error" } | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    fetchSiteReport(id)
      .then((data) => !cancelled && setState({ id, status: "ready", data }))
      .catch((err) => {
        console.error("Rapor yüklenemedi:", err);
        if (!cancelled) setState({ id, status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!state || state.id !== id) return <PageLoader />;

  if (state.status === "error" || !state.data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-zinc-500">
        {state.status === "error" ? t("reports.saved.loadFailed") : t("reports.saved.notFound")}
        <Link href="/reports" className="text-cyan-400 hover:underline">
          {t("reports.saved.backToReports")}
        </Link>
      </div>
    );
  }

  return <DailySiteReportEditor key={id} initial={state.data} />;
}

export default function SavedDailySiteReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGuard routeKey="reports">
      <SavedReportContent id={id} />
    </AuthGuard>
  );
}

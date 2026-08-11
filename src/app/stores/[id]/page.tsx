"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useStores } from "@/contexts/stores-context";
import { useT } from "@/contexts/i18n-context";
import { StoreViewFields } from "@/components/map/store-view-fields";
import { ApprovalSwitches } from "@/components/projects/approval-switches";
import { AuditLogSection } from "@/components/map/audit-log-section";
import { getProjectStatusLabel, projectStatusConfig } from "@/lib/project-status";
import { Badge } from "@/components/ui/badge";

function StorePageContent({ id }: { id: string }) {
  const { getStore } = useStores();
  const t = useT();
  const store = getStore(id);

  if (!store) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        {t("common.noData")}
      </div>
    );
  }

  const config = projectStatusConfig[store.projectStatus];

  return (
    <div className="scrollbar-themed h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/stores"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("nav.stores")}
        </Link>
        <Link
          href={`/map?store=${store.id}`}
          className="text-xs text-cyan-400 hover:underline"
        >
          {t("nav.map")}
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold text-zinc-100">{store.name}</h1>
        <Badge className={`${config.color} border border-current/20 bg-current/10`}>
          {getProjectStatusLabel(store.projectStatus, t)}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <StoreViewFields store={store} />
          <AuditLogSection audit={store} />
        </div>
        <ApprovalSwitches store={store} />
      </div>
    </div>
  );
}

export default function StoreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <AuthGuard routeKey="stores">
      <StorePageContent id={id} />
    </AuthGuard>
  );
}

"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useStores } from "@/contexts/stores-context";
import { useDb } from "@/contexts/db-context";
import { useT } from "@/contexts/i18n-context";
import { StoreViewFields } from "@/components/map/store-view-fields";
import { ApprovalSwitches } from "@/components/projects/approval-switches";
import { AuditLogSection } from "@/components/map/audit-log-section";
import { StoreDetailSections } from "@/components/stores/store-detail-sections";
import { StoreContractsList } from "@/components/contracts/store-contracts-list";
import { ContractIhaleWarning } from "@/components/contracts/contract-ihale-warning";
import {
  StoreOpeningAlert,
  storeOpeningBadgeLabel,
  storeOpeningIsOverdue,
} from "@/components/map/store-opening-alert";
import { getProjectStatusLabel, projectStatusConfig } from "@/lib/project-status";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";

function StorePageContent({ id }: { id: string }) {
  const { getStore } = useStores();
  const { contracts } = useDb();
  const { canEdit } = usePermissions("stores");
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
  const openingBadge = storeOpeningBadgeLabel(store);

  return (
    <div className="scrollbar-themed h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/stores"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("nav.stores")}
          </Link>
          <span className="text-zinc-700">·</span>
          <Link
            href={`/map?store=${store.id}`}
            className="text-sm text-cyan-400 hover:underline"
          >
            {t("nav.map")}
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-zinc-100">{store.name}</h1>
            <Badge
              className={`${config.color} border border-current/20 bg-current/10`}
            >
              {getProjectStatusLabel(store.projectStatus, t)}
            </Badge>
            {openingBadge && (
              <Badge
                className={cn(
                  "border border-current/20 bg-current/10",
                  storeOpeningIsOverdue(store)
                    ? "text-amber-400"
                    : "text-red-400"
                )}
              >
                {openingBadge}
              </Badge>
            )}
          </div>
          {canEdit && (
            <Link
              href={`/stores/${store.id}/edit`}
              className="inline-flex h-8 items-center gap-2 rounded-lg border border-zinc-700 px-3 text-xs text-zinc-300 hover:border-cyan-500/50 hover:text-cyan-300"
            >
              <Pencil className="h-3.5 w-3.5" />
              Düzenle
            </Link>
          )}
        </div>

        <div className="space-y-3">
          <StoreOpeningAlert store={store} />
          <ContractIhaleWarning store={store} contracts={contracts} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr] lg:items-start">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-zinc-500">
              Mağaza bilgileri
            </h2>
            <StoreViewFields store={store} />
            <div className="mt-5 border-t border-zinc-800/80 pt-4">
              <AuditLogSection audit={store} />
            </div>
          </div>

          <div className="lg:sticky lg:top-6">
            <ApprovalSwitches store={store} />
          </div>
        </div>

        <StoreContractsList store={store} />

        <StoreDetailSections store={store} />
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

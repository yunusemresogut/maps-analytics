"use client";

import Link from "next/link";
import { AlertTriangle, FileSignature } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { needsContractWarning } from "@/lib/module-finance";
import type { Contract, Store } from "@/types";

type ContractIhaleWarningProps = {
  store: Store;
  contracts: Contract[];
  compact?: boolean;
};

export function ContractIhaleWarning({
  store,
  contracts,
  compact = false,
}: ContractIhaleWarningProps) {
  const { canAdd } = usePermissions("contracts");

  if (!needsContractWarning(store.projectStatus, store.id, contracts)) {
    return null;
  }

  if (compact) {
    return (
      <Link
        href={canAdd ? `/contracts/new?storeId=${store.id}` : `/stores/${store.id}`}
        className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 hover:bg-amber-500/15"
      >
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">Sözleşme oluşturun</span>
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
      <div className="flex items-start gap-2 text-sm text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">
            {store.name} — ihale durumunda sözleşme gerekli
          </p>
          <p className="mt-0.5 text-xs text-amber-200/80">
            Bu mağaza için sözleşme oluşturulduğunda uyarı kalkar.
          </p>
        </div>
      </div>
      {canAdd ? (
        <Link
          href={`/contracts/new?storeId=${store.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/20 px-3 py-2 text-xs font-medium text-amber-100 hover:bg-amber-500/30"
        >
          <FileSignature className="h-3.5 w-3.5" />
          Sözleşme oluştur
        </Link>
      ) : (
        <span className="text-xs text-amber-200/60">
          Sözleşme oluşturma yetkiniz yok
        </span>
      )}
    </div>
  );
}

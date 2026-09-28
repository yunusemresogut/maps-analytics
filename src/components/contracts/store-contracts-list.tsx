"use client";

import Link from "next/link";
import { useDb } from "@/contexts/db-context";
import { usePermissions } from "@/hooks/use-permissions";
import { formatTry } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { Store } from "@/types";

const STATUS_TR: Record<string, string> = {
  draft: "Taslak",
  active: "Aktif",
  expired: "Süresi doldu",
  cancelled: "İptal",
  terminated: "Fesih",
  completed: "Tamamlandı",
};

export function StoreContractsList({ store }: { store: Store }) {
  const { contracts } = useDb();
  const { canAdd } = usePermissions("contracts");

  const linked = contracts.filter((c) => c.storeId === store.id);

  if (linked.length === 0 && store.projectStatus !== "ihale") {
    return null;
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-zinc-200">Sözleşmeler</h3>
        {canAdd && (
          <Link
            href={`/contracts/new?storeId=${store.id}`}
            className="text-xs text-cyan-400 hover:underline"
          >
            + Yeni
          </Link>
        )}
      </div>
      {linked.length === 0 ? (
        <p className="text-sm text-zinc-600">Henüz sözleşme yok</p>
      ) : (
        <ul className="space-y-2">
          {linked.map((c) => (
            <li key={c.id}>
              <Link
                href={`/contracts/${c.id}/edit`}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-sm hover:border-zinc-700",
                  c.status === "terminated" && "border-red-500/30 text-red-300/90"
                )}
              >
                <span className="min-w-0 truncate font-medium">
                  {c.code ? `${c.code} · ` : ""}
                  {c.title}
                </span>
                <span className="shrink-0 text-xs text-zinc-500">
                  {STATUS_TR[c.status] ?? c.status} · {formatTry(c.amount)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

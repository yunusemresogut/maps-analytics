"use client";

import { CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useStores } from "@/contexts/stores-context";
import { useT } from "@/contexts/i18n-context";
import { Switch } from "@/components/ui/switch";
import { allDisciplinesApproved, canApproveDiscipline } from "@/lib/roles";
import { canModule } from "@/lib/permissions";
import type {
  ApprovalDiscipline,
  ProjectApprovals,
  Store,
} from "@/types";
import { emptyApprovals } from "@/types";

type Props = {
  store: Store;
  compact?: boolean;
};

const DISCIPLINES: ApprovalDiscipline[] = [
  "architectural",
  "mechanical",
  "electrical",
];

/**
 * Disiplin onayları (mimari, mekanik, elektrik). Her disiplini ilgili mühendis
 * ya da yönetici onaylar; onaylayan kişi ve zaman veritabanında damgalanır.
 */
export function ApprovalSwitches({ store, compact }: Props) {
  const { user } = useAuth();
  const { updateStore } = useStores();
  const t = useT();

  if (!user) return null;

  const approvals: ProjectApprovals = store.approvals ?? emptyApprovals();
  const allApproved = allDisciplinesApproved(approvals);
  const hasApprovalEdit = canModule(user, "approvals", "edit");

  const canToggle = (discipline: ApprovalDiscipline) =>
    hasApprovalEdit && canApproveDiscipline(user.role, discipline);

  const toggle = (discipline: ApprovalDiscipline, checked: boolean) => {
    if (!canToggle(discipline)) return;
    const next: ProjectApprovals = {
      ...approvals,
      [discipline]: checked
        ? {
            approved: true,
            approvedBy: user.id,
            approvedByName: user.name,
            approvedAt: new Date().toISOString(),
          }
        : { approved: false },
    };
    updateStore(
      store.id,
      { approvals: next },
      { userId: user.id, userName: user.name }
    );
  };

  const labelFor = (d: ApprovalDiscipline) =>
    d === "architectural"
      ? t("approvals.architectural")
      : d === "mechanical"
        ? t("approvals.mechanical")
        : t("approvals.electrical");

  return (
    <div
      className={
        compact
          ? "space-y-2"
          : "rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3"
      }
    >
      {!compact && (
        <h3 className="text-sm font-medium text-zinc-200">
          {t("approvals.title")}
        </h3>
      )}
      {DISCIPLINES.map((d) => {
        const entry = approvals[d];
        const can = canToggle(d);
        return (
          <div
            key={d}
            className="flex items-start justify-between gap-3 rounded-lg border border-zinc-800/80 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm text-zinc-200">{labelFor(d)}</p>
              {entry.approved && entry.approvedByName && (
                <p className="mt-0.5 truncate text-xs text-zinc-500">
                  {t("approvals.approvedBy")}: {entry.approvedByName}
                </p>
              )}
            </div>
            <Switch
              checked={entry.approved}
              onChange={(v) => toggle(d, v)}
              disabled={!can}
              ariaLabel={labelFor(d)}
            />
          </div>
        );
      })}

      {allApproved && (
        <p className="flex items-center gap-1.5 pt-1 text-xs text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {t("site.approvals.allApproved")}
        </p>
      )}
    </div>
  );
}

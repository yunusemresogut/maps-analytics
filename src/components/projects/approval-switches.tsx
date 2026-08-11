"use client";

import { useAuth } from "@/contexts/auth-context";
import { useStores } from "@/contexts/stores-context";
import { useT } from "@/contexts/i18n-context";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  allDisciplinesApproved,
  canCloseStoreProject,
  canOpenStoreProject,
  canToggleDisciplineApproval,
} from "@/lib/roles";
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

export function ApprovalSwitches({ store, compact }: Props) {
  const { user } = useAuth();
  const { updateStore } = useStores();
  const t = useT();

  if (!user) return null;

  const approvals: ProjectApprovals = store.approvals ?? emptyApprovals();
  const disciplinesReady = allDisciplinesApproved(approvals);
  const hasApprovalEdit = canModule(user, "approvals", "edit");
  const canOpen =
    hasApprovalEdit && canOpenStoreProject(user.role, approvals);
  const canClose =
    hasApprovalEdit && canCloseStoreProject(user.role, approvals);

  const canToggle = (discipline: ApprovalDiscipline) =>
    hasApprovalEdit &&
    canToggleDisciplineApproval(
      user.role,
      discipline,
      approvals.projectOpened
    );

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

  const openProject = () => {
    if (!canOpen) return;
    const next: ProjectApprovals = {
      ...approvals,
      projectOpened: true,
      projectOpenedBy: user.id,
      projectOpenedByName: user.name,
      projectOpenedAt: new Date().toISOString(),
    };
    updateStore(
      store.id,
      { approvals: next, projectStatus: "santiye" },
      { userId: user.id, userName: user.name }
    );
  };

  const closeProject = () => {
    if (!canClose) return;
    const next: ProjectApprovals = {
      ...approvals,
      projectOpened: false,
      projectOpenedBy: undefined,
      projectOpenedByName: undefined,
      projectOpenedAt: undefined,
    };
    updateStore(
      store.id,
      { approvals: next, projectStatus: "proje" },
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
            />
          </div>
        );
      })}

      <div className="pt-1">
        {approvals.projectOpened ? (
          <div className="space-y-1.5">
            <p className="text-xs text-emerald-400">
              {t("approvals.projectOpened")}
              {approvals.projectOpenedByName
                ? ` — ${approvals.projectOpenedByName}`
                : ""}
            </p>
            {canClose && (
              <Button size="sm" variant="outline" onClick={closeProject}>
                {t("approvals.closeProject")}
              </Button>
            )}
            <p className="text-[11px] text-zinc-600">
              {canClose
                ? t("approvals.closeHint")
                : t("approvals.lockedHint")}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Button size="sm" onClick={openProject} disabled={!canOpen}>
              {t("approvals.openProject")}
            </Button>
            {!canOpen && (
              <p className="text-[11px] text-zinc-600">
                {!disciplinesReady
                  ? t("approvals.openRequiresApprovals")
                  : t("approvals.openNoPermission")}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

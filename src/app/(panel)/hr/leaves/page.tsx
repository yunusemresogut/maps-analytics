"use client";

import { inTurkish } from "@/i18n/runtime";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addMonths, format, parseISO } from "date-fns";
import { Ban, Check, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { formatDay, type SubmitState } from "@/components/hr/hr-modals";
import { LeaveDecisionModal, LeaveRequestModal } from "@/components/hr/leave-modals";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { useI18n, useT } from "@/contexts/i18n-context";
import { useMyPersonnelId } from "@/hooks/use-my-personnel";
import { usePermissions } from "@/hooks/use-permissions";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { logActivity } from "@/lib/activity-log";
import { fetchAllPersonnel, fetchPersonnel, formatDayCount, hrErrorMessage, isSunday, monthDays, type Personnel } from "@/lib/hr";
import {
  LEAVE_STATUS_LABELS,
  LEAVE_STATUS_STYLES,
  LEAVE_TYPE_LABELS,
  PENDING_STATUSES,
  canDecide,
  cancelLeaveRequest,
  createLeaveRequest,
  decideLeaveRequest,
  deleteLeaveRequest,
  fetchLeaveRequests,
  updateLeaveRequest,
  type LeaveRequest,
  type LeaveStatus,
  type LeaveType,
} from "@/lib/leaves";
import { cn } from "@/lib/utils";

type Tab = "approvals" | "mine" | "all" | "calendar";

const TYPE_DOT: Record<LeaveType, string> = {
  annual: "bg-sky-400",
  excused: "bg-indigo-400",
  sick: "bg-violet-400",
  unpaid: "bg-zinc-400",
};

type Dialog =
  | { kind: "request"; request: LeaveRequest | null }
  | { kind: "decide"; request: LeaveRequest; approve: boolean };

function LeavesContent() {
  const t = useT();
  const { user } = useAuth();
  const { canView, canAdd, canEdit, canDelete } = usePermissions("leaves");
  const { myPersonnelId, loaded: myLoaded } = useMyPersonnelId();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [statusFilter, setStatusFilter] = usePersistentState("leaves", "status", "all");
  const [tab, setTab] = useState<Tab | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => format(new Date(), "yyyy-MM"));

  const [requests, setRequests] = useState<LeaveRequest[] | null>(null);
  const [pending, setPending] = useState<LeaveRequest[]>([]);
  const [calendarRequests, setCalendarRequests] = useState<LeaveRequest[]>([]);
  const [people, setPeople] = useState<Personnel[]>([]);
  const [version, setVersion] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [submit, setSubmit] = useState<SubmitState>({ saving: false, error: "" });
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const flash = (tone: "success" | "error", text: string) => {
    setNotice({ tone, text });
    window.setTimeout(() => setNotice(null), 3500);
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchLeaveRequests({ from: `${year}-01-01`, to: `${year}-12-31` }),
      // Bekleyenler yıl seçiminden bağımsız
      fetchLeaveRequests({ statuses: PENDING_STATUSES }),
    ])
      .then(([yearRows, pendingRows]) => {
        if (cancelled) return;
        setRequests(yearRows);
        setPending(pendingRows);
        setLoadError(false);
      })
      .catch((err) => {
        console.error("İzinler yüklenemedi:", err);
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [year, version]);

  useEffect(() => {
    const days = monthDays(calendarMonth);
    let cancelled = false;
    fetchLeaveRequests({ from: days[0], to: days[days.length - 1] })
      .then((rows) => !cancelled && setCalendarRequests(rows.filter((r) => r.status === "approved" || PENDING_STATUSES.includes(r.status))))
      .catch((err) => console.error("İzin takvimi yüklenemedi:", err));
    return () => {
      cancelled = true;
    };
  }, [calendarMonth, version]);

  // Talep formundaki personel listesi: İK için tüm çalışanlar, personel için kendisi
  useEffect(() => {
    let cancelled = false;
    const load = canAdd
      ? fetchAllPersonnel().then((all) => all.filter((p) => p.state === "active"))
      : myPersonnelId
        ? fetchPersonnel(myPersonnelId).then((p) => (p ? [p] : []))
        : Promise.resolve([]);
    load.then((rows) => !cancelled && setPeople(rows)).catch((err) => console.error("Personel yüklenemedi:", err));
    return () => {
      cancelled = true;
    };
  }, [canAdd, myPersonnelId]);

  const toDecide = useMemo(
    () => (user ? pending.filter((r) => canDecide(r, user, canEdit)) : []),
    [pending, user, canEdit]
  );
  const isManager = useMemo(() => !!user && [...(requests ?? []), ...pending].some((r) => r.managerId === user.id), [requests, pending, user]);
  const mine = useMemo(() => (requests ?? []).filter((r) => r.personnelId === myPersonnelId), [requests, myPersonnelId]);

  const tabs = useMemo(() => {
    const list: { key: Tab; label: string; count?: number }[] = [];
    if (canEdit || isManager || toDecide.length > 0)
      list.push({ key: "approvals", label: t("hr.leaves.tabApprovals"), count: toDecide.length });
    if (myPersonnelId) list.push({ key: "mine", label: t("hr.leaves.tabMine") });
    if (canView || isManager) list.push({ key: "all", label: canView ? t("hr.leaves.tabAll") : t("hr.leaves.tabTeam") });
    if (canView || isManager) list.push({ key: "calendar", label: t("hr.leaves.tabCalendar") });
    return list;
  }, [canEdit, canView, isManager, toDecide.length, myPersonnelId, t]);

  const activeTab: Tab | undefined =
    tab && tabs.some((item) => item.key === tab) ? tab : (toDecide.length > 0 ? "approvals" : tabs[0]?.key);

  const log = useCallback(
    (action: string, message: string, request: Pick<LeaveRequest, "personnelId" | "personnelName">) => {
      if (!user) return;
      logActivity({
        category: "hr",
        action,
        message,
        actorId: user.id,
        actorName: user.name,
        targetId: request.personnelId,
        targetLabel: request.personnelName,
      });
    },
    [user]
  );

  const describe = (r: Pick<LeaveRequest, "type" | "startDate" | "endDate">) =>
    `${LEAVE_TYPE_LABELS[r.type]}, ${formatDay(r.startDate)} – ${formatDay(r.endDate)}`;

  const cancel = async (request: LeaveRequest) => {
    const approved = request.status === "approved";
    if (!confirm(approved ? t("hr.leaves.cancelApprovedConfirm") : t("hr.leaves.cancelConfirm"))) return;
    try {
      await cancelLeaveRequest(request.id);
      log("cancel", inTurkish(() => `İzin iptal edildi: ${request.personnelName} · ${describe(request)}`), request);
      setVersion((v) => v + 1);
      flash("success", t("hr.leaves.cancelled"));
    } catch (err) {
      flash("error", hrErrorMessage(err, t("hr.leaves.cancelFailed")));
    }
  };

  const remove = async (request: LeaveRequest) => {
    if (!confirm(t("hr.leaves.deleteConfirm"))) return;
    try {
      await deleteLeaveRequest(request.id);
      log("delete", inTurkish(() => `İzin kaydı silindi: ${request.personnelName} · ${describe(request)}`), request);
      setVersion((v) => v + 1);
    } catch (err) {
      flash("error", hrErrorMessage(err, t("hr.leaves.deleteFailed")));
    }
  };

  if (!canView && myLoaded && !myPersonnelId && tabs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-zinc-500">
        {t("hr.personnelList.notLinked")}
      </div>
    );
  }

  const canRequest = canAdd || !!myPersonnelId;
  const listFor = (key: Tab): LeaveRequest[] => {
    if (key === "approvals") return toDecide;
    const base = key === "mine" ? mine : (requests ?? []);
    return statusFilter === "all" ? base : base.filter((r) => r.status === statusFilter);
  };

  return (
    <div className="scrollbar-themed h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">{t("hr.leaves.title")}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t("hr.leaves.description")}</p>
        </div>
        {canRequest && people.length > 0 && (
          <Button
            onClick={() => {
              setSubmit({ saving: false, error: "" });
              setDialog({ kind: "request", request: null });
            }}
          >
            <Plus className="h-4 w-4" />
            {t("hr.leaveForm.newTitle")}
          </Button>
        )}
      </div>

      {tabs.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1 border-b border-zinc-800" role="tablist">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={activeTab === item.key}
              onClick={() => setTab(item.key)}
              className={cn(
                "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors",
                activeTab === item.key ? "border-cyan-400 text-cyan-300" : "border-transparent text-zinc-400 hover:text-zinc-200"
              )}
            >
              {item.label}
              {!!item.count && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-brand-on">
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {notice && (
        <p
          role={notice.tone === "error" ? "alert" : "status"}
          className={cn(
            "mb-4 rounded-lg border px-4 py-2.5 text-sm",
            notice.tone === "error" ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          )}
        >
          {notice.text}
        </p>
      )}
      {loadError && (
        <p role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
          {t("hr.leaves.loadFailed")}
        </p>
      )}

      {activeTab === "calendar" ? (
        <LeaveCalendar
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          requests={calendarRequests}
        />
      ) : (
        <>
          {activeTab !== "approvals" && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-auto min-w-[110px]" aria-label={t("hr.leaves.year")}>
                {[0, 1, 2, 3].map((offset) => {
                  const value = new Date().getFullYear() + 1 - offset;
                  return (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  );
                })}
              </Select>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto min-w-[160px]" aria-label={t("common.status")}>
                <option value="all">{t("hr.leaves.allStatuses")}</option>
                {Object.entries(LEAVE_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {requests === null && !loadError ? (
            <ul className="flex flex-col gap-2" aria-hidden>
              {Array.from({ length: 3 }, (_, i) => (
                <li key={i} className="h-[76px] animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/40" />
              ))}
            </ul>
          ) : activeTab && listFor(activeTab).length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-12 text-center text-sm text-zinc-500">
              {activeTab === "approvals" ? t("hr.leaves.noApprovals") : t("hr.leaves.empty")}
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {activeTab &&
                listFor(activeTab).map((request) => {
                  const decidable = !!user && canDecide(request, user, canEdit);
                  const own = request.personnelId === myPersonnelId;
                  const cancellable =
                    (canEdit && request.status !== "rejected" && request.status !== "cancelled") ||
                    (own && PENDING_STATUSES.includes(request.status));
                  const editable = canEdit && (request.status === "approved" || PENDING_STATUSES.includes(request.status));
                  return (
                    <li
                      key={request.id}
                      className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-3.5 lg:flex-row lg:items-center lg:gap-6"
                    >
                      <div className="min-w-0 lg:w-[26%] lg:shrink-0">
                        <Link href={`/hr/personnel/${request.personnelId}`} className="truncate text-sm font-medium text-zinc-100 hover:text-cyan-300">
                          {request.personnelName}
                        </Link>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                          <span className={cn("h-2 w-2 rounded-full", TYPE_DOT[request.type])} aria-hidden />
                          {LEAVE_TYPE_LABELS[request.type]}
                        </p>
                      </div>
                      <div className="min-w-0 lg:w-[24%]">
                        <p className="text-sm text-zinc-200">
                          {formatDay(request.startDate)} – {formatDay(request.endDate)}
                        </p>
                        <p className="text-xs text-zinc-500">{formatDayCount(request.dayCount)}</p>
                      </div>
                      <div className="min-w-0 flex-1 text-xs text-zinc-500">
                        <span className={cn("inline-flex rounded-full border px-2 py-0.5 font-medium", LEAVE_STATUS_STYLES[request.status])}>
                          {LEAVE_STATUS_LABELS[request.status]}
                        </span>
                        {request.reason && <p className="mt-1 line-clamp-2 text-zinc-400">{request.reason}</p>}
                        <DecisionTrail request={request} />
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        {decidable && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSubmit({ saving: false, error: "" });
                                setDialog({ kind: "decide", request, approve: true });
                              }}
                            >
                              <Check className="h-3.5 w-3.5" />
                              {t("hr.leaveDecision.approve")}
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => {
                                setSubmit({ saving: false, error: "" });
                                setDialog({ kind: "decide", request, approve: false });
                              }}
                            >
                              <X className="h-3.5 w-3.5" />
                              {t("hr.leaveDecision.reject")}
                            </Button>
                          </>
                        )}
                        {cancellable && (
                          <Button size="sm" variant="ghost" onClick={() => void cancel(request)}>
                            <Ban className="h-3.5 w-3.5" />
                            {t("common.cancel")}
                          </Button>
                        )}
                        {editable && (
                          <button
                            type="button"
                            aria-label={t("hr.leaves.correct")}
                            title={t("hr.leaves.correct")}
                            onClick={() => {
                              setSubmit({ saving: false, error: "" });
                              setDialog({ kind: "request", request });
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-100"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            aria-label={t("common.delete")}
                            title={t("common.delete")}
                            onClick={() => void remove(request)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
        </>
      )}

      {dialog?.kind === "request" && (
        <LeaveRequestModal
          people={dialog.request ? people.filter((p) => p.id === dialog.request!.personnelId) : people}
          request={dialog.request}
          state={submit}
          onClose={() => setDialog(null)}
          onSubmit={(input) => {
            setSubmit({ saving: true, error: "" });
            const existing = dialog.request;
            const task = existing ? updateLeaveRequest(existing.id, input) : createLeaveRequest(input);
            task
              .then(() => {
                const name = people.find((p) => p.id === input.personnelId)?.fullName ?? existing?.personnelName ?? "";
                log(existing ? "update" : "create", inTurkish(() => `İzin ${existing ? "düzeltildi" : "talebi oluşturuldu"}: ${name} · ${describe(input)}`), {
                  personnelId: input.personnelId,
                  personnelName: name,
                });
                setDialog(null);
                setVersion((v) => v + 1);
                flash("success", existing ? t("hr.leaves.corrected") : t("hr.personnelDetail.leaveCreated"));
                if (!existing) setTab(input.personnelId === myPersonnelId ? "mine" : "all");
              })
              .catch((err) => {
                console.error("İzin talebi kaydedilemedi:", err);
                setSubmit({ saving: false, error: hrErrorMessage(err, t("hr.personnelDetail.leaveSaveFailed")) });
              });
          }}
        />
      )}
      {dialog?.kind === "decide" && (
        <LeaveDecisionModal
          request={dialog.request}
          approve={dialog.approve}
          finalStep={canEdit}
          state={submit}
          onClose={() => setDialog(null)}
          onSubmit={(note) => {
            setSubmit({ saving: true, error: "" });
            decideLeaveRequest(dialog.request.id, dialog.approve, note)
              .then((status: LeaveStatus) => {
                log(
                  dialog.approve ? "approve" : "reject",
                  inTurkish(() => `İzin ${dialog.approve ? "onaylandı" : "reddedildi"}: ${dialog.request.personnelName} · ${describe(dialog.request)}`),
                  dialog.request
                );
                setDialog(null);
                setVersion((v) => v + 1);
                flash(
                  "success",
                  status === "approved"
                    ? t("hr.leaves.approved")
                    : status === "pending_hr"
                      ? t("hr.leaves.forwarded")
                      : t("hr.leaves.rejected")
                );
              })
              .catch((err) => {
                console.error("İzin kararı kaydedilemedi:", err);
                setSubmit({ saving: false, error: hrErrorMessage(err, t("hr.leaves.decisionFailed")) });
              });
          }}
        />
      )}
    </div>
  );
}

function DecisionTrail({ request }: { request: LeaveRequest }) {
  const t = useT();
  const steps = [
    request.managerDecidedByName && {
      who: request.managerDecidedByName,
      at: request.managerDecidedAt,
      note: request.managerNote,
      label: t("hr.leaves.trailManager"),
    },
    request.hrDecidedByName && { who: request.hrDecidedByName, at: request.hrDecidedAt, note: request.hrNote, label: t("hr.leaves.trailHr") },
  ].filter(Boolean) as { who: string; at?: string; note: string; label: string }[];
  if (steps.length === 0) return null;
  return (
    <div className="mt-1 space-y-0.5">
      {steps.map((step) => (
        <p key={step.label}>
          {step.label}: {step.who}
          {step.at && ` · ${formatDay(step.at.slice(0, 10))}`}
          {step.note && <span className="text-zinc-400"> — “{step.note}”</span>}
        </p>
      ))}
    </div>
  );
}

/** Ay içinde kimin hangi gün izinli olduğu; bekleyen talepler taralı görünür */
function LeaveCalendar({
  month,
  onMonthChange,
  requests,
}: {
  month: string;
  onMonthChange: (month: string) => void;
  requests: LeaveRequest[];
}) {
  const { t, locale, dateLocale } = useI18n();
  const days = monthDays(month);
  const rows = useMemo(() => {
    const byPerson = new Map<string, { name: string; requests: LeaveRequest[] }>();
    for (const request of requests) {
      const row = byPerson.get(request.personnelId) ?? { name: request.personnelName, requests: [] };
      row.requests.push(request);
      byPerson.set(request.personnelId, row);
    }
    return [...byPerson.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name, locale));
  }, [requests, locale]);
  const shift = (delta: number) => onMonthChange(format(addMonths(parseISO(`${month}-01`), delta), "yyyy-MM"));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900/60">
          <button type="button" aria-label={t("hr.common.previousMonth")} onClick={() => shift(-1)} className="p-2 text-zinc-400 hover:text-zinc-100">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[130px] text-center text-sm font-medium capitalize text-zinc-100">
            {format(parseISO(`${month}-01`), "MMMM yyyy", { locale: dateLocale })}
          </span>
          <button type="button" aria-label={t("hr.common.nextMonth")} onClick={() => shift(1)} className="p-2 text-zinc-400 hover:text-zinc-100">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
          {(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map((type) => (
            <span key={type} className="inline-flex items-center gap-1.5">
              <span className={cn("h-2.5 w-2.5 rounded-sm", TYPE_DOT[type])} aria-hidden />
              {LEAVE_TYPE_LABELS[type]}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-zinc-400" aria-hidden />
            {t("hr.personnelDetail.pending")}
          </span>
        </div>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-12 text-center text-sm text-zinc-500">{t("hr.leaves.calendarEmpty")}</div>
      ) : (
        <div className="scrollbar-themed overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-950/80 text-zinc-500">
                <th className="sticky left-0 z-10 min-w-[180px] border-b border-r border-zinc-800 bg-zinc-950 px-3 py-2 text-left font-medium">
                  {t("hr.leaveForm.personnel")}
                </th>
                {days.map((day) => (
                  <th key={day} className={cn("min-w-[26px] border-b border-zinc-800 py-2 text-center font-medium tabular-nums", isSunday(day) && "bg-zinc-900/80")}>
                    {Number(day.slice(8))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([personnelId, row]) => (
                <tr key={personnelId}>
                  <th scope="row" className="sticky left-0 z-10 border-b border-r border-zinc-800 bg-zinc-950 px-3 py-1.5 text-left font-normal">
                    <Link href={`/hr/personnel/${personnelId}`} className="truncate text-sm text-zinc-200 hover:text-cyan-300">
                      {row.name}
                    </Link>
                  </th>
                  {days.map((day) => {
                    const request = row.requests.find((r) => r.startDate <= day && r.endDate >= day);
                    return (
                      <td key={day} className={cn("border-b border-zinc-800/70 p-0.5", isSunday(day) && "bg-zinc-900/60")}>
                        {request && (
                          <span
                            title={`${LEAVE_TYPE_LABELS[request.type]} · ${LEAVE_STATUS_LABELS[request.status]}`}
                            className={cn(
                              "block h-5 rounded-sm",
                              request.status === "approved"
                                ? cn(TYPE_DOT[request.type], "opacity-70")
                                : "border border-dashed border-zinc-400/70 bg-zinc-700/30"
                            )}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function LeavesPage() {
  return (
    <AuthGuard routeKey="leaves">
      <LeavesContent />
    </AuthGuard>
  );
}

"use client";

import { useId, useMemo, useState } from "react";
import { ChevronDown, CalendarRange, Edit2, List, Plus, Trash2 } from "lucide-react";
import {
  addMonths,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  endOfMonth,
  format,
  isValid,
  parseISO,
  startOfMonth,
} from "date-fns";
import { TruncateWithTooltip } from "@/components/ui/truncate-with-tooltip";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { BulkSelectionBar, SelectCheckbox } from "@/components/ui/row-selection";
import { TablePagination } from "@/components/modules/module-table";
import { useStoreData } from "@/contexts/store-data-context";
import { useDb } from "@/contexts/db-context";
import { useServerTable } from "@/hooks/use-server-table";
import { useStoreWorkPlan } from "@/hooks/use-store-work-plan";
import type { SortState } from "@/hooks/use-table-state";
import {
  EMPTY_SUMMARY,
  WORK_PLAN_SEARCH_COLUMNS,
  WORK_PLAN_SOURCE,
  fetchMatchingIds,
  mapWorkPlanFromDb,
} from "@/lib/store-details";
import { useRowSelection } from "@/hooks/use-row-selection";
import { cn } from "@/lib/utils";
import { WorkPlanImportMenu } from "@/components/map/work-plan-import-menu";
import { WorkPlanFormModal, type WorkPlanFormValues } from "@/components/map/work-plan-form-modal";
import { responsibleLabel, type ParsedWorkPlanRow } from "@/lib/excel-work-plan";
import type { StoreWorkPlanItem, WorkPlanStatus } from "@/types";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { useI18n, useT } from "@/contexts/i18n-context";
import { getDateLocale, localizedRecord } from "@/i18n/runtime";

type WorkPlanPanelProps = {
  storeId: string;
  isEditing: boolean;
  onDelete: (ids: string[]) => Promise<void>;
  onImport: (rows: ParsedWorkPlanRow[]) => void;
};

const SORT_COLUMNS = { seq: "seq" };
const INITIAL_SORT: SortState<"seq"> = { key: "seq", direction: "asc" };

const statusLabels: Record<WorkPlanStatus, string> = localizedRecord({
  yapilacak: "site.workPlan.status.yapilacak",
  devam_ediyor: "site.workPlan.status.devam_ediyor",
  tamamlandi: "site.workPlan.status.tamamlandi",
});

const statusColors: Record<WorkPlanStatus, string> = {
  yapilacak: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  devam_ediyor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  tamamlandi: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

function formatDateSafe(dateStr: string) {
  if (!dateStr) return "-";
  const date = parseISO(dateStr);
  return isValid(date) ? format(date, "d MMM yyyy", { locale: getDateLocale() }) : dateStr;
}

function WorkPlanGantt({ items }: { items: StoreWorkPlanItem[] }) {
  const { t, dateLocale } = useI18n();
  const scheduled = items.filter((item) => {
    if (!item.startDate) return false;
    const start = parseISO(item.startDate);
    return isValid(start);
  });

  if (scheduled.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-zinc-500">
        {t("site.workPlan.ganttEmpty")}
      </div>
    );
  }

  const startTimes = scheduled.map((item) => parseISO(item.startDate).getTime());
  const endTimes = scheduled.map((item) => {
    const end = item.endDate ? parseISO(item.endDate) : parseISO(item.startDate);
    return (isValid(end) ? end : parseISO(item.startDate)).getTime();
  });
  const rangeStart = startOfMonth(new Date(Math.min(...startTimes)));
  const rangeEnd = endOfMonth(new Date(Math.max(...endTimes)));
  const totalDays = differenceInCalendarDays(rangeEnd, rangeStart) + 1;
  const monthCount = differenceInCalendarMonths(rangeEnd, rangeStart) + 1;
  const timelineWidth = Math.max(720, monthCount * 128);
  const months = Array.from({ length: monthCount }, (_, index) => addMonths(rangeStart, index));
  const rowIndexById = new Map(scheduled.map((item, index) => [item.id, index]));
  const dependencyLines = scheduled.flatMap((item, successorIndex) =>
    item.predecessors.flatMap((dependency) => {
      const predecessorIndex = rowIndexById.get(dependency.predecessorId);
      const predecessor = scheduled.find((candidate) => candidate.id === dependency.predecessorId);
      if (predecessorIndex === undefined || !predecessor) return [];

      const predecessorStart = parseISO(predecessor.startDate);
      const predecessorEnd = predecessor.endDate ? parseISO(predecessor.endDate) : predecessorStart;
      const successorStart = parseISO(item.startDate);
      const successorEnd = item.endDate ? parseISO(item.endDate) : successorStart;
      const sourceAtEnd = dependency.type === "FS" || dependency.type === "FF";
      const targetAtEnd = dependency.type === "FF" || dependency.type === "SF";
      const sourceDate = sourceAtEnd ? predecessorEnd : predecessorStart;
      const targetDate = targetAtEnd ? successorEnd : successorStart;
      const sourceDay = differenceInCalendarDays(sourceDate, rangeStart) + (sourceAtEnd ? 1 : 0);
      const targetDay = differenceInCalendarDays(targetDate, rangeStart) + (targetAtEnd ? 1 : 0) + dependency.lagHours / 24;
      return [{
        key: `${predecessor.id}-${item.id}-${dependency.type}`,
        x1: (sourceDay / totalDays) * timelineWidth,
        y1: predecessorIndex * 44 + 22,
        x2: (targetDay / totalDays) * timelineWidth,
        y2: successorIndex * 44 + 22,
        label: t("site.workPlan.dependencyLabel", { type: dependency.type, hours: dependency.lagHours }),
      }];
    })
  );
  const monthOffset = (month: Date) =>
    differenceInCalendarDays(month, rangeStart) / totalDays;
  const monthWidth = (month: Date) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    return (differenceInCalendarDays(monthEnd, monthStart) + 1) / totalDays;
  };

  return (
    <div className="scrollbar-themed overflow-x-auto">
      <div className="min-w-max">
        <div className="flex border-b border-zinc-800 bg-zinc-950/60">
          <div className="sticky left-0 z-10 w-64 shrink-0 border-r border-zinc-800 bg-zinc-950 px-4 py-3 text-xs font-medium text-zinc-500">
            {t("site.workPlan.item")}
          </div>
          <div className="flex shrink-0" style={{ width: timelineWidth }}>
            {months.map((month) => (
              <div
                key={month.toISOString()}
                className="border-r border-zinc-800 px-2 py-3 text-xs font-medium text-zinc-400"
                style={{ width: `${monthWidth(month) * timelineWidth}px` }}
              >
                {format(month, "MMM yyyy", { locale: dateLocale })}
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
        <svg
          className="pointer-events-none absolute left-64 top-0 z-0 overflow-visible text-amber-500"
          width={timelineWidth}
          height={scheduled.length * 44}
          aria-label={t("site.workPlan.dependencies")}
        >
          <defs>
            <marker id="gantt-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 8 4 L 0 8 z" fill="currentColor" />
            </marker>
          </defs>
          {dependencyLines.map((line) => {
            const bendX = line.x1 + (line.x2 - line.x1) / 2;
            return (
              <path
                key={line.key}
                d={`M ${line.x1} ${line.y1} H ${bendX} V ${line.y2} H ${line.x2}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                markerEnd="url(#gantt-arrow)"
              >
                <title>{line.label}</title>
              </path>
            );
          })}
        </svg>
        <div className="relative z-[1]">
        {scheduled.map((item) => {
          const startDate = parseISO(item.startDate);
          const rawEnd = item.endDate ? parseISO(item.endDate) : startDate;
          const endDate = isValid(rawEnd) ? rawEnd : startDate;
          const offset = Math.max(0, differenceInCalendarDays(startDate, rangeStart));
          const duration = Math.max(1, differenceInCalendarDays(endDate, startDate) + 1);
          const status = (item.status as WorkPlanStatus) || "yapilacak";
          const barColor =
            status === "tamamlandi"
              ? "bg-emerald-500"
              : status === "devam_ediyor"
                ? "bg-amber-500"
                : "bg-sky-500";

          return (
            <div key={item.id} className="flex border-b border-zinc-800/70">
              <div className="sticky left-0 z-[1] flex h-11 w-64 shrink-0 items-center justify-between gap-3 border-r border-zinc-800 bg-zinc-950 px-4 py-2">
                <div className="min-w-0">
                  <span className="block truncate text-xs font-medium text-zinc-300" title={item.description}>
                    {item.description}
                  </span>
                  <span className="block truncate text-[10px] text-zinc-600">
                    {[item.activityCode, item.wbsCode].filter(Boolean).join(" · ") || format(startDate, "d MMM", { locale: dateLocale })}
                  </span>
                </div>
              </div>
              <div className="relative h-11 shrink-0" style={{ width: timelineWidth }}>
                {months.map((month) => (
                  <span
                    key={month.toISOString()}
                    className="absolute inset-y-0 border-l border-zinc-800/60"
                    style={{ left: `${monthOffset(month) * 100}%` }}
                    aria-hidden
                  />
                ))}
                <div
                  className="absolute top-2.5 h-6 min-w-2 overflow-hidden rounded bg-zinc-700/70 ring-1 ring-inset ring-zinc-600/30"
                  style={{
                    left: `${(offset / totalDays) * 100}%`,
                    width: `${(duration / totalDays) * 100}%`,
                  }}
                  title={`${item.description}: ${formatDateSafe(item.startDate)} - ${formatDateSafe(item.endDate)} · ${item.percentComplete}%`}
                >
                  <div className={`h-full ${barColor}`} style={{ width: `${item.percentComplete}%` }} />
                  <span className="absolute inset-y-0 left-1 flex items-center truncate text-[10px] font-semibold text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.55)]">
                    {item.percentComplete}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        </div>
        </div>
      </div>
      {scheduled.length < items.length && (
        <p className="border-t border-zinc-800 px-4 py-2 text-xs text-zinc-500">
          {t(items.length - scheduled.length === 1 ? "site.workPlan.unscheduledOne" : "site.workPlan.unscheduledOther", {
            count: items.length - scheduled.length,
          })}
        </p>
      )}
    </div>
  );
}

export function WorkPlanPanel({
  storeId,
  isEditing,
  onDelete,
  onImport,
}: WorkPlanPanelProps) {
  const t = useT();
  const { addWorkPlanItem, updateWorkPlanItem, getDetailVersion } = useStoreData();
  const { storeSummaries } = useDb();
  const summary = storeSummaries[storeId] ?? EMPTY_SUMMARY;
  const version = getDetailVersion(storeId);
  const [viewMode, setViewMode] = usePersistentState<"table" | "gantt">(`work-plan:${storeId}`, "viewMode", "table");
  const [modal, setModal] = useState<{ key: number; item: StoreWorkPlanItem | null } | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [query, setQuery] = usePersistentState(`work-plan:${storeId}`, "query", "");
  const [deleting, setDeleting] = useState(false);
  const bodyId = useId();

  // Tablo: sunucuda aranır ve sayfalanır; sıra her zaman eklenme sırasıdır (seq)
  const filters = useMemo(() => ({ store_id: storeId }), [storeId]);
  const table = useServerTable<StoreWorkPlanItem, "seq">({
    memoryKey: `work-plan:${storeId}`,
    source: WORK_PLAN_SOURCE,
    mapRow: mapWorkPlanFromDb,
    searchColumns: WORK_PLAN_SEARCH_COLUMNS,
    search: query,
    filters,
    sortColumns: SORT_COLUMNS,
    initialSort: INITIAL_SORT,
    refreshKey: version,
  });

  // Gantt ve öncül seçimi tüm kalemlere ihtiyaç duyar; yalnızca açıkken çekilir
  const fullPlan = useStoreWorkPlan(
    storeId,
    expanded && (viewMode === "gantt" || modal !== null),
    version
  );

  const pageIds = useMemo(() => table.pageItems.map((item) => item.id), [table.pageItems]);
  const selection = useRowSelection({
    pageIds,
    totalCount: table.totalItems,
    resetKey: `${storeId}|${table.appliedSearch}`,
  });

  const handleBulkDelete = async () => {
    const count = selection.selectedCount;
    if (count === 0 || !confirm(t(count === 1 ? "site.workPlan.confirmDeleteOne" : "site.workPlan.confirmDeleteOther", { count }))) return;
    setDeleting(true);
    try {
      const ids = selection.allMatching
        ? await fetchMatchingIds({
            source: WORK_PLAN_SOURCE,
            filters,
            searchColumns: WORK_PLAN_SEARCH_COLUMNS,
            search: table.appliedSearch,
          })
        : [...selection.selected];
      await onDelete(ids);
      selection.clear();
    } catch (err) {
      console.error("Toplu iş kalemi silme başarısız:", err);
    } finally {
      setDeleting(false);
    }
  };

  const openModal = (item: StoreWorkPlanItem | null) =>
    setModal({ key: Date.now(), item });

  const handleSubmit = (values: WorkPlanFormValues) => {
    if (modal?.item) updateWorkPlanItem(storeId, modal.item.id, values);
    else addWorkPlanItem(storeId, values);
    setModal(null);
  };

  return (
    <section className="flex w-full min-w-0 flex-col rounded-lg border border-zinc-800 bg-zinc-900/40">
      <div
        className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 ${expanded ? "border-b border-zinc-800" : ""}`}
      >
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          aria-controls={bodyId}
          className="-mx-1.5 -my-1 flex items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-zinc-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
        >
          <ChevronDown
            className={`h-4 w-4 text-zinc-500 transition-transform ${expanded ? "" : "-rotate-90"}`}
            aria-hidden
          />
          <CalendarRange className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-medium text-zinc-200">{t("site.workPlan.title")}</span>
          <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-xs text-emerald-300">
            {summary.workPlanCount}
          </span>
        </button>
        <div className="flex items-center gap-2">
          <div className={`${expanded ? "inline-flex" : "hidden"} rounded-md border border-zinc-800 bg-zinc-950/50 p-0.5`} role="group" aria-label={t("site.workPlan.viewLabel")}>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              aria-pressed={viewMode === "table"}
              className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs ${viewMode === "table" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              <List className="h-3.5 w-3.5" />
              {t("site.workPlan.table")}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("gantt")}
              aria-pressed={viewMode === "gantt"}
              className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs ${viewMode === "gantt" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              {t("site.workPlan.gantt")}
            </button>
          </div>
          {isEditing && (
            <>
              <WorkPlanImportMenu existingCount={summary.workPlanCount} onImport={onImport} />
              <Button size="sm" onClick={() => openModal(null)}>
                <Plus className="h-3.5 w-3.5" />
                {t("site.workPlan.add")}
              </Button>
            </>
          )}
        </div>
      </div>

      <div id={bodyId} hidden={!expanded}>
        {viewMode === "table" ? (
          <>
            {summary.workPlanCount > 0 && (
              <div className="border-b border-zinc-800 px-4 py-3">
                <SearchInput
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("site.workPlan.searchPlaceholder")}
                  aria-label={t("site.workPlan.searchLabel")}
                  containerClassName="max-w-sm"
                  className="h-9"
                />
              </div>
            )}
            {isEditing && (
              <BulkSelectionBar
                selectedCount={selection.selectedCount}
                totalCount={table.totalItems}
                isPageSelected={selection.isPageSelected}
                isAllSelected={selection.isAllSelected}
                onSelectAll={selection.selectAll}
                onClear={selection.clear}
                onDelete={handleBulkDelete}
                busy={deleting}
              />
            )}
            <div className="min-w-0 overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                  <tr>
                    {isEditing && (
                      <th className="w-10 py-3 pl-4">
                        <SelectCheckbox
                          checked={selection.isPageSelected}
                          indeterminate={selection.isPagePartiallySelected}
                          onChange={selection.togglePage}
                          label={t("site.workPlan.selectPage")}
                        />
                      </th>
                    )}
                    <th className="px-4 py-3 font-medium">{t("site.workPlan.item")}</th>
                    <th className="px-4 py-3 font-medium">{t("site.workPlan.activityCode")}</th>
                    <th className="px-4 py-3 font-medium">{t("site.workPlan.start")}</th>
                    <th className="px-4 py-3 font-medium">{t("site.workPlan.end")}</th>
                    <th className="px-4 py-3 font-medium">{t("site.workPlan.progress")}</th>
                    <th className="px-4 py-3 font-medium">{t("site.workPlan.responsible")}</th>
                    <th className="px-4 py-3 font-medium">{t("site.workPlan.statusColumn")}</th>
                    {isEditing && <th className="w-20 px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {table.totalItems === 0 ? (
                    <tr>
                      <td
                        colSpan={isEditing ? 9 : 7}
                        className="px-4 py-10 text-center text-sm text-zinc-500"
                      >
                        {table.isLoading
                          ? t("site.workPlan.loading")
                          : summary.workPlanCount === 0
                            ? t("site.workPlan.empty")
                            : t("site.workPlan.noMatch")}
                      </td>
                    </tr>
                  ) : (
                    table.pageItems.map((item) => {
                      const currentStatus = (item.status as WorkPlanStatus) || "yapilacak";
                      return (
                        <tr
                          key={item.id}
                          className={cn(
                            "text-zinc-300 hover:bg-zinc-900/50",
                            selection.isSelected(item.id) && "bg-cyan-500/5"
                          )}
                        >
                          {isEditing && (
                            <td className="w-10 py-3 pl-4">
                              <SelectCheckbox
                                checked={selection.isSelected(item.id)}
                                onChange={() => selection.toggle(item.id)}
                                label={t("site.workPlan.selectRow", { name: item.description })}
                              />
                            </td>
                          )}
                          <td className="max-w-[440px] px-4 py-3 font-medium text-zinc-100">
                            <div><TruncateWithTooltip text={item.description} /></div>
                            {item.wbsCode && <span className="mt-1 block text-[10px] font-normal text-zinc-500">WBS {item.wbsCode}</span>}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-400">
                            {item.activityCode ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-zinc-400">
                            {formatDateSafe(item.startDate)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-zinc-400">
                            {formatDateSafe(item.endDate)}
                          </td>
                          <td className="min-w-36 px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-zinc-800">
                                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${item.percentComplete}%` }} />
                              </div>
                              <span className="w-10 text-right text-xs tabular-nums text-zinc-400">{item.percentComplete}%</span>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-zinc-400">
                            {item.responsible ? responsibleLabel(item.responsible) : "-"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded border px-2 py-1 text-xs font-medium ${statusColors[currentStatus]}`}
                            >
                              {statusLabels[currentStatus] ?? currentStatus}
                            </span>
                          </td>
                          {isEditing && (
                            <td className="whitespace-nowrap px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => openModal(item)}
                                  className="text-zinc-500 hover:text-cyan-400"
                                  aria-label={t("common.edit")}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void onDelete([item.id])}
                                  className="text-zinc-500 hover:text-red-400"
                                  aria-label={t("common.delete")}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {table.totalItems > 0 && (
              <div className="border-t border-zinc-800 px-3 py-2">
                <TablePagination
                  page={table.page}
                  totalPages={table.totalPages}
                  totalItems={table.totalItems}
                  rangeStart={table.rangeStart}
                  rangeEnd={table.rangeEnd}
                  onPageChange={table.setPage}
                  pageSize={table.pageSize}
                  onPageSizeChange={table.setPageSize}
                />
              </div>
            )}
          </>
        ) : (
          fullPlan.isLoading ? (
            <p className="px-4 py-10 text-center text-sm text-zinc-500">{t("site.workPlan.loading")}</p>
          ) : (
            <WorkPlanGantt items={fullPlan.items} />
          )
        )}
      </div>

      {modal && (
        <WorkPlanFormModal
          key={modal.key}
          open
          item={modal.item}
          candidates={fullPlan.items}
          onClose={() => setModal(null)}
          onSubmit={handleSubmit}
        />
      )}
    </section>
  );
}

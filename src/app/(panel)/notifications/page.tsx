"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Bell, RotateCcw, Settings, X } from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { TablePagination } from "@/components/modules/module-table";
import { useI18n } from "@/contexts/i18n-context";
import { useNotifications } from "@/contexts/notifications-context";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useTableState } from "@/hooks/use-table-state";
import { NOTIFICATION_META } from "@/lib/notification-meta";
import { notificationHref } from "@/lib/notifications";
import type { AppNotification } from "@/types";

type NotifItem = AppNotification & { dismissed: boolean };
type SortKey = "createdAt" | "type" | "dismissed";

function NotificationsContent() {
  const router = useRouter();
  const { t, dateLocale } = useI18n();
  const { allNotifications, dismissedIds, dismiss, undismiss, dismissAll } =
    useNotifications();

  const items = useMemo(() => {
    const dismissed = new Set(dismissedIds);
    return allNotifications.map((n) => ({
      ...n,
      dismissed: dismissed.has(n.id),
    }));
  }, [allNotifications, dismissedIds]);

  const getSortValue = useCallback((item: NotifItem, key: SortKey) => {
    if (key === "dismissed") return item.dismissed;
    if (key === "type") return NOTIFICATION_META[item.type].label;
    return item.createdAt;
  }, []);

  const table = useTableState<NotifItem, SortKey>({
    memoryKey: "notifications",
    items,
    initialSort: { key: "createdAt", direction: "desc" },
    getSortValue,
    resetKey: `${items.length}|${dismissedIds.join(",")}`,
  });

  const activeCount = items.filter((n) => !n.dismissed).length;

  const handleOpen = (notif: AppNotification) => {
    dismiss(notif.id);
    router.push(notificationHref(notif));
  };

  const handleDismissAll = () => {
    dismissAll(items.filter((n) => !n.dismissed).map((n) => n.id));
  };

  const onSortKeyChange = (key: SortKey) => {
    if (table.sort.key !== key) {
      table.setSortKey(key);
    }
  };

  return (
    <div className="scrollbar-themed h-[calc(100vh-3.5rem)] overflow-y-auto">
      <div className="mx-auto max-w-3xl p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/map"
              className="mb-3 inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("notFound.goHome")}
            </Link>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-zinc-100">
              <Bell className="h-6 w-6 text-cyan-400" />
              {t("notifications.title")}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {t("shell.notificationsPage.summary", { active: activeCount, total: items.length })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={table.sort.key}
              onChange={(e) => onSortKeyChange(e.target.value as SortKey)}
              className="h-9 w-auto min-w-[150px]"
            >
              <option value="createdAt">{t("shell.notificationsPage.sortByDate")}</option>
              <option value="type">{t("shell.notificationsPage.sortByType")}</option>
              <option value="dismissed">{t("shell.notificationsPage.sortByRead")}</option>
            </Select>
            <Link
              href="/settings/notifications"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
            >
              <Settings className="h-3.5 w-3.5" />
              {t("shell.notificationsPage.settings")}
            </Link>
            {activeCount > 0 && (
              <Button size="sm" variant="outline" onClick={handleDismissAll}>
                {t("shell.notificationsPage.markAllRead")}
              </Button>
            )}
          </div>
        </div>

        <ul className="space-y-2">
          {table.totalItems === 0 && (
            <li className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-12 text-center text-sm text-zinc-500">
              {t("shell.notificationsPage.empty")}
            </li>
          )}
          {table.pageItems.map((notif) => {
            const { icon: Icon, color, label } = NOTIFICATION_META[notif.type];
            return (
              <li
                key={notif.id}
                className={`rounded-xl border bg-zinc-900/50 p-4 transition-colors ${
                  notif.dismissed
                    ? "border-zinc-800/60 opacity-60"
                    : "border-zinc-700/60"
                }`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${color}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-xs font-medium ${color}`}>
                        {label}
                      </span>
                      {notif.dismissed && (
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
                          {t("shell.notificationsPage.read")}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-zinc-200">{notif.message}</p>
                    <p className="mt-1 text-xs text-zinc-600">
                      {notif.storeName ? `${notif.storeName} · ` : ""}
                      {format(parseISO(notif.createdAt), "d MMM yyyy, HH:mm", {
                        locale: dateLocale,
                      })}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => handleOpen(notif)}>
                        {notif.actionLabel ?? t("shell.notificationsPage.openOnMap")}
                      </Button>
                      {notif.dismissed ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => undismiss(notif.id)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          {t("shell.notificationsPage.undo")}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => dismiss(notif.id)}
                        >
                          <X className="h-3.5 w-3.5" />
                          {t("common.close")}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/40">
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
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <AuthGuard>
      <NotificationsContent />
    </AuthGuard>
  );
}

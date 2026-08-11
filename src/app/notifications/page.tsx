"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Clock,
  RotateCcw,
  ShoppingCart,
  X,
} from "lucide-react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { TablePagination } from "@/components/modules/module-table";
import { useNotifications } from "@/contexts/notifications-context";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useTableState } from "@/hooks/use-table-state";
import type { AppNotification } from "@/types";

const TYPE_ICON = {
  opening_soon: AlertTriangle,
  opening_overdue: Clock,
  ihale_order_reminder: ShoppingCart,
};

const TYPE_COLOR = {
  opening_soon: "text-red-400",
  opening_overdue: "text-amber-400",
  ihale_order_reminder: "text-violet-400",
};

const TYPE_LABEL = {
  opening_soon: "Yakında Açılış",
  opening_overdue: "Açılış Gecikmesi",
  ihale_order_reminder: "İhale Hatırlatması",
};

type NotifItem = AppNotification & { dismissed: boolean };
type SortKey = "createdAt" | "type" | "dismissed";

function NotificationsContent() {
  const router = useRouter();
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
    if (key === "type") return TYPE_LABEL[item.type] ?? item.type;
    return item.createdAt;
  }, []);

  const table = useTableState<NotifItem, SortKey>({
    items,
    initialSort: { key: "createdAt", direction: "desc" },
    getSortValue,
    resetKey: `${items.length}|${dismissedIds.join(",")}`,
  });

  const activeCount = items.filter((n) => !n.dismissed).length;

  const handleOpen = (notif: AppNotification) => {
    dismiss(notif.id);
    router.push(`/map?store=${notif.storeId}`);
  };

  const handleDismissAll = () => {
    dismissAll(items.filter((n) => !n.dismissed).map((n) => n.id));
  };

  const onSortKeyChange = (key: SortKey) => {
    if (table.sort.key !== key) {
      table.toggleSort(key);
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
              Haritaya dön
            </Link>
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-zinc-100">
              <Bell className="h-6 w-6 text-cyan-400" />
              Bildirimler
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {activeCount} aktif · {items.length} toplam
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={table.sort.key}
              onChange={(e) => onSortKeyChange(e.target.value as SortKey)}
              className="h-9 w-auto min-w-[150px]"
            >
              <option value="createdAt">Tarihe göre</option>
              <option value="type">Tipe göre</option>
              <option value="dismissed">Okunma durumuna göre</option>
            </Select>
            {activeCount > 0 && (
              <Button size="sm" variant="outline" onClick={handleDismissAll}>
                Tümünü okundu işaretle
              </Button>
            )}
          </div>
        </div>

        <ul className="space-y-2">
          {table.totalItems === 0 && (
            <li className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-12 text-center text-sm text-zinc-500">
              Henüz bildirim yok
            </li>
          )}
          {table.pageItems.map((notif) => {
            const Icon = TYPE_ICON[notif.type];
            const color = TYPE_COLOR[notif.type];
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
                        {TYPE_LABEL[notif.type]}
                      </span>
                      {notif.dismissed && (
                        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
                          Okundu
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-zinc-200">{notif.message}</p>
                    <p className="mt-1 text-xs text-zinc-600">
                      {notif.storeName} ·{" "}
                      {format(parseISO(notif.createdAt), "d MMM yyyy, HH:mm", {
                        locale: tr,
                      })}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => handleOpen(notif)}>
                        Haritada aç
                      </Button>
                      {notif.dismissed ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => undismiss(notif.id)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Geri al
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => dismiss(notif.id)}
                        >
                          <X className="h-3.5 w-3.5" />
                          Kapat
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

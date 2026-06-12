"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { AlertTriangle, Bell, Clock, ShoppingCart, X } from "lucide-react";
import type { AppNotification } from "@/types";

type NotificationsPanelProps = {
  notifications: AppNotification[];
  onClose: () => void;
  anchorRect: DOMRect | null;
};

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

export function NotificationsPanel({
  notifications,
  onClose,
  anchorRect,
}: NotificationsPanelProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  if (!anchorRect || typeof document === "undefined") return null;

  const top = anchorRect.bottom + 8;
  const right = Math.max(16, window.innerWidth - anchorRect.right);

  return createPortal(
    <div
      ref={ref}
      style={{ top, right }}
      className="fixed z-[9999] w-80 rounded-xl border border-zinc-700/60 bg-zinc-950/98 shadow-[0_0_40px_rgba(0,0,0,0.6)] backdrop-blur-md"
    >
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-medium text-zinc-200">Bildirimler</span>
          {notifications.length > 0 && (
            <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-xs text-red-400">
              {notifications.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <ul className="scrollbar-themed max-h-80 overflow-y-auto p-2">
        {notifications.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-zinc-500">
            Bildirim yok
          </li>
        )}
        {notifications.map((notif) => {
          const Icon = TYPE_ICON[notif.type];
          const color = TYPE_COLOR[notif.type];
          return (
            <li
              key={notif.id}
              className="mb-1 rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-3 last:mb-0"
            >
              <div className="flex items-start gap-2">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
                <div className="min-w-0">
                  <p className="text-sm text-zinc-300">{notif.message}</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    {format(parseISO(notif.createdAt), "d MMM yyyy, HH:mm", {
                      locale: tr,
                    })}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>,
    document.body
  );
}

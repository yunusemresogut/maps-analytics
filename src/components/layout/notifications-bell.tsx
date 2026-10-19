"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { useNotifications } from "@/contexts/notifications-context";
import { Button } from "@/components/ui/button";
import { NotificationsPanel } from "@/components/layout/notifications-panel";
import { useT } from "@/contexts/i18n-context";
import { notificationHref } from "@/lib/notifications";
import type { AppNotification } from "@/types";

/** Başlıktaki bildirim zili; tüm sayfalarda görünür */
export function NotificationsBell() {
  const router = useRouter();
  const { notifications, dismiss } = useNotifications();
  const t = useT();
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const open = anchorRect !== null;

  const close = () => setAnchorRect(null);

  const toggle = () => {
    if (open) close();
    else if (bellRef.current) setAnchorRect(bellRef.current.getBoundingClientRect());
  };

  const select = (notification: AppNotification) => {
    dismiss(notification.id);
    close();
    router.push(notificationHref(notification));
  };

  return (
    <>
      <div ref={bellRef} className="relative">
        <Button
          variant={open ? "default" : "ghost"}
          size="icon"
          title={t("header.notifications")}
          aria-label={t("header.notifications")}
          onClick={toggle}
          className="relative"
        >
          <Bell className="h-4 w-4" />
          {notifications.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {notifications.length > 99 ? "99+" : notifications.length}
            </span>
          )}
        </Button>
      </div>
      {open && (
        <NotificationsPanel
          notifications={notifications}
          anchorRect={anchorRect}
          onClose={close}
          onDismiss={dismiss}
          onSelect={select}
        />
      )}
    </>
  );
}

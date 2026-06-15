"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Layers, Store } from "lucide-react";
import { useNotifications } from "@/contexts/notifications-context";
import { useRegions } from "@/contexts/regions-context";
import { useMapUi } from "@/contexts/map-ui-context";
import { Button } from "@/components/ui/button";
import { NotificationsPanel } from "@/components/layout/notifications-panel";
import type { AppNotification } from "@/types";

export function MapHeaderActions() {
  const pathname = usePathname();
  const router = useRouter();
  const { isPanelOpen, setPanelOpen } = useRegions();
  const { isStoreListOpen, setStoreListOpen } = useMapUi();
  const { notifications, dismiss } = useNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  if (pathname !== "/map") return null;

  const toggleNotifications = () => {
    if (notifOpen) {
      setNotifOpen(false);
      setAnchorRect(null);
      return;
    }
    if (bellRef.current) {
      setAnchorRect(bellRef.current.getBoundingClientRect());
    }
    setNotifOpen(true);
  };

  const closeNotifications = () => {
    setNotifOpen(false);
    setAnchorRect(null);
  };

  const handleSelectNotification = (notif: AppNotification) => {
    dismiss(notif.id);
    closeNotifications();
    router.push(`/map?store=${notif.storeId}`);
  };

  return (
    <>
      <Button
        variant={isPanelOpen ? "default" : "ghost"}
        size="sm"
        onClick={() => {
          setStoreListOpen(false);
          setPanelOpen(!isPanelOpen);
        }}
      >
        <Layers className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Bölgeler</span>
      </Button>

      <Button
        variant={isStoreListOpen ? "default" : "ghost"}
        size="sm"
        onClick={() => {
          setPanelOpen(false);
          setStoreListOpen(!isStoreListOpen);
        }}
      >
        <Store className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Mağazalar</span>
      </Button>

      <div ref={bellRef} className="relative">
        <Button
          variant={notifOpen ? "default" : "ghost"}
          size="sm"
          onClick={toggleNotifications}
          className="relative"
        >
          <Bell className="h-3.5 w-3.5" />
          {notifications.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {notifications.length > 99 ? "99+" : notifications.length}
            </span>
          )}
        </Button>
      </div>

      {notifOpen && (
        <NotificationsPanel
          notifications={notifications}
          anchorRect={anchorRect}
          onClose={closeNotifications}
          onDismiss={dismiss}
          onSelect={handleSelectNotification}
        />
      )}
    </>
  );
}

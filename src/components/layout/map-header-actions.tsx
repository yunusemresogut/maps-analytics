"use client";

import { useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Layers } from "lucide-react";
import { useStores } from "@/contexts/stores-context";
import { useRegions } from "@/contexts/regions-context";
import { computeStoreNotifications } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { NotificationsPanel } from "@/components/layout/notifications-panel";

export function MapHeaderActions() {
  const pathname = usePathname();
  const { stores } = useStores();
  const { isPanelOpen, setPanelOpen } = useRegions();
  const [notifOpen, setNotifOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  const notifications = useMemo(
    () => computeStoreNotifications(stores),
    [stores]
  );

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

  return (
    <>
      <Button
        variant={isPanelOpen ? "default" : "ghost"}
        size="sm"
        onClick={() => setPanelOpen(!isPanelOpen)}
      >
        <Layers className="h-3.5 w-3.5" />
        Bölgeler
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
          onClose={() => {
            setNotifOpen(false);
            setAnchorRect(null);
          }}
        />
      )}
    </>
  );
}

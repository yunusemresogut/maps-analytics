"use client";

import { usePathname } from "next/navigation";
import { Layers, Store } from "lucide-react";
import { useRegions } from "@/contexts/regions-context";
import { useMapUi } from "@/contexts/map-ui-context";
import { Button } from "@/components/ui/button";
import { useT } from "@/contexts/i18n-context";

export function MapHeaderActions() {
  const pathname = usePathname();
  const { isPanelOpen, setPanelOpen } = useRegions();
  const { isStoreListOpen, setStoreListOpen } = useMapUi();
  const t = useT();

  if (pathname !== "/map") return null;

  return (
    <>
      <Button
        variant={isPanelOpen ? "default" : "ghost"}
        size="icon"
        title={t("header.regions")}
        aria-label={t("header.regions")}
        onClick={() => {
          setStoreListOpen(false);
          setPanelOpen(!isPanelOpen);
        }}
      >
        <Layers className="h-4 w-4" />
      </Button>

      <Button
        variant={isStoreListOpen ? "default" : "ghost"}
        size="icon"
        title={t("header.stores")}
        aria-label={t("header.stores")}
        onClick={() => {
          setPanelOpen(false);
          setStoreListOpen(!isStoreListOpen);
        }}
      >
        <Store className="h-4 w-4" />
      </Button>

    </>
  );
}

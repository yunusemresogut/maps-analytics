"use client";

import dynamic from "next/dynamic";
import { useT } from "@/contexts/i18n-context";

function MapLoading() {
  const t = useT();
  return (
    <div className="flex h-full items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
        <p className="text-sm text-zinc-500">{t("site.map.loading")}</p>
      </div>
    </div>
  );
}

const StoreMap = dynamic(
  () => import("@/components/map/store-map").then((mod) => mod.StoreMap),
  {
    ssr: false,
    loading: () => <MapLoading />,
  }
);

export function MapLoader() {
  return <StoreMap />;
}

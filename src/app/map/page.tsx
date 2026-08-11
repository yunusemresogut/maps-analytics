"use client";

import { Suspense } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { MapLoader } from "@/components/map/map-loader";

export default function MapPage() {
  return (
    <AuthGuard routeKey="map">
      <div className="h-[calc(100vh-3.5rem)]">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center bg-zinc-950">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
            </div>
          }
        >
          <MapLoader />
        </Suspense>
      </div>
    </AuthGuard>
  );
}

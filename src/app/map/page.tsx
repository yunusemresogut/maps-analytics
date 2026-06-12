"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { MapLoader } from "@/components/map/map-loader";

export default function MapPage() {
  return (
    <AuthGuard allowedRoles={["user"]}>
      <div className="h-[calc(100vh-3.5rem)]">
        <MapLoader />
      </div>
    </AuthGuard>
  );
}

"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { TeamPage } from "@/components/team/team-page";

export default function TeamRoute() {
  return (
    <AuthGuard routeKey="team">
      <TeamPage />
    </AuthGuard>
  );
}

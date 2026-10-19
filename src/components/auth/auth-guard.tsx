"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useSettings } from "@/contexts/settings-context";
import { canAccessRoute } from "@/lib/permissions";
import { homePathForRole } from "@/lib/roles";
import { PageLoader } from "@/components/ui/spinner";
import type { AppRouteKey, UserRole } from "@/types";

type AuthGuardProps = {
  children: React.ReactNode;
  redirectTo?: string;
  /** @deprecated Prefer routeKey */
  allowedRoles?: UserRole[];
  routeKey?: AppRouteKey;
};

export function AuthGuard({
  children,
  redirectTo = "/login",
  allowedRoles,
  routeKey,
}: AuthGuardProps) {
  const { user, isLoading } = useAuth();
  const { isModuleEnabled, homePath } = useSettings();
  const router = useRouter();
  // Admin'in firma genelinde kapattığı modüllerin sayfaları da kapanır
  const moduleOff = Boolean(routeKey && !isModuleEnabled(routeKey));

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace(redirectTo);
      return;
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      router.replace(homePathForRole(user.role));
      return;
    }
    if ((routeKey && !canAccessRoute(user, routeKey)) || moduleOff) {
      router.replace(moduleOff ? homePath : homePathForRole(user.role));
    }
  }, [user, isLoading, router, redirectTo, allowedRoles, routeKey, moduleOff, homePath]);

  if (isLoading) {
    return <PageLoader />;
  }

  if (!user) return null;
  if (allowedRoles && !allowedRoles.includes(user.role)) return null;
  if (routeKey && !canAccessRoute(user, routeKey)) return null;
  if (moduleOff) return null;

  return <>{children}</>;
}

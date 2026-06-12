"use client";

import { useAuth } from "@/contexts/auth-context";
import { canPerform } from "@/lib/permissions";
import type { PermissionAction } from "@/types";

export function usePermissions() {
  const { user } = useAuth();

  const can = (action: PermissionAction): boolean => {
    if (!user) return false;
    if (user.role === "admin") return true;
    return canPerform(user.permissions, action);
  };

  return {
    canView: can("view"),
    canAdd: can("add"),
    canEdit: can("edit"),
    canDelete: can("delete"),
    isAdmin: user?.role === "admin",
  };
}

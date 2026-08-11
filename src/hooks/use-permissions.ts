"use client";

import { useAuth } from "@/contexts/auth-context";
import { canModule } from "@/lib/permissions";
import type { AppModuleKey, PermissionAction } from "@/types";

/**
 * Module-scoped CRUD checks. Admin always has full access.
 * Pass a module for list/detail actions (e.g. "map", "stores").
 */
export function usePermissions(module: AppModuleKey) {
  const { user } = useAuth();

  const can = (action: PermissionAction): boolean =>
    canModule(user, module, action);

  return {
    canView: can("view"),
    canAdd: can("add"),
    canEdit: can("edit"),
    canDelete: can("delete"),
    isAdmin: user?.role === "admin",
    can,
  };
}

import type { UserPermissions } from "@/types";

export const FULL_PERMISSIONS: UserPermissions = {
  view: true,
  add: true,
  edit: true,
  delete: true,
};

export const VIEW_ONLY_PERMISSIONS: UserPermissions = {
  view: true,
  add: false,
  edit: false,
  delete: false,
};

export const DEFAULT_USER_PERMISSIONS: UserPermissions = {
  view: true,
  add: true,
  edit: true,
  delete: false,
};

export function getAdminPermissions(): UserPermissions {
  return { ...FULL_PERMISSIONS };
}

export function canPerform(
  permissions: UserPermissions,
  action: keyof UserPermissions
): boolean {
  return permissions[action] === true;
}

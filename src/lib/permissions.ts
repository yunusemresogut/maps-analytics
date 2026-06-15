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

export const PERMISSION_PRESETS = {
  full: { label: "Tam Yetki", permissions: FULL_PERMISSIONS },
  default: { label: "Varsayılan", permissions: DEFAULT_USER_PERMISSIONS },
  viewOnly: { label: "Sadece Görüntüleme", permissions: VIEW_ONLY_PERMISSIONS },
} as const;

export function getAdminPermissions(): UserPermissions {
  return { ...FULL_PERMISSIONS };
}

export function canPerform(
  permissions: UserPermissions,
  action: keyof UserPermissions
): boolean {
  return permissions[action] === true;
}

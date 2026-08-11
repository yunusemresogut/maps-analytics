import type { Organization, Store, User } from "@/types";
import { emptyApprovals } from "@/types";
import { migrateProjectStatus } from "@/lib/project-status";
import {
  getAdminPermissions,
  normalizePermissions,
  normalizeRolePermissionDefaults,
} from "@/lib/permissions";
import { normalizeRole } from "@/lib/roles";
import { ensureApprovals } from "@/lib/store-mapper";

export function migrateStore(raw: Record<string, unknown>): Store {
  const createdAt =
    (raw.createdAt as string) ?? new Date().toISOString();

  return {
    id: raw.id as string,
    organizationId: raw.organizationId as string | undefined,
    name: raw.name as string,
    city: raw.city as string,
    address: raw.address as string,
    latitude: raw.latitude as number,
    longitude: raw.longitude as number,
    projectStatus: migrateProjectStatus(raw.projectStatus as string),
    openingDate: raw.openingDate as string,
    acceptanceDate: raw.acceptanceDate as string | undefined,
    contractorCompany: raw.contractorCompany as string | undefined,
    siteManager: raw.siteManager as string | undefined,
    locationType: (raw.locationType as Store["locationType"]) ?? "avm",
    grossM2: (raw.grossM2 as number) ?? 0,
    floorCount: (raw.floorCount as number) ?? 1,
    phone: raw.phone as string | undefined,
    isCustom: raw.isCustom as boolean | undefined,
    totalBudget: (raw.totalBudget as number) ?? 1500000,
    approvals: ensureApprovals(raw as Partial<Store>) ?? emptyApprovals(),
    createdBy: (raw.createdBy as string) ?? "system",
    createdByName: (raw.createdByName as string) ?? "Sistem",
    createdAt,
    updatedBy: raw.updatedBy as string | undefined,
    updatedByName: raw.updatedByName as string | undefined,
    updatedAt: raw.updatedAt as string | undefined,
  };
}

export function migrateUser(
  raw: Record<string, unknown>
): User & { password?: string } {
  const role = normalizeRole((raw.role as string) ?? "manager");
  return {
    id: raw.id as string,
    email: raw.email as string,
    name: raw.name as string,
    role,
    organizationId: raw.organizationId as string | undefined,
    phone: raw.phone as string | undefined,
    avatarUrl: raw.avatarUrl as string | undefined,
    permissions:
      role === "admin"
        ? getAdminPermissions()
        : normalizePermissions(role, raw.permissions),
    restricted: (raw.restricted as boolean) ?? false,
    password: raw.password as string | undefined,
  };
}

export function mapOrganizationFromDb(row: Record<string, any>): Organization {
  return {
    id: row.id,
    name: row.name,
    taxNumber: row.tax_number || undefined,
    authorizedPerson: row.authorized_person || undefined,
    phone: row.phone || undefined,
    address: row.address || undefined,
    avatarUrl: row.avatar_url || undefined,
    createdAt: row.created_at,
    rolePermissionDefaults: normalizeRolePermissionDefaults(
      row.role_permission_defaults
    ),
  };
}

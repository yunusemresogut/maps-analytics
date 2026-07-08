import type { Store, User } from "@/types";
import { migrateProjectStatus } from "@/lib/project-status";
import { DEFAULT_USER_PERMISSIONS, getAdminPermissions } from "@/lib/permissions";

export function migrateStore(raw: Record<string, unknown>): Store {
  const createdAt =
    (raw.createdAt as string) ?? new Date().toISOString();

  return {
    id: raw.id as string,
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
    createdBy: (raw.createdBy as string) ?? "system",
    createdByName: (raw.createdByName as string) ?? "Sistem",
    createdAt,
    updatedBy: raw.updatedBy as string | undefined,
    updatedByName: raw.updatedByName as string | undefined,
    updatedAt: raw.updatedAt as string | undefined,
  };
}

export function migrateUser(raw: Record<string, unknown>): User & { password: string } {
  const role = (raw.role as User["role"]) ?? "user";
  return {
    id: raw.id as string,
    email: raw.email as string,
    name: raw.name as string,
    role,
    permissions:
      role === "admin"
        ? getAdminPermissions()
        : ((raw.permissions as User["permissions"]) ?? DEFAULT_USER_PERMISSIONS),
    restricted: (raw.restricted as boolean) ?? false,
    password: raw.password as string,
  };
}

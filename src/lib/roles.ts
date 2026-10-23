import type {
  ApprovalDiscipline,
  BuiltInRole,
  CustomRole,
  CustomRoleKey,
  Organization,
  ProjectApprovals,
  UserRole,
} from "@/types";

/** Yerleşik roller (özel roller firmaya göre değişir, bkz. organizationRoles) */
export const ALL_ROLES: BuiltInRole[] = [
  "admin",
  "mechanical_engineer",
  "electrical_engineer",
  "architect",
  "civil_engineer",
  "manager",
  "regional_manager",
  "store_manager",
  "accounting",
];

export const ROLE_LABELS: Record<BuiltInRole, string> = {
  admin: "Kurucu",
  mechanical_engineer: "Makine Mühendisi",
  electrical_engineer: "Elektrik Mühendisi",
  architect: "Mimar",
  civil_engineer: "İnşaat Mühendisi",
  manager: "Yönetici",
  regional_manager: "Bölge Müdürü",
  store_manager: "Mağaza Müdürü",
  accounting: "Muhasebe",
};

/** Veritabanındaki app_normalize_role ve profiles_role_check ile aynı biçim */
export const CUSTOM_ROLE_PATTERN = /^custom_[a-z0-9]{4,32}$/;

export function isCustomRole(role: string | null | undefined): role is CustomRoleKey {
  return !!role && CUSTOM_ROLE_PATTERN.test(role);
}

export function isBuiltInRole(role: string | null | undefined): role is BuiltInRole {
  return !!role && (ALL_ROLES as string[]).includes(role);
}

export function newCustomRoleKey(): CustomRoleKey {
  const random = Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => (byte % 36).toString(36)).join("");
  return `custom_${random}`;
}

export function normalizeCustomRoles(raw: unknown): CustomRole[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): CustomRole[] => {
    if (!item || typeof item !== "object") return [];
    const role = item as Record<string, unknown>;
    const label = typeof role.label === "string" ? role.label.trim() : "";
    if (!isCustomRole(role.key as string) || !label) return [];
    const description = typeof role.description === "string" ? role.description.trim() : "";
    return [{ key: role.key as CustomRoleKey, label, ...(description ? { description } : {}) }];
  });
}

/** Firmadaki tüm roller: yerleşikler, ardından özel roller */
export function organizationRoles(org?: Pick<Organization, "customRoles"> | null): UserRole[] {
  return [...ALL_ROLES, ...(org?.customRoles ?? []).map((role) => role.key)];
}

/** Kullanıcıya atanabilen roller (admin yalnızca firma kaydıyla oluşur) */
export function assignableRoles(org?: Pick<Organization, "customRoles"> | null): UserRole[] {
  return organizationRoles(org).filter((role) => role !== "admin");
}

/** Org özelleştirmesi varsa onu, yoksa varsayılan etiketi döner */
export function getRoleLabel(
  role: UserRole,
  org?: Pick<Organization, "roleLabels" | "customRoles"> | null
): string {
  if (isCustomRole(role)) {
    return org?.customRoles?.find((item) => item.key === role)?.label ?? "Özel rol";
  }
  const custom = org?.roleLabels?.[role];
  if (custom?.trim()) return custom.trim();
  return ROLE_LABELS[role] ?? role;
}

export const ENGINEER_ROLES: UserRole[] = [
  "mechanical_engineer",
  "electrical_engineer",
  "architect",
  "civil_engineer",
];

export const MANAGER_ROLES: UserRole[] = [
  "manager",
  "regional_manager",
  "store_manager",
];

/** Managers who can approve all disciplines and open/close projects */
export const FULL_MANAGER_ROLES: UserRole[] = ["manager", "regional_manager"];

const DISCIPLINE_ROLE: Record<ApprovalDiscipline, BuiltInRole> = {
  architectural: "architect",
  mechanical: "mechanical_engineer",
  electrical: "electrical_engineer",
};

/** Tanınmayan eski değerler "manager" olur; özel rol anahtarı olduğu gibi kalır */
export function normalizeRole(role: string | null | undefined): UserRole {
  if (!role || role === "user") return "manager";
  if (isBuiltInRole(role) || isCustomRole(role)) return role;
  return "manager";
}

export function isAdmin(role: UserRole): boolean {
  return role === "admin";
}

export function isEngineer(role: UserRole): boolean {
  return ENGINEER_ROLES.includes(role);
}

export function isManager(role: UserRole): boolean {
  return MANAGER_ROLES.includes(role);
}

export function canApproveDiscipline(
  role: UserRole,
  discipline: ApprovalDiscipline
): boolean {
  if (role === "admin") return true;
  if (FULL_MANAGER_ROLES.includes(role)) return true;
  return DISCIPLINE_ROLE[discipline] === role;
}

export function allDisciplinesApproved(approvals: ProjectApprovals): boolean {
  return (
    approvals.architectural.approved &&
    approvals.mechanical.approved &&
    approvals.electrical.approved
  );
}

export function canAccessApprovalsQueue(role: UserRole): boolean {
  return role === "admin" || FULL_MANAGER_ROLES.includes(role);
}

export function homePathForRole(_role: UserRole): string {
  return "/map";
}

export function isOrgProfileComplete(org: {
  name?: string | null;
  taxNumber?: string | null;
  address?: string | null;
  authorizedPerson?: string | null;
  phone?: string | null;
}): boolean {
  return Boolean(
    org.name?.trim() &&
      org.taxNumber?.trim() &&
      org.address?.trim() &&
      org.authorizedPerson?.trim() &&
      org.phone?.trim()
  );
}

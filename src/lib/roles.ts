import type {
  ApprovalDiscipline,
  ProjectApprovals,
  UserRole,
} from "@/types";

export const ALL_ROLES: UserRole[] = [
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

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  mechanical_engineer: "Makine Mühendisi",
  electrical_engineer: "Elektrik Mühendisi",
  architect: "Mimar",
  civil_engineer: "İnşaat Mühendisi",
  manager: "Yönetici",
  regional_manager: "Bölge Müdürü",
  store_manager: "Mağaza Müdürü",
  accounting: "Muhasebe",
};

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

const DISCIPLINE_ROLE: Record<ApprovalDiscipline, UserRole> = {
  architectural: "architect",
  mechanical: "mechanical_engineer",
  electrical: "electrical_engineer",
};

export function normalizeRole(role: string | null | undefined): UserRole {
  if (!role || role === "user") return "manager";
  if ((ALL_ROLES as string[]).includes(role)) return role as UserRole;
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

/** After project is opened, only admin/managers may change discipline approvals. */
export function canToggleDisciplineApproval(
  role: UserRole,
  discipline: ApprovalDiscipline,
  projectOpened: boolean
): boolean {
  if (projectOpened) {
    return role === "admin" || FULL_MANAGER_ROLES.includes(role);
  }
  return canApproveDiscipline(role, discipline);
}

export function allDisciplinesApproved(approvals: ProjectApprovals): boolean {
  return (
    approvals.architectural.approved &&
    approvals.mechanical.approved &&
    approvals.electrical.approved
  );
}

export function canOpenProject(role: UserRole): boolean {
  if (role === "admin") return true;
  if (isEngineer(role)) return true;
  if (FULL_MANAGER_ROLES.includes(role)) return true;
  return false;
}

/** Role may open AND all three disciplines are approved AND not already opened. */
export function canOpenStoreProject(
  role: UserRole,
  approvals: ProjectApprovals
): boolean {
  if (approvals.projectOpened) return false;
  if (!canOpenProject(role)) return false;
  return allDisciplinesApproved(approvals);
}

/** Only admin / manager / regional manager may reverse "project opened". */
export function canCloseStoreProject(
  role: UserRole,
  approvals: ProjectApprovals
): boolean {
  if (!approvals.projectOpened) return false;
  return role === "admin" || FULL_MANAGER_ROLES.includes(role);
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

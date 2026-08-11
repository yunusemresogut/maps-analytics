import type {
  AppModuleKey,
  AppRouteKey,
  LegacyFlatPermissions,
  ModuleCrud,
  PermissionAction,
  PermissionMatrix,
  User,
  UserRole,
} from "@/types";
import {
  FULL_MANAGER_ROLES,
  isAdmin,
  isEngineer,
  normalizeRole,
} from "@/lib/roles";

export const MODULE_KEYS: AppModuleKey[] = [
  "map",
  "stores",
  "projects",
  "approvals",
  "tickets",
  "contracts",
  "progressPayments",
  "invoices",
];

export const MODULE_LABELS: Record<AppModuleKey, string> = {
  map: "Harita",
  stores: "Mağazalar",
  projects: "Projeler",
  approvals: "Onaylar",
  tickets: "Ticket",
  contracts: "Sözleşmeler",
  progressPayments: "Hakediş",
  invoices: "Faturalar",
};

export const CRUD_ACTIONS: PermissionAction[] = [
  "view",
  "add",
  "edit",
  "delete",
];

export const CRUD_ACTION_LABELS: Record<PermissionAction, string> = {
  view: "Görüntüle",
  add: "Ekle",
  edit: "Düzenle",
  delete: "Sil",
};

export const NONE_CRUD: ModuleCrud = {
  view: false,
  add: false,
  edit: false,
  delete: false,
};

export const VIEW_ONLY_CRUD: ModuleCrud = {
  view: true,
  add: false,
  edit: false,
  delete: false,
};

/** Default CRUD for engineers / managers (no delete) */
export const DEFAULT_CRUD: ModuleCrud = {
  view: true,
  add: true,
  edit: true,
  delete: false,
};

export const FULL_CRUD: ModuleCrud = {
  view: true,
  add: true,
  edit: true,
  delete: true,
};

export const EDIT_CRUD: ModuleCrud = {
  view: true,
  add: false,
  edit: true,
  delete: false,
};

/** @deprecated flat shapes — use ModuleCrud helpers */
export const FULL_PERMISSIONS = FULL_CRUD;
export const VIEW_ONLY_PERMISSIONS = VIEW_ONLY_CRUD;
export const DEFAULT_USER_PERMISSIONS = DEFAULT_CRUD;

function cloneCrud(c: ModuleCrud): ModuleCrud {
  return { ...c };
}

function emptyMatrix(): PermissionMatrix {
  return {
    map: cloneCrud(NONE_CRUD),
    stores: cloneCrud(NONE_CRUD),
    projects: cloneCrud(NONE_CRUD),
    approvals: cloneCrud(NONE_CRUD),
    tickets: cloneCrud(NONE_CRUD),
    contracts: cloneCrud(NONE_CRUD),
    progressPayments: cloneCrud(NONE_CRUD),
    invoices: cloneCrud(NONE_CRUD),
  };
}

function setModules(
  matrix: PermissionMatrix,
  keys: AppModuleKey[],
  crud: ModuleCrud
) {
  for (const key of keys) {
    matrix[key] = cloneCrud(crud);
  }
}

export function defaultMatrixForRole(role: UserRole): PermissionMatrix {
  return builtInMatrixForRole(role);
}

/**
 * Built-in seed templates shipped with the app.
 * Prefer resolveDefaultMatrixForRole when an organization override may exist.
 */
export function builtInMatrixForRole(role: UserRole): PermissionMatrix {
  const matrix = emptyMatrix();

  if (role === "admin") {
    setModules(matrix, MODULE_KEYS, FULL_CRUD);
    return matrix;
  }

  // Everyone with map access (stores list/detail mirrored)
  setModules(matrix, ["map", "stores"], DEFAULT_CRUD);

  if (role === "accounting") {
    matrix.map = cloneCrud(VIEW_ONLY_CRUD);
    matrix.stores = cloneCrud(VIEW_ONLY_CRUD);
    setModules(matrix, ["progressPayments", "invoices"], DEFAULT_CRUD);
    return matrix;
  }

  if (role === "store_manager") {
    matrix.map = cloneCrud(EDIT_CRUD);
    matrix.stores = cloneCrud(EDIT_CRUD);
    matrix.projects = cloneCrud(VIEW_ONLY_CRUD);
    matrix.tickets = cloneCrud(DEFAULT_CRUD);
    return matrix;
  }

  if (isEngineer(role)) {
    setModules(
      matrix,
      ["map", "stores", "projects", "tickets"],
      DEFAULT_CRUD
    );
    // Edit lets discipline switches work; queue visible too
    matrix.approvals = cloneCrud(EDIT_CRUD);
    return matrix;
  }

  if (FULL_MANAGER_ROLES.includes(role)) {
    setModules(
      matrix,
      ["map", "stores", "projects", "approvals", "tickets", "contracts", "progressPayments"],
      DEFAULT_CRUD
    );
    return matrix;
  }

  // Fallback
  setModules(matrix, ["map", "stores"], VIEW_ONLY_CRUD);
  return matrix;
}

/** Org override if present and valid, else built-in. */
export function resolveDefaultMatrixForRole(
  role: UserRole,
  orgDefaults?: Partial<Record<UserRole, unknown>> | null
): PermissionMatrix {
  if (role === "admin") return builtInMatrixForRole("admin");
  const raw = orgDefaults?.[role];
  if (raw && isMatrix(raw)) {
    return normalizePermissions(role, raw);
  }
  return builtInMatrixForRole(role);
}

export function normalizeRolePermissionDefaults(
  raw: unknown
): Partial<Record<UserRole, PermissionMatrix>> {
  if (!raw || typeof raw !== "object") return {};
  const out: Partial<Record<UserRole, PermissionMatrix>> = {};
  const o = raw as Record<string, unknown>;
  for (const role of Object.keys(o) as UserRole[]) {
    if (role === "admin") continue;
    if (isMatrix(o[role])) {
      out[role] = normalizePermissions(role, o[role]);
    }
  }
  return out;
}

/** @deprecated Use defaultMatrixForRole / resolveDefaultMatrixForRole */
export function defaultPermissionsForRole(role: UserRole): PermissionMatrix {
  return builtInMatrixForRole(role);
}

export function getAdminPermissions(): PermissionMatrix {
  return builtInMatrixForRole("admin");
}

function isFlatPermissions(raw: unknown): raw is LegacyFlatPermissions {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  const hasFlat =
    typeof o.view === "boolean" &&
    typeof o.add === "boolean" &&
    typeof o.edit === "boolean" &&
    typeof o.delete === "boolean";
  const hasModule = MODULE_KEYS.some((k) => k in o && typeof o[k] === "object");
  return hasFlat && !hasModule;
}

function isMatrix(raw: unknown): raw is PermissionMatrix {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return MODULE_KEYS.every((k) => {
    const m = o[k];
    if (!m || typeof m !== "object") return false;
    const c = m as Record<string, unknown>;
    return CRUD_ACTIONS.every((a) => typeof c[a] === "boolean");
  });
}

/**
 * Normalize stored JSON to PermissionMatrix.
 * - Full matrix → sanitized clone
 * - Legacy flat CRUD → apply that CRUD to role's accessible modules (via role defaults keys), others none
 * - Missing/invalid → role defaults
 */
export function normalizePermissions(
  role: UserRole,
  raw: unknown
): PermissionMatrix {
  const normalizedRole = normalizeRole(role);

  if (isMatrix(raw)) {
    const base = emptyMatrix();
    for (const key of MODULE_KEYS) {
      const m = raw[key];
      base[key] = {
        view: !!m.view,
        add: !!m.add,
        edit: !!m.edit,
        delete: !!m.delete,
      };
      // Ensure edit/add/delete imply view
      if (base[key].add || base[key].edit || base[key].delete) {
        base[key].view = true;
      }
    }
    return base;
  }

  if (isFlatPermissions(raw)) {
    const defaults = defaultMatrixForRole(normalizedRole);
    const next = emptyMatrix();
    for (const key of MODULE_KEYS) {
      if (defaults[key].view) {
        next[key] = {
          view: raw.view,
          add: raw.add,
          edit: raw.edit,
          delete: raw.delete,
        };
        if (next[key].add || next[key].edit || next[key].delete) {
          next[key].view = true;
        }
      }
    }
    return next;
  }

  return defaultMatrixForRole(normalizedRole);
}

export function canPerform(
  permissions: ModuleCrud | PermissionMatrix | LegacyFlatPermissions,
  action: PermissionAction
): boolean {
  // Flat (legacy)
  if (
    permissions &&
    typeof permissions === "object" &&
    "view" in permissions &&
    typeof (permissions as LegacyFlatPermissions).view === "boolean" &&
    !MODULE_KEYS.some((k) => k in (permissions as object))
  ) {
    return (permissions as LegacyFlatPermissions)[action] === true;
  }
  return false;
}

export function canModule(
  user: Pick<User, "role" | "permissions"> | null | undefined,
  module: AppModuleKey,
  action: PermissionAction
): boolean {
  if (!user) return false;
  if (isAdmin(user.role)) return true;
  const matrix = normalizePermissions(user.role, user.permissions);
  return matrix[module]?.[action] === true;
}

export function canAccessModule(
  user: Pick<User, "role" | "permissions"> | null | undefined,
  module: AppModuleKey
): boolean {
  return canModule(user, module, "view");
}

/** Route key → app module (null = always allowed for authenticated users, or admin-only) */
export function routeToModule(route: AppRouteKey): AppModuleKey | null | "admin" {
  switch (route) {
    case "dashboard":
    case "profile":
      return null;
    case "map":
    case "stores":
    case "projects":
    case "approvals":
    case "tickets":
    case "contracts":
    case "progressPayments":
    case "invoices":
      return route;
    case "adminUsers":
    case "adminRegions":
    case "adminPermissions":
    case "adminLogs":
    case "adminBudgets":
    case "adminDashboard":
      return "admin";
    default:
      return null;
  }
}

export function canAccessRoute(
  user: Pick<User, "role" | "permissions"> | null | undefined,
  route: AppRouteKey
): boolean {
  if (!user) return false;
  if (isAdmin(user.role)) return true;

  const mapped = routeToModule(route);
  if (mapped === "admin") return false;
  if (mapped === null) return true;
  return canAccessModule(user, mapped);
}

/** Update one cell with UX rules: closing view clears row; opening add/edit/delete forces view */
export function setMatrixCell(
  matrix: PermissionMatrix,
  module: AppModuleKey,
  action: PermissionAction,
  value: boolean
): PermissionMatrix {
  const next: PermissionMatrix = {
    ...matrix,
    [module]: { ...matrix[module] },
  };
  const row = next[module];

  if (action === "view" && !value) {
    next[module] = cloneCrud(NONE_CRUD);
    return next;
  }

  row[action] = value;
  if (value && action !== "view") {
    row.view = true;
  }
  return next;
}

export const PERMISSION_PRESETS = {
  full: { label: "Tam Yetki (tüm modüller)", matrix: () => defaultMatrixForRole("admin") },
  default: {
    label: "Varsayılan CRUD",
    // unused — UI uses role defaults
    matrix: () => defaultMatrixForRole("manager"),
  },
  viewOnly: {
    label: "Sadece görüntüleme",
    matrix: () => {
      const m = emptyMatrix();
      setModules(m, MODULE_KEYS, VIEW_ONLY_CRUD);
      return m;
    },
  },
} as const;

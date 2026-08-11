/** Proje / pin durumları */
export type ProjectStatus =
  | "proje"
  | "ihale"
  | "santiye"
  | "acilis"
  | "hakedis"
  | "fatura"
  | "yakinda_aciliyor";

export type LocationType = "cadde" | "avm" | "outdoor";

export type UserRole =
  | "admin"
  | "mechanical_engineer"
  | "electrical_engineer"
  | "architect"
  | "civil_engineer"
  | "manager"
  | "regional_manager"
  | "store_manager"
  | "accounting";

/** @deprecated Legacy — migrated to manager */
export type LegacyUserRole = "user";

export type PermissionAction = "view" | "add" | "edit" | "delete";

/** @deprecated Prefer ModuleCrud / PermissionMatrix — kept for legacy flat CRUD */
export type LegacyFlatPermissions = Record<PermissionAction, boolean>;

export type AppModuleKey =
  | "map"
  | "stores"
  | "projects"
  | "approvals"
  | "tickets"
  | "contracts"
  | "progressPayments"
  | "invoices";

export type ModuleCrud = Record<PermissionAction, boolean>;

/** Per-module view/add/edit/delete matrix stored on the user profile */
export type PermissionMatrix = Record<AppModuleKey, ModuleCrud>;

/** Alias used across the app for the stored permission payload */
export type UserPermissions = PermissionMatrix;

export type ApprovalDiscipline =
  | "architectural"
  | "mechanical"
  | "electrical";

export type AppRouteKey =
  | "dashboard"
  | "map"
  | "stores"
  | "projects"
  | "approvals"
  | "tickets"
  | "contracts"
  | "progressPayments"
  | "invoices"
  | "profile"
  | "adminUsers"
  | "adminRegions"
  | "adminPermissions"
  | "adminLogs"
  | "adminBudgets"
  | "adminDashboard";

export type AuditInfo = {
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedBy?: string;
  updatedByName?: string;
  updatedAt?: string;
};

export type DisciplineApproval = {
  approved: boolean;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
};

export type ProjectApprovals = {
  architectural: DisciplineApproval;
  mechanical: DisciplineApproval;
  electrical: DisciplineApproval;
  projectOpened: boolean;
  projectOpenedBy?: string;
  projectOpenedByName?: string;
  projectOpenedAt?: string;
};

export type Organization = {
  id: string;
  name: string;
  taxNumber?: string;
  authorizedPerson?: string;
  phone?: string;
  address?: string;
  avatarUrl?: string;
  createdAt: string;
  /** Editable org-level role default matrices (admin excluded) */
  rolePermissionDefaults?: Partial<Record<UserRole, PermissionMatrix>>;
};

export type Store = {
  id: string;
  organizationId?: string;
  name: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  projectStatus: ProjectStatus;
  openingDate: string;
  acceptanceDate?: string;
  contractorCompany?: string;
  siteManager?: string;
  locationType: LocationType;
  grossM2: number;
  floorCount: number;
  phone?: string;
  isCustom?: boolean;
  totalBudget: number;
  approvals: ProjectApprovals;
} & AuditInfo;

/** Audit alanları hariç mağaza girdisi — create/update formları için */
export type StoreInput = Omit<
  Store,
  "id" | "isCustom" | "totalBudget" | "approvals" | keyof AuditInfo
> & {
  totalBudget?: number;
  approvals?: ProjectApprovals;
  organizationId?: string;
};

export type StoreNote = {
  id: string;
  storeId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type StoreFile = {
  id: string;
  storeId: string;
  userId: string;
  userName: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
  uploadedAt: string;
};

export type User = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: UserPermissions;
  organizationId?: string;
  phone?: string;
  avatarUrl?: string;
  restricted?: boolean;
};

export type MaterialStatus = "bekleniyor" | "geldi" | "gitti";

export type StoreMaterial = {
  id: string;
  storeId: string;
  userId: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  status: MaterialStatus;
  importedAt: string;
};

export type WorkPlanStatus = "yapilacak" | "devam_ediyor" | "tamamlandi";

export type StoreWorkPlanItem = {
  id: string;
  storeId: string;
  userId: string;
  description: string;
  startDate: string;
  endDate: string;
  responsible: string;
  status: WorkPlanStatus | string;
  importedAt: string;
};

export type StoreUserData = {
  notes: StoreNote[];
  files: StoreFile[];
  materials: StoreMaterial[];
  workPlan: StoreWorkPlanItem[];
  specialNote: string;
};

export type Region = {
  id: string;
  name: string;
  cities: string[];
  color: string;
  organizationId?: string;
};

export type TicketPriority = "low" | "medium" | "high";
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

export type Ticket = {
  id: string;
  organizationId: string;
  storeId?: string;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  assigneeId?: string;
  assigneeName?: string;
} & AuditInfo;

export type ContractStatus = "draft" | "active" | "expired" | "cancelled";

export type Contract = {
  id: string;
  organizationId: string;
  storeId?: string;
  title: string;
  partyName: string;
  startDate?: string;
  endDate?: string;
  amount: number;
  status: ContractStatus;
  fileUrl?: string;
} & AuditInfo;

export type ProgressPaymentStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "paid";

export type ProgressPayment = {
  id: string;
  organizationId: string;
  storeId?: string;
  title: string;
  periodLabel: string;
  amount: number;
  status: ProgressPaymentStatus;
} & AuditInfo;

export type InvoiceStatus = "draft" | "issued" | "paid" | "cancelled";

export type Invoice = {
  id: string;
  organizationId: string;
  storeId?: string;
  progressPaymentId?: string;
  invoiceNumber: string;
  amount: number;
  taxAmount: number;
  status: InvoiceStatus;
  issuedAt?: string;
} & AuditInfo;

export type NotificationType =
  | "opening_soon"
  | "opening_overdue"
  | "ihale_order_reminder";

export type AppNotification = {
  id: string;
  type: NotificationType;
  storeId: string;
  storeName: string;
  message: string;
  createdAt: string;
  read: boolean;
};

export type ActivityCategory =
  | "auth"
  | "user"
  | "permission"
  | "region"
  | "store"
  | "system"
  | "ticket"
  | "contract"
  | "payment"
  | "invoice"
  | "approval"
  | "organization"
  | "profile"
  | "budget"
  | "note"
  | "file"
  | "material"
  | "workplan";

export type ActivityLogEntry = {
  id: string;
  category: ActivityCategory;
  action: string;
  message: string;
  actorId: string;
  actorName: string;
  targetId?: string;
  targetLabel?: string;
  createdAt: string;
};

/** Supabase tablo isimleri — ileride migration için referans */
export const DB_TABLES = {
  organizations: "organizations",
  stores: "stores",
  users: "profiles",
  regions: "regions",
  notes: "store_notes",
  files: "store_files",
  materials: "store_materials",
  workPlan: "store_work_plan",
  notifications: "notifications",
  tickets: "tickets",
  contracts: "contracts",
  progressPayments: "progress_payments",
  invoices: "invoices",
} as const;

export function emptyApprovals(): ProjectApprovals {
  return {
    architectural: { approved: false },
    mechanical: { approved: false },
    electrical: { approved: false },
    projectOpened: false,
  };
}

/** Proje / pin durumları */
export type ProjectStatus =
  | "proje"
  | "ihale"
  | "santiye"
  | "acilis"
  | "hakedis"
  | "fatura"
  | "yakinda_aciliyor";

export type LocationType = "cadde" | "avm";

export type UserRole = "admin" | "user";

export type PermissionAction = "view" | "add" | "edit" | "delete";

export type UserPermissions = Record<PermissionAction, boolean>;

export type AuditInfo = {
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedBy?: string;
  updatedByName?: string;
  updatedAt?: string;
};

export type Store = {
  id: string;
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
  totalBudget: number; // Toplam bütçe (Varsayılan 0)
} & AuditInfo;

/** Audit alanları hariç mağaza girdisi — create/update formları için */
export type StoreInput = Omit<Store, "id" | "isCustom" | "totalBudget" | keyof AuditInfo> & {
  totalBudget?: number;
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
};

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
  | "system";

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
  stores: "stores",
  users: "profiles",
  regions: "regions",
  notes: "store_notes",
  files: "store_files",
  materials: "store_materials",
  workPlan: "store_work_plan",
  notifications: "notifications",
} as const;

import { supabase } from "@/lib/supabase";
import { localizedRecord, t } from "@/i18n/runtime";

/**
 * Envanter: ekipman ve araçlar, kişilere zimmet ve teslim alma
 * (supabase/migrations/20261021180000_inventory.sql). Yetki "inventory"
 * modülüdür; zimmetleme ve teslim alma "düzenle" yetkisi ister.
 */

export const INVENTORY_SOURCE = "inventory_items_list";
export const INVENTORY_SEARCH_COLUMNS = ["code", "name", "brand", "serial_no", "assignee_name", "assignment_store_name"];

export type InventoryCategory = "equipment" | "vehicle" | "hand_tool" | "electronics" | "safety" | "other";
/** Zimmet dışı durum (elle seçilir) */
export type InventoryStatus = "active" | "maintenance" | "retired";
/** Listede görünen durum: açık zimmet varsa "assigned" */
export type InventoryState = "available" | "assigned" | "maintenance" | "retired";
export type ReturnCondition = "good" | "damaged" | "lost";

export const CATEGORY_LABELS: Record<InventoryCategory, string> = localizedRecord({
  equipment: "inventory.category.equipment",
  vehicle: "inventory.category.vehicle",
  hand_tool: "inventory.category.hand_tool",
  electronics: "inventory.category.electronics",
  safety: "inventory.category.safety",
  other: "inventory.category.other",
});

export const STATUS_LABELS: Record<InventoryStatus, string> = localizedRecord({
  active: "inventory.status.active",
  maintenance: "inventory.status.maintenance",
  retired: "inventory.status.retired",
});

export const STATE_LABELS: Record<InventoryState, string> = localizedRecord({
  available: "inventory.state.available",
  assigned: "inventory.state.assigned",
  maintenance: "inventory.state.maintenance",
  retired: "inventory.state.retired",
});

export const STATE_STYLES: Record<InventoryState, string> = {
  available: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
  assigned: "bg-cyan-500/10 text-cyan-300 border-cyan-500/25",
  maintenance: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  retired: "bg-zinc-800/60 text-zinc-500 border-zinc-700",
};

export const CONDITION_LABELS: Record<ReturnCondition, string> = localizedRecord({
  good: "inventory.condition.good",
  damaged: "inventory.condition.damaged",
  lost: "inventory.condition.lost",
});

export type InventoryItemInput = {
  code: string;
  name: string;
  category: InventoryCategory;
  brand: string;
  serialNo: string;
  status: InventoryStatus;
  purchaseDate: string;
  notes: string;
  /** Yalnızca araçta: zorunlu trafik sigortası, kasko ve muayene bitişi, kilometre */
  insuranceExpires: string;
  cascoExpires: string;
  inspectionExpires: string;
  odometerKm: number | null;
};

export type InventoryItem = InventoryItemInput & {
  id: string;
  state: InventoryState;
  /** Aracın en yakın belge bitişi (hurda araçta yok) */
  nextVehicleExpiry?: string;
  createdByName: string;
  updatedAt?: string;
  /** Açık zimmet */
  assignment?: {
    id: string;
    assigneeId?: string;
    assigneeName: string;
    assignedAt: string;
    expectedReturn?: string;
    notes: string;
    storeId?: string;
    storeName?: string;
  };
};

export type AssignmentInput = {
  assigneeId?: string;
  assigneeName: string;
  storeId?: string;
  assignedAt: string;
  expectedReturn?: string;
  notes: string;
};

export type ReturnInput = {
  returnedAt: string;
  condition: ReturnCondition;
  notes: string;
};

export type InventoryAssignment = AssignmentInput & {
  id: string;
  itemId: string;
  returnedAt?: string;
  returnCondition?: ReturnCondition;
  returnNotes: string;
  returnedByName?: string;
  createdByName: string;
};

const text = (value: unknown) => (typeof value === "string" ? value : "");
const optional = (value: unknown) => (typeof value === "string" && value ? value : undefined);

export function mapInventoryRow(row: Record<string, unknown>): InventoryItem {
  return {
    id: String(row.id),
    code: text(row.code),
    name: text(row.name),
    category: (text(row.category) || "other") as InventoryCategory,
    brand: text(row.brand),
    serialNo: text(row.serial_no),
    status: (text(row.status) || "active") as InventoryStatus,
    purchaseDate: text(row.purchase_date),
    notes: text(row.notes),
    insuranceExpires: text(row.insurance_expires),
    cascoExpires: text(row.casco_expires),
    inspectionExpires: text(row.inspection_expires),
    odometerKm: row.odometer_km === null || row.odometer_km === undefined ? null : Number(row.odometer_km),
    nextVehicleExpiry: optional(row.next_vehicle_expiry),
    state: (text(row.state) || "available") as InventoryState,
    createdByName: text(row.created_by_name),
    updatedAt: optional(row.updated_at),
    assignment: row.assignment_id
      ? {
          id: String(row.assignment_id),
          assigneeId: optional(row.assignee_id),
          assigneeName: text(row.assignee_name),
          assignedAt: text(row.assigned_at),
          expectedReturn: optional(row.expected_return),
          notes: text(row.assignment_notes),
          storeId: optional(row.assignment_store_id),
          storeName: optional(row.assignment_store_name),
        }
      : undefined,
  };
}

function mapAssignment(row: Record<string, unknown>): InventoryAssignment {
  return {
    id: String(row.id),
    itemId: String(row.item_id),
    assigneeId: optional(row.assignee_id),
    assigneeName: text(row.assignee_name),
    storeId: optional(row.store_id),
    assignedAt: text(row.assigned_at),
    expectedReturn: optional(row.expected_return),
    notes: text(row.notes),
    returnedAt: optional(row.returned_at),
    returnCondition: optional(row.return_condition) as ReturnCondition | undefined,
    returnNotes: text(row.return_notes),
    returnedByName: optional(row.returned_by_name),
    createdByName: text(row.created_by_name),
  };
}

function itemToDb(input: InventoryItemInput) {
  return {
    code: input.code.trim(),
    name: input.name.trim(),
    category: input.category,
    brand: input.brand.trim(),
    serial_no: input.serialNo.trim(),
    status: input.status,
    purchase_date: input.purchaseDate || null,
    notes: input.notes.trim(),
    ...vehicleToDb(input),
  };
}

function vehicleToDb(input: InventoryItemInput) {
  const vehicle = input.category === "vehicle";
  return {
    insurance_expires: vehicle ? input.insuranceExpires || null : null,
    casco_expires: vehicle ? input.cascoExpires || null : null,
    inspection_expires: vehicle ? input.inspectionExpires || null : null,
    odometer_km: vehicle ? input.odometerKm : null,
  };
}

export const VEHICLE_DOCUMENTS = [
  {
    key: "insuranceExpires",
    get label() {
      return t("inventory.vehicleDocument.insurance");
    },
  },
  {
    key: "cascoExpires",
    get label() {
      return t("inventory.vehicleDocument.casco");
    },
  },
  {
    key: "inspectionExpires",
    get label() {
      return t("inventory.vehicleDocument.inspection");
    },
  },
] as const;

/** Aracın bitişi en yakın belgesi (ad ve tarih) */
export function nearestVehicleDocument(item: InventoryItemInput): { label: string; date: string } | null {
  const documents = VEHICLE_DOCUMENTS.map((doc) => ({ label: doc.label, date: item[doc.key] })).filter((doc) => doc.date);
  if (documents.length === 0) return null;
  return documents.reduce((nearest, doc) => (doc.date < nearest.date ? doc : nearest));
}

/** Bildirimler: verilen tarihe kadar belgesi biten araçlar (RLS: yetkisizse yalnızca zimmetindekiler) */
export async function fetchExpiringVehicles(untilDate: string): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from(INVENTORY_SOURCE)
    .select("*")
    .eq("category", "vehicle")
    .lte("next_vehicle_expiry", untilDate)
    .order("next_vehicle_expiry")
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((row) => mapInventoryRow(row as Record<string, unknown>));
}

function assignmentToDb(input: AssignmentInput) {
  return {
    assignee_id: input.assigneeId || null,
    assignee_name: input.assigneeName.trim(),
    store_id: input.storeId || null,
    assigned_at: input.assignedAt,
    expected_return: input.expectedReturn || null,
    notes: input.notes.trim(),
  };
}

/** Postgres hatalarını kullanıcıya anlaşılır mesaja çevirir */
export function inventoryErrorMessage(error: unknown, fallback: string): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === "23505") return t("inventory.errors.alreadyAssigned");
  if (code === "42501") return t("inventory.errors.noPermission");
  if (code === "23514") return t("inventory.errors.invalidDates");
  return fallback;
}

export async function createInventoryItem(input: InventoryItemInput): Promise<void> {
  const { error } = await supabase.from("inventory_items").insert(itemToDb(input));
  if (error) throw error;
}

export async function updateInventoryItem(id: string, input: InventoryItemInput): Promise<void> {
  const { error } = await supabase.from("inventory_items").update(itemToDb(input)).eq("id", id);
  if (error) throw error;
}

export async function deleteInventoryItem(id: string): Promise<void> {
  const { error } = await supabase.from("inventory_items").delete().eq("id", id);
  if (error) throw error;
}

export async function assignInventoryItem(itemId: string, input: AssignmentInput): Promise<void> {
  const { error } = await supabase.from("inventory_assignments").insert({ item_id: itemId, ...assignmentToDb(input) });
  if (error) throw error;
}

export async function updateAssignment(id: string, input: AssignmentInput): Promise<void> {
  const { error } = await supabase.from("inventory_assignments").update(assignmentToDb(input)).eq("id", id);
  if (error) throw error;
}

/** Teslim alma; eşya hasarlıysa bakıma alınabilir */
export async function returnInventoryItem(
  assignmentId: string,
  input: ReturnInput,
  options: { itemId: string; markMaintenance: boolean }
): Promise<void> {
  const { error } = await supabase
    .from("inventory_assignments")
    .update({
      returned_at: input.returnedAt,
      return_condition: input.condition,
      return_notes: input.notes.trim(),
    })
    .eq("id", assignmentId);
  if (error) throw error;
  if (options.markMaintenance) {
    const { error: statusError } = await supabase
      .from("inventory_items")
      .update({ status: "maintenance" })
      .eq("id", options.itemId);
    if (statusError) throw statusError;
  }
}

/** Eşyanın tüm zimmet geçmişi, en yeni önce */
export async function fetchAssignments(itemId: string): Promise<InventoryAssignment[]> {
  const { data, error } = await supabase
    .from("inventory_assignments")
    .select("*")
    .eq("item_id", itemId)
    .order("assigned_at", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapAssignment(row as Record<string, unknown>));
}

/** Durumlara göre sayılar (özet kartları) */
export async function fetchInventoryCounts(): Promise<Record<InventoryState, number>> {
  const states = Object.keys(STATE_LABELS) as InventoryState[];
  const results = await Promise.all(
    states.map((state) =>
      supabase.from(INVENTORY_SOURCE).select("id", { count: "exact", head: true }).eq("state", state)
    )
  );
  const counts = {} as Record<InventoryState, number>;
  results.forEach(({ count, error }, index) => {
    if (error) throw error;
    counts[states[index]] = count ?? 0;
  });
  return counts;
}

import { supabase } from "@/lib/supabase";
import {
  activeFilters,
  chunk,
  fetchAllRows,
  searchFilter,
  type ListFilterValue,
} from "@/lib/supabase-query";
import { normalizeCurrency, parseMoneyTotals, type CurrencyCode } from "@/lib/currency";
import type {
  StoreDetailSummary,
  StoreMaterial,
  StoreWorkPlanItem,
  WorkPlanDependency,
  WorkPlanDependencyType,
} from "@/types";

/** Malzeme listesi: durum etiketiyle aranabilen view */
export const MATERIALS_SOURCE = "store_materials_list";
export const MATERIAL_SEARCH_COLUMNS = ["poz_no", "name", "unit", "status_label"];

/** İş planı listesi: durum etiketiyle aranabilen view */
export const WORK_PLAN_SOURCE = "store_work_plan_list";
export const WORK_PLAN_SEARCH_COLUMNS = [
  "description",
  "activity_code",
  "wbs_code",
  "responsible",
  "status_label",
];

export const EMPTY_SUMMARY: StoreDetailSummary = {
  materialCount: 0,
  materialTotals: {},
  workPlanCount: 0,
  workPlanAvgProgress: null,
};

export function mapMaterialFromDb(m: Record<string, unknown>): StoreMaterial {
  return {
    id: String(m.id),
    storeId: String(m.store_id),
    userId: String(m.user_id ?? ""),
    pozNo: String(m.poz_no ?? ""),
    name: String(m.name ?? ""),
    quantity: Number(m.quantity || 0),
    unit: String(m.unit ?? ""),
    unitPrice: Number(m.unit_price || 0),
    currency: normalizeCurrency(m.currency),
    status: m.status as StoreMaterial["status"],
    importedAt: String(m.imported_at ?? ""),
    seq: m.seq === null || m.seq === undefined ? undefined : Number(m.seq),
  };
}

function mapWorkPlanPredecessors(raw: unknown): WorkPlanDependency[] {
  if (!Array.isArray(raw)) return [];
  const validTypes: WorkPlanDependencyType[] = ["FS", "SS", "FF", "SF"];
  return raw.flatMap((value): WorkPlanDependency[] => {
    if (!value || typeof value !== "object") return [];
    const dependency = value as Record<string, unknown>;
    if (
      typeof dependency.predecessorId !== "string" ||
      !validTypes.includes(dependency.type as WorkPlanDependencyType)
    ) {
      return [];
    }
    return [{
      predecessorId: dependency.predecessorId,
      type: dependency.type as WorkPlanDependencyType,
      lagHours: Number(dependency.lagHours) || 0,
    }];
  });
}

export function mapWorkPlanFromDb(w: Record<string, unknown>): StoreWorkPlanItem {
  const fallbackProgress =
    w.status === "tamamlandi" ? 100 : w.status === "devam_ediyor" ? 50 : 0;
  return {
    id: String(w.id),
    storeId: String(w.store_id),
    userId: String(w.user_id ?? ""),
    description: String(w.description ?? ""),
    startDate: String(w.start_date ?? ""),
    endDate: String(w.end_date ?? ""),
    responsible: String(w.responsible ?? ""),
    status: w.status as StoreWorkPlanItem["status"],
    sourceTaskId: typeof w.source_task_id === "string" ? w.source_task_id : undefined,
    activityCode: typeof w.activity_code === "string" ? w.activity_code : undefined,
    wbsCode: typeof w.wbs_code === "string" ? w.wbs_code : undefined,
    percentComplete: Math.min(
      100,
      Math.max(0, Number(w.percent_complete ?? fallbackProgress) || 0)
    ),
    predecessors: mapWorkPlanPredecessors(w.predecessors),
    importedAt: String(w.imported_at ?? ""),
  };
}

export function mapSummaryFromDb(row: Record<string, unknown>): StoreDetailSummary {
  return {
    materialCount: Number(row.material_count ?? 0),
    materialTotals: parseMoneyTotals(row.material_totals),
    workPlanCount: Number(row.work_plan_count ?? 0),
    workPlanAvgProgress:
      row.work_plan_avg_progress == null ? null : Number(row.work_plan_avg_progress),
  };
}

/** Tüm mağazaların özetleri (mağaza başına tek satır) */
export async function fetchStoreSummaries(): Promise<Record<string, StoreDetailSummary>> {
  const { data, error } = await fetchAllRows<Record<string, unknown>>((from, to) =>
    supabase.from("store_detail_summary").select("*").order("store_id").range(from, to)
  );
  if (error) throw error;
  return Object.fromEntries(
    data.map((row) => [String(row.store_id), mapSummaryFromDb(row)])
  );
}

export async function fetchStoreSummary(storeId: string): Promise<StoreDetailSummary> {
  const { data, error } = await supabase
    .from("store_detail_summary")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapSummaryFromDb(data) : EMPTY_SUMMARY;
}

/** Mağazanın tüm iş planı (Gantt ve öncül seçimi için), eklenme sırasıyla */
export async function fetchStoreWorkPlan(storeId: string): Promise<StoreWorkPlanItem[]> {
  const { data, error } = await fetchAllRows<Record<string, unknown>>((from, to) =>
    supabase
      .from("store_work_plan")
      .select("*")
      .eq("store_id", storeId)
      .order("seq")
      .range(from, to)
  );
  if (error) throw error;
  return data.map(mapWorkPlanFromDb);
}

/** Mağazanın malzemelerinden ilk `limit` kadarı (asistan bağlamı için) */
export async function fetchStoreMaterialsPreview(
  storeId: string,
  limit: number
): Promise<StoreMaterial[]> {
  const { data, error } = await supabase
    .from("store_materials")
    .select("*")
    .eq("store_id", storeId)
    .order("seq")
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapMaterialFromDb);
}

/** Mağazanın iş planından ilk `limit` kadarı (asistan bağlamı için) */
export async function fetchStoreWorkPlanPreview(
  storeId: string,
  limit: number
): Promise<StoreWorkPlanItem[]> {
  const { data, error } = await supabase
    .from("store_work_plan")
    .select("*")
    .eq("store_id", storeId)
    .order("seq")
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(mapWorkPlanFromDb);
}

/**
 * Listedeki arama/filtreye uyan tüm satırların id'leri.
 * "Tüm sonuçları seç" ile yapılan toplu işlemler, ekranda görünmeyen
 * sayfalardaki satırları da bu şekilde hedefler.
 */
/** Seçili keşif kalemlerinin güncel hâli (sayfalar arası seçim için) */
export async function fetchMaterialsByIds(ids: string[]): Promise<StoreMaterial[]> {
  const rows: StoreMaterial[] = [];
  for (const part of chunk(ids, 200)) {
    const { data, error } = await supabase.from("store_materials").select("*").in("id", part);
    if (error) throw error;
    rows.push(...(data ?? []).map((row) => mapMaterialFromDb(row as Record<string, unknown>)));
  }
  // Tablodaki sırayla gösterilsin
  return rows.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
}

export async function fetchMatchingIds(options: {
  source: string;
  filters: Record<string, ListFilterValue>;
  searchColumns: string[];
  search: string;
}): Promise<string[]> {
  const search = searchFilter(options.searchColumns, options.search);
  const { data, error } = await fetchAllRows<{ id: string }>((from, to) => {
    let query = supabase.from(options.source).select("id");
    for (const [column, value] of activeFilters(options.filters)) {
      query = query.eq(column, value);
    }
    if (search) query = query.or(search);
    return query.order("id").range(from, to);
  });
  if (error) throw error;
  return data.map((row) => row.id);
}

export type MaterialStatusRow = {
  storeId: string;
  status: string;
  /** Miktar × birim fiyat */
  amount: number;
  currency: CurrencyCode;
};

/** Pano keşif grafiği: görülebilen bütün malzeme kalemlerinin durumu ve tutarı */
export async function fetchMaterialStatusRows(): Promise<MaterialStatusRow[]> {
  const { data, error } = await fetchAllRows<Record<string, unknown>>((from, to) =>
    supabase.from(MATERIALS_SOURCE).select("id, store_id, status, quantity, unit_price, currency").order("id").range(from, to)
  );
  if (error) throw error;
  return data.map((row) => ({
    storeId: String(row.store_id ?? ""),
    status: String(row.status ?? ""),
    amount: Number(row.quantity ?? 0) * Number(row.unit_price ?? 0),
    currency: normalizeCurrency(row.currency),
  }));
}

/** Pano iş planı eğrisi: görülebilen bütün iş planı kalemlerinin tarihleri ve ilerlemesi */
export async function fetchWorkPlanCurveRows(): Promise<
  { storeId: string; startDate: string; endDate: string; percentComplete: number }[]
> {
  const { data, error } = await fetchAllRows<Record<string, unknown>>((from, to) =>
    supabase
      .from(WORK_PLAN_SOURCE)
      .select("id, store_id, start_date, end_date, percent_complete, status")
      .order("id")
      .range(from, to)
  );
  if (error) throw error;
  return data.map((row) => {
    const item = mapWorkPlanFromDb(row);
    return { storeId: item.storeId, startDate: item.startDate, endDate: item.endDate, percentComplete: item.percentComplete };
  });
}

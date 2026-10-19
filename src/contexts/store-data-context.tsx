"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { useAuth } from "@/contexts/auth-context";
import { useDb } from "@/contexts/db-context";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/activity-log";
import { isAllowedFileType } from "@/lib/file-types";
import { chunk } from "@/lib/supabase-query";
import { fetchStoreSummary, fetchStoreWorkPlan } from "@/lib/store-details";
import type { ParsedMaterialRow } from "@/lib/excel-materials";
import type { ParsedWorkPlanPredecessor, ParsedWorkPlanRow } from "@/lib/excel-work-plan";
import type {
  StoreFile,
  StoreMaterial,
  StoreNote,
  StoreUserData,
  StoreWorkPlanItem,
  WorkPlanDependency,
} from "@/types";

type StoreDataContextValue = {
  getStoreData: (storeId: string) => StoreUserData;
  addNote: (storeId: string, content: string) => void;
  deleteNote: (storeId: string, noteId: string) => void;
  addFile: (storeId: string, file: File) => Promise<{ success: boolean; error?: string }>;
  deleteFile: (storeId: string, fileId: string) => void;
  /** Malzeme/iş planı her değiştiğinde artar; listeler bunu izleyip yeniden çeker */
  getDetailVersion: (storeId: string) => number;
  // Materials
  importMaterials: (
    storeId: string,
    rows: ParsedMaterialRow[],
    mode?: "append" | "replace"
  ) => Promise<number>;
  /** options.afterSeq verilirse kalem o sıradaki kalemin hemen altına eklenir */
  addMaterial: (
    storeId: string,
    material: Omit<StoreMaterial, "id" | "storeId" | "userId" | "importedAt" | "seq">,
    options?: { afterSeq?: number }
  ) => Promise<void>;
  updateMaterial: (
    storeId: string,
    materialId: string,
    updates: Partial<StoreMaterial>
  ) => Promise<void>;
  /** Tek veya çoklu silme */
  deleteMaterial: (storeId: string, materialIds: string | string[]) => Promise<void>;
  // Work Plan
  importWorkPlan: (
    storeId: string,
    rows: ParsedWorkPlanRow[],
    mode?: "append" | "replace"
  ) => Promise<number>;
  addWorkPlanItem: (
    storeId: string,
    item: Omit<StoreWorkPlanItem, "id" | "storeId" | "userId" | "importedAt">
  ) => Promise<void>;
  updateWorkPlanItem: (
    storeId: string,
    itemId: string,
    updates: Partial<StoreWorkPlanItem>
  ) => Promise<void>;
  /** Tek veya çoklu silme; silinenlere bağlı öncüller de temizlenir */
  deleteWorkPlanItem: (storeId: string, itemIds: string | string[]) => Promise<void>;
};

const StoreDataContext = createContext<StoreDataContextValue | null>(null);

const emptyData = (): StoreUserData => ({
  notes: [],
  files: [],
});

function materialToDb(m: StoreMaterial) {
  return {
    id: m.id,
    store_id: m.storeId,
    user_id: m.userId,
    name: m.name,
    quantity: m.quantity,
    unit: m.unit,
    unit_price: m.unitPrice,
    status: m.status,
    imported_at: m.importedAt,
  };
}

function workPlanToDb(w: StoreWorkPlanItem) {
  return {
    id: w.id,
    store_id: w.storeId,
    user_id: w.userId,
    description: w.description,
    start_date: w.startDate,
    end_date: w.endDate,
    responsible: w.responsible,
    status: w.status,
    source_task_id: w.sourceTaskId ?? null,
    activity_code: w.activityCode ?? null,
    wbs_code: w.wbsCode ?? null,
    percent_complete: w.percentComplete,
    predecessors: w.predecessors,
    imported_at: w.importedAt,
  };
}

/** Büyük içe aktarmalar tek istekte gönderilmez; sıra korunarak parça parça eklenir */
async function insertInChunks(table: string, rows: Record<string, unknown>[]) {
  for (const part of chunk(rows, 500)) {
    const { error } = await supabase.from(table).insert(part);
    if (error) throw error;
  }
}

async function deleteByIds(table: string, ids: string[]) {
  for (const part of chunk(ids)) {
    const { error } = await supabase.from(table).delete().in("id", part);
    if (error) throw error;
  }
}

export function StoreDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { storeData: data, setStoreData: setData, setStoreSummary } = useDb();
  const [detailVersions, setDetailVersions] = useState<Record<string, number>>({});

  const getDetailVersion = useCallback(
    (storeId: string) => detailVersions[storeId] ?? 0,
    [detailVersions]
  );

  /** Yazma sonrası: açık listeler yeniden çekilir, mağaza özeti tazelenir */
  const refreshDetails = useCallback(
    async (storeId: string) => {
      setDetailVersions((prev) => ({ ...prev, [storeId]: (prev[storeId] ?? 0) + 1 }));
      try {
        setStoreSummary(storeId, await fetchStoreSummary(storeId));
      } catch (err) {
        console.error("Mağaza özeti güncellenemedi:", err);
      }
    },
    [setStoreSummary]
  );

  const getStoreData = useCallback(
    (storeId: string): StoreUserData => data[storeId] ?? emptyData(),
    [data]
  );

  const addNote = useCallback(
    (storeId: string, content: string) => {
      if (!user) return;
      const note: StoreNote = {
        id: `note-${Date.now()}`,
        storeId,
        userId: user.id,
        userName: user.name,
        content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const current = data[storeId] ?? emptyData();
      setData({
        ...data,
        [storeId]: { ...current, notes: [...current.notes, note] },
      });

      supabase
        .from("store_notes")
        .insert({
          id: note.id,
          store_id: note.storeId,
          user_id: note.userId,
          user_name: note.userName,
          content: note.content,
          created_at: note.createdAt,
          updated_at: note.updatedAt,
        })
        .then(({ error }) => {
          if (error) console.error("Error inserting note:", error);
        });
      logActivity({
        category: "note",
        action: "create",
        message: `Not eklendi (${storeId})`,
        actorId: user.id,
        actorName: user.name,
        targetId: note.id,
        targetLabel: storeId,
      });
    },
    [user, data, setData]
  );

  const deleteNote = useCallback(
    (storeId: string, noteId: string) => {
      const current = data[storeId] ?? emptyData();
      setData({
        ...data,
        [storeId]: {
          ...current,
          notes: current.notes.filter((n) => n.id !== noteId),
        },
      });

      supabase
        .from("store_notes")
        .delete()
        .eq("id", noteId)
        .then(({ error }) => {
          if (error) console.error("Error deleting note:", error);
        });
      if (user) {
        logActivity({
          category: "note",
          action: "delete",
          message: `Not silindi (${storeId})`,
          actorId: user.id,
          actorName: user.name,
          targetId: noteId,
          targetLabel: storeId,
        });
      }
    },
    [data, setData, user]
  );

  const addFile = useCallback(
    async (storeId: string, file: File) => {
      if (!user) return { success: false, error: "Giriş gerekli" };
      if (!isAllowedFileType(file.name)) {
        return {
          success: false,
          error: "Desteklenmeyen dosya türü",
        };
      }

      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
        const filePath = `${storeId}/${fileName}`;

        // 1. Upload to Supabase Storage
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from("store-files")
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadErr) {
          throw uploadErr;
        }

        // 2. Get Public URL
        const { data: { publicUrl } } = supabase.storage
          .from("store-files")
          .getPublicUrl(filePath);

        const storeFile: StoreFile = {
          id: `file-${Date.now()}`,
          storeId,
          userId: user.id,
          userName: user.name,
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl: publicUrl,
          uploadedAt: new Date().toISOString(),
        };

        // 3. Update local state
        const current = data[storeId] ?? emptyData();
        const nextData = {
          ...data,
          [storeId]: { ...current, files: [...current.files, storeFile] },
        };
        setData(nextData);

        // 4. Save metadata to DB
        const { error: dbErr } = await supabase
          .from("store_files")
          .insert({
            id: storeFile.id,
            store_id: storeFile.storeId,
            user_id: storeFile.userId,
            user_name: storeFile.userName,
            name: storeFile.name,
            size: storeFile.size,
            type: storeFile.type,
            data_url: storeFile.dataUrl,
            uploaded_at: storeFile.uploadedAt,
          });

        if (dbErr) {
          throw dbErr;
        }

        logActivity({
          category: "file",
          action: "upload",
          message: `Dosya yüklendi: ${file.name}`,
          actorId: user.id,
          actorName: user.name,
          targetId: storeFile.id,
          targetLabel: storeId,
        });

        return { success: true };
      } catch (err: any) {
        console.error("File upload error:", err);
        return { success: false, error: err.message || "Dosya yüklenemedi" };
      }
    },
    [user, data, setData]
  );

  const deleteFile = useCallback(
    (storeId: string, fileId: string) => {
      const current = data[storeId] ?? emptyData();
      const fileToDelete = current.files.find((f) => f.id === fileId);

      setData({
        ...data,
        [storeId]: {
          ...current,
          files: current.files.filter((f) => f.id !== fileId),
        },
      });

      // Delete database row
      supabase
        .from("store_files")
        .delete()
        .eq("id", fileId)
        .then(({ error }) => {
          if (error) console.error("Error deleting file row:", error);
        });

      // Try deleting file object from Storage as well
      if (fileToDelete && fileToDelete.dataUrl) {
        try {
          const urlParts = fileToDelete.dataUrl.split("/public/store-files/");
          if (urlParts.length > 1) {
            const storagePath = decodeURIComponent(urlParts[1]);
            supabase.storage
              .from("store-files")
              .remove([storagePath])
              .then(({ error }) => {
                if (error) console.warn("Could not delete file from storage bucket:", error.message);
              });
          }
        } catch (storageErr) {
          console.warn("Storage deletion parsing error:", storageErr);
        }
      }
      if (user) {
        logActivity({
          category: "file",
          action: "delete",
          message: `Dosya silindi: ${fileToDelete?.name ?? fileId}`,
          actorId: user.id,
          actorName: user.name,
          targetId: fileId,
          targetLabel: storeId,
        });
      }
    },
    [data, setData, user]
  );

  const importMaterials = useCallback(
    async (
      storeId: string,
      rows: ParsedMaterialRow[],
      mode: "append" | "replace" = "replace"
    ) => {
      if (!user) return 0;
      const now = new Date().toISOString();
      const imported: StoreMaterial[] = rows.map((row, i) => ({
        id: `material-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`,
        storeId,
        userId: user.id,
        name: row.name,
        quantity: row.quantity,
        unit: row.unit,
        unitPrice: row.unitPrice,
        status: "bekleniyor",
        importedAt: now,
      }));

      try {
        if (mode === "replace") {
          const { error } = await supabase.from("store_materials").delete().eq("store_id", storeId);
          if (error) throw error;
        }
        // Satırlar dosyadaki sırayla eklenir; seq bu sırayı kalıcı kılar
        await insertInChunks("store_materials", imported.map(materialToDb));
      } catch (err) {
        console.error("Bulk materials insert error:", err);
        await refreshDetails(storeId);
        return 0;
      }

      logActivity({
        category: "material",
        action: "import",
        message: `Keşif ${mode === "replace" ? "içe aktarıldı" : "eklendi"}: ${imported.length} kalem (${storeId})`,
        actorId: user.id,
        actorName: user.name,
        targetId: storeId,
        targetLabel: storeId,
      });
      await refreshDetails(storeId);
      return imported.length;
    },
    [user, refreshDetails]
  );

  const addMaterial = useCallback(
    async (
      storeId: string,
      material: Omit<StoreMaterial, "id" | "storeId" | "userId" | "importedAt" | "seq">,
      options?: { afterSeq?: number }
    ) => {
      if (!user) return;
      const newMaterial: StoreMaterial = {
        ...material,
        id: `material-${Date.now()}`,
        storeId,
        userId: user.id,
        importedAt: new Date().toISOString(),
      };
      // Araya ekleme: sonraki kalemlerin sırası tek işlemde kaydırılır (veritabanı fonksiyonu)
      const { error } =
        options?.afterSeq !== undefined
          ? await supabase.rpc("insert_store_material_after", {
              p_id: newMaterial.id,
              p_store_id: storeId,
              p_after_seq: options.afterSeq,
              p_name: newMaterial.name,
              p_quantity: newMaterial.quantity,
              p_unit: newMaterial.unit,
              p_unit_price: newMaterial.unitPrice,
              p_status: newMaterial.status,
            })
          : await supabase.from("store_materials").insert(materialToDb(newMaterial));
      if (error) console.error("Error adding material:", error);
      await refreshDetails(storeId);
    },
    [user, refreshDetails]
  );

  const updateMaterial = useCallback(
    async (storeId: string, materialId: string, updates: Partial<StoreMaterial>) => {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;
      if (updates.unit !== undefined) dbUpdates.unit = updates.unit;
      if (updates.unitPrice !== undefined) dbUpdates.unit_price = updates.unitPrice;
      if (updates.status !== undefined) dbUpdates.status = updates.status;

      const { error } = await supabase
        .from("store_materials")
        .update(dbUpdates)
        .eq("id", materialId);
      if (error) console.error("Error updating material:", error);
      await refreshDetails(storeId);
    },
    [refreshDetails]
  );

  const deleteMaterial = useCallback(
    async (storeId: string, materialIds: string | string[]) => {
      const ids = [...new Set(Array.isArray(materialIds) ? materialIds : [materialIds])];
      if (ids.length === 0) return;
      try {
        await deleteByIds("store_materials", ids);
      } catch (err) {
        console.error("Error deleting material:", err);
      }
      if (user) {
        logActivity({
          category: "material",
          action: "delete",
          message:
            ids.length === 1
              ? `Keşif kalemi silindi (${storeId})`
              : `${ids.length} keşif kalemi silindi (${storeId})`,
          actorId: user.id,
          actorName: user.name,
          targetId: ids.length === 1 ? ids[0] : storeId,
          targetLabel: storeId,
        });
      }
      await refreshDetails(storeId);
    },
    [user, refreshDetails]
  );

  const importWorkPlan = useCallback(
    async (
      storeId: string,
      rows: ParsedWorkPlanRow[],
      mode: "append" | "replace" = "replace"
    ) => {
      if (!user) return 0;
      const now = new Date().toISOString();
      try {
        // Eklemede öncüller mevcut kalemlere de bağlanabilir
        const existing = mode === "append" ? await fetchStoreWorkPlan(storeId) : [];
        const importedIds = rows.map(
          (_, index) => `workplan-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`
        );
        const idBySourceTaskId = new Map(
          rows.flatMap((row, index) =>
            row.sourceTaskId ? [[row.sourceTaskId, importedIds[index]] as const] : []
          )
        );
        const imported: StoreWorkPlanItem[] = rows.map((row, index) => {
          const status = row.status || "yapilacak";
          const predecessors: WorkPlanDependency[] = (
            row.predecessorSourceIds ?? []
          ).flatMap((predecessor: ParsedWorkPlanPredecessor) => {
            const predecessorId =
              idBySourceTaskId.get(predecessor.sourceTaskId) ??
              existing.find((item) => item.sourceTaskId === predecessor.sourceTaskId)?.id;
            return predecessorId
              ? [{ predecessorId, type: predecessor.type, lagHours: predecessor.lagHours }]
              : [];
          });
          return {
            id: importedIds[index],
            storeId,
            userId: user.id,
            description: row.description,
            startDate: row.startDate,
            endDate: row.endDate,
            responsible: row.responsible,
            status,
            sourceTaskId: row.sourceTaskId,
            activityCode: row.activityCode,
            wbsCode: row.wbsCode,
            percentComplete:
              row.percentComplete ??
              (status === "tamamlandi" ? 100 : status === "devam_ediyor" ? 50 : 0),
            predecessors,
            importedAt: now,
          };
        });

        if (mode === "replace") {
          const { error } = await supabase.from("store_work_plan").delete().eq("store_id", storeId);
          if (error) throw error;
        }
        await insertInChunks("store_work_plan", imported.map(workPlanToDb));

        logActivity({
          category: "workplan",
          action: "import",
          message: `İş programı ${mode === "replace" ? "içe aktarıldı" : "eklendi"}: ${imported.length} satır (${storeId})`,
          actorId: user.id,
          actorName: user.name,
          targetId: storeId,
        });
        await refreshDetails(storeId);
        return imported.length;
      } catch (err) {
        console.error("Bulk work plan insert error:", err);
        await refreshDetails(storeId);
        return 0;
      }
    },
    [user, refreshDetails]
  );

  const addWorkPlanItem = useCallback(
    async (
      storeId: string,
      item: Omit<StoreWorkPlanItem, "id" | "storeId" | "userId" | "importedAt">
    ) => {
      if (!user) return;
      const newItem: StoreWorkPlanItem = {
        ...item,
        id: `workplan-${Date.now()}`,
        storeId,
        userId: user.id,
        importedAt: new Date().toISOString(),
      };
      const { error } = await supabase.from("store_work_plan").insert(workPlanToDb(newItem));
      if (error) console.error("Error adding work plan item:", error);
      await refreshDetails(storeId);
    },
    [user, refreshDetails]
  );

  const updateWorkPlanItem = useCallback(
    async (storeId: string, itemId: string, updates: Partial<StoreWorkPlanItem>) => {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
      if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;
      if (updates.responsible !== undefined) dbUpdates.responsible = updates.responsible;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.sourceTaskId !== undefined) dbUpdates.source_task_id = updates.sourceTaskId || null;
      if (updates.activityCode !== undefined) dbUpdates.activity_code = updates.activityCode || null;
      if (updates.wbsCode !== undefined) dbUpdates.wbs_code = updates.wbsCode || null;
      if (updates.percentComplete !== undefined) dbUpdates.percent_complete = updates.percentComplete;
      if (updates.predecessors !== undefined) dbUpdates.predecessors = updates.predecessors;

      const { error } = await supabase
        .from("store_work_plan")
        .update(dbUpdates)
        .eq("id", itemId);
      if (error) console.error("Error updating work plan item:", error);
      await refreshDetails(storeId);
    },
    [refreshDetails]
  );

  const deleteWorkPlanItem = useCallback(
    async (storeId: string, itemIds: string | string[]) => {
      const ids = new Set(Array.isArray(itemIds) ? itemIds : [itemIds]);
      if (ids.size === 0) return;
      try {
        await deleteByIds("store_work_plan", [...ids]);
        // Silinen kalemlere bağlı öncül referanslarını kalan kalemlerden temizle
        const remaining = await fetchStoreWorkPlan(storeId);
        for (const item of remaining) {
          if (!item.predecessors.some((p) => ids.has(p.predecessorId))) continue;
          const { error } = await supabase
            .from("store_work_plan")
            .update({
              predecessors: item.predecessors.filter((p) => !ids.has(p.predecessorId)),
            })
            .eq("id", item.id);
          if (error) console.error("Error updating work plan predecessors:", error);
        }
      } catch (err) {
        console.error("Error deleting work plan item:", err);
      }
      if (user) {
        logActivity({
          category: "workplan",
          action: "delete",
          message:
            ids.size === 1
              ? `İş programı kalemi silindi (${storeId})`
              : `${ids.size} iş programı kalemi silindi (${storeId})`,
          actorId: user.id,
          actorName: user.name,
          targetId: ids.size === 1 ? [...ids][0] : storeId,
          targetLabel: storeId,
        });
      }
      await refreshDetails(storeId);
    },
    [user, refreshDetails]
  );

  return (
    <StoreDataContext.Provider
      value={{
        getStoreData,
        getDetailVersion,
        addNote,
        deleteNote,
        addFile,
        deleteFile,
        importMaterials,
        addMaterial,
        updateMaterial,
        deleteMaterial,
        importWorkPlan,
        addWorkPlanItem,
        updateWorkPlanItem,
        deleteWorkPlanItem,
      }}
    >
      {children}
    </StoreDataContext.Provider>
  );
}

export function useStoreData() {
  const ctx = useContext(StoreDataContext);
  if (!ctx)
    throw new Error("useStoreData must be used within StoreDataProvider");
  return ctx;
}

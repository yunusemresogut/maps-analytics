"use client";

import {
  createContext,
  useCallback,
  useContext,
} from "react";
import { useAuth } from "@/contexts/auth-context";
import { useDb } from "@/contexts/db-context";
import { supabase } from "@/lib/supabase";
import { isAllowedFileType } from "@/lib/file-types";
import type { ParsedMaterialRow } from "@/lib/excel-materials";
import type { ParsedWorkPlanRow } from "@/lib/excel-work-plan";
import type {
  StoreFile,
  StoreMaterial,
  StoreNote,
  StoreUserData,
  StoreWorkPlanItem,
} from "@/types";

type StoreDataContextValue = {
  getStoreData: (storeId: string) => StoreUserData;
  addNote: (storeId: string, content: string) => void;
  deleteNote: (storeId: string, noteId: string) => void;
  updateSpecialNote: (storeId: string, note: string) => void;
  addFile: (storeId: string, file: File) => Promise<{ success: boolean; error?: string }>;
  deleteFile: (storeId: string, fileId: string) => void;
  // Materials
  importMaterials: (
    storeId: string,
    rows: ParsedMaterialRow[],
    mode?: "append" | "replace"
  ) => Promise<number>;
  addMaterial: (
    storeId: string,
    material: Omit<StoreMaterial, "id" | "storeId" | "userId" | "importedAt">
  ) => void;
  updateMaterial: (
    storeId: string,
    materialId: string,
    updates: Partial<StoreMaterial>
  ) => void;
  deleteMaterial: (storeId: string, materialId: string) => void;
  clearMaterials: (storeId: string) => void;
  // Work Plan
  importWorkPlan: (
    storeId: string,
    rows: ParsedWorkPlanRow[],
    mode?: "append" | "replace"
  ) => Promise<number>;
  addWorkPlanItem: (
    storeId: string,
    item: Omit<StoreWorkPlanItem, "id" | "storeId" | "userId" | "importedAt">
  ) => void;
  updateWorkPlanItem: (
    storeId: string,
    itemId: string,
    updates: Partial<StoreWorkPlanItem>
  ) => void;
  deleteWorkPlanItem: (storeId: string, itemId: string) => void;
  clearWorkPlan: (storeId: string) => void;
};

const StoreDataContext = createContext<StoreDataContextValue | null>(null);

const emptyData = (): StoreUserData => ({
  notes: [],
  files: [],
  materials: [],
  workPlan: [],
  specialNote: "",
});

export function StoreDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { storeData: data, setStoreData: setData } = useDb();

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
    },
    [data, setData]
  );

  const updateSpecialNote = useCallback(
    (storeId: string, note: string) => {
      const current = data[storeId] ?? emptyData();
      setData({
        ...data,
        [storeId]: { ...current, specialNote: note },
      });

      supabase
        .from("stores")
        .update({ special_note: note })
        .eq("id", storeId)
        .then(({ error }) => {
          if (error) console.error("Error updating special note:", error);
        });
    },
    [data, setData]
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
    },
    [data, setData]
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

      const current = data[storeId] ?? emptyData();
      const materials =
        mode === "append"
          ? [...current.materials, ...imported]
          : imported;

      setData({
        ...data,
        [storeId]: { ...current, materials },
      });

      try {
        if (mode === "replace") {
          // Clear existing materials in Supabase first
          await supabase.from("store_materials").delete().eq("store_id", storeId);
        }

        // Insert new ones in bulk
        const dbRows = imported.map((m) => ({
          id: m.id,
          store_id: m.storeId,
          user_id: m.userId,
          name: m.name,
          quantity: m.quantity,
          unit: m.unit,
          unit_price: m.unitPrice,
          status: m.status,
          imported_at: m.importedAt,
        }));

        const { error } = await supabase.from("store_materials").insert(dbRows);
        if (error) throw error;
      } catch (err) {
        console.error("Bulk materials insert error:", err);
      }

      return imported.length;
    },
    [user, data, setData]
  );

  const addMaterial = useCallback(
    (
      storeId: string,
      material: Omit<StoreMaterial, "id" | "storeId" | "userId" | "importedAt">
    ) => {
      if (!user) return;
      const now = new Date().toISOString();
      const newMaterial: StoreMaterial = {
        ...material,
        id: `material-${Date.now()}`,
        storeId,
        userId: user.id,
        importedAt: now,
      };
      const current = data[storeId] ?? emptyData();
      setData({
        ...data,
        [storeId]: {
          ...current,
          materials: [...current.materials, newMaterial],
        },
      });

      supabase
        .from("store_materials")
        .insert({
          id: newMaterial.id,
          store_id: newMaterial.storeId,
          user_id: newMaterial.userId,
          name: newMaterial.name,
          quantity: newMaterial.quantity,
          unit: newMaterial.unit,
          unit_price: newMaterial.unitPrice,
          status: newMaterial.status,
          imported_at: newMaterial.importedAt,
        })
        .then(({ error }) => {
          if (error) console.error("Error adding material:", error);
        });
    },
    [user, data, setData]
  );

  const updateMaterial = useCallback(
    (
      storeId: string,
      materialId: string,
      updates: Partial<StoreMaterial>
    ) => {
      const current = data[storeId] ?? emptyData();
      setData({
        ...data,
        [storeId]: {
          ...current,
          materials: current.materials.map((m) =>
            m.id === materialId ? { ...m, ...updates } : m
          ),
        },
      });

      // Map to db columns
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;
      if (updates.unit !== undefined) dbUpdates.unit = updates.unit;
      if (updates.unitPrice !== undefined) dbUpdates.unit_price = updates.unitPrice;
      if (updates.status !== undefined) dbUpdates.status = updates.status;

      supabase
        .from("store_materials")
        .update(dbUpdates)
        .eq("id", materialId)
        .then(({ error }) => {
          if (error) console.error("Error updating material:", error);
        });
    },
    [data, setData]
  );

  const deleteMaterial = useCallback(
    (storeId: string, materialId: string) => {
      const current = data[storeId] ?? emptyData();
      setData({
        ...data,
        [storeId]: {
          ...current,
          materials: current.materials.filter((m) => m.id !== materialId),
        },
      });

      supabase
        .from("store_materials")
        .delete()
        .eq("id", materialId)
        .then(({ error }) => {
          if (error) console.error("Error deleting material:", error);
        });
    },
    [data, setData]
  );

  const clearMaterials = useCallback(
    (storeId: string) => {
      const current = data[storeId] ?? emptyData();
      setData({
        ...data,
        [storeId]: { ...current, materials: [] },
      });

      supabase
        .from("store_materials")
        .delete()
        .eq("store_id", storeId)
        .then(({ error }) => {
          if (error) console.error("Error clearing materials:", error);
        });
    },
    [data, setData]
  );

  const importWorkPlan = useCallback(
    async (
      storeId: string,
      rows: ParsedWorkPlanRow[],
      mode: "append" | "replace" = "replace"
    ) => {
      if (!user) return 0;
      const now = new Date().toISOString();
      const imported: StoreWorkPlanItem[] = rows.map((row, i) => ({
        id: `workplan-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`,
        storeId,
        userId: user.id,
        description: row.description,
        startDate: row.startDate,
        endDate: row.endDate,
        responsible: row.responsible,
        status: row.status || "yapilacak",
        importedAt: now,
      }));

      const current = data[storeId] ?? emptyData();
      const workPlan =
        mode === "append" ? [...current.workPlan, ...imported] : imported;

      setData({
        ...data,
        [storeId]: { ...current, workPlan },
      });

      try {
        if (mode === "replace") {
          // Clear existing work plan items in Supabase first
          await supabase.from("store_work_plan").delete().eq("store_id", storeId);
        }

        // Insert new ones in bulk
        const dbRows = imported.map((wp) => ({
          id: wp.id,
          store_id: wp.storeId,
          user_id: wp.userId,
          description: wp.description,
          start_date: wp.startDate,
          end_date: wp.endDate,
          responsible: wp.responsible,
          status: wp.status,
          imported_at: wp.importedAt,
        }));

        const { error } = await supabase.from("store_work_plan").insert(dbRows);
        if (error) throw error;
      } catch (err) {
        console.error("Bulk work plan insert error:", err);
      }

      return imported.length;
    },
    [user, data, setData]
  );

  const addWorkPlanItem = useCallback(
    (
      storeId: string,
      item: Omit<StoreWorkPlanItem, "id" | "storeId" | "userId" | "importedAt">
    ) => {
      if (!user) return;
      const now = new Date().toISOString();
      const newItem: StoreWorkPlanItem = {
        ...item,
        id: `workplan-${Date.now()}`,
        storeId,
        userId: user.id,
        importedAt: now,
      };
      const current = data[storeId] ?? emptyData();
      setData({
        ...data,
        [storeId]: {
          ...current,
          workPlan: [...current.workPlan, newItem],
        },
      });

      supabase
        .from("store_work_plan")
        .insert({
          id: newItem.id,
          store_id: newItem.storeId,
          user_id: newItem.userId,
          description: newItem.description,
          start_date: newItem.startDate,
          end_date: newItem.endDate,
          responsible: newItem.responsible,
          status: newItem.status,
          imported_at: newItem.importedAt,
        })
        .then(({ error }) => {
          if (error) console.error("Error adding work plan item:", error);
        });
    },
    [user, data, setData]
  );

  const updateWorkPlanItem = useCallback(
    (
      storeId: string,
      itemId: string,
      updates: Partial<StoreWorkPlanItem>
    ) => {
      const current = data[storeId] ?? emptyData();
      setData({
        ...data,
        [storeId]: {
          ...current,
          workPlan: current.workPlan.map((w) =>
            w.id === itemId ? { ...w, ...updates } : w
          ),
        },
      });

      // Map to db columns
      const dbUpdates: any = {};
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
      if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;
      if (updates.responsible !== undefined) dbUpdates.responsible = updates.responsible;
      if (updates.status !== undefined) dbUpdates.status = updates.status;

      supabase
        .from("store_work_plan")
        .update(dbUpdates)
        .eq("id", itemId)
        .then(({ error }) => {
          if (error) console.error("Error updating work plan item:", error);
        });
    },
    [data, setData]
  );

  const deleteWorkPlanItem = useCallback(
    (storeId: string, itemId: string) => {
      const current = data[storeId] ?? emptyData();
      setData({
        ...data,
        [storeId]: {
          ...current,
          workPlan: current.workPlan.filter((w) => w.id !== itemId),
        },
      });

      supabase
        .from("store_work_plan")
        .delete()
        .eq("id", itemId)
        .then(({ error }) => {
          if (error) console.error("Error deleting work plan item:", error);
        });
    },
    [data, setData]
  );

  const clearWorkPlan = useCallback(
    (storeId: string) => {
      const current = data[storeId] ?? emptyData();
      setData({
        ...data,
        [storeId]: { ...current, workPlan: [] },
      });

      supabase
        .from("store_work_plan")
        .delete()
        .eq("store_id", storeId)
        .then(({ error }) => {
          if (error) console.error("Error clearing work plan:", error);
        });
    },
    [data, setData]
  );

  return (
    <StoreDataContext.Provider
      value={{
        getStoreData,
        addNote,
        deleteNote,
        updateSpecialNote,
        addFile,
        deleteFile,
        importMaterials,
        addMaterial,
        updateMaterial,
        deleteMaterial,
        clearMaterials,
        importWorkPlan,
        addWorkPlanItem,
        updateWorkPlanItem,
        deleteWorkPlanItem,
        clearWorkPlan,
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

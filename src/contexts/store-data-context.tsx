"use client";

import {
  createContext,
  useCallback,
  useContext,
} from "react";
import { useAuth } from "@/contexts/auth-context";
import { useDb } from "@/contexts/db-context";
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
  ) => number;
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
  ) => number;
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

  const persist = useCallback(
    (next: Record<string, StoreUserData>) => {
      setData(next);
    },
    [setData]
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
      persist({
        ...data,
        [storeId]: { ...current, notes: [...current.notes, note] },
      });
    },
    [user, data, persist]
  );

  const deleteNote = useCallback(
    (storeId: string, noteId: string) => {
      const current = data[storeId] ?? emptyData();
      persist({
        ...data,
        [storeId]: {
          ...current,
          notes: current.notes.filter((n) => n.id !== noteId),
        },
      });
    },
    [data, persist]
  );

  const updateSpecialNote = useCallback(
    (storeId: string, note: string) => {
      const current = data[storeId] ?? emptyData();
      persist({
        ...data,
        [storeId]: { ...current, specialNote: note },
      });
    },
    [data, persist]
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

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const storeFile: StoreFile = {
        id: `file-${Date.now()}`,
        storeId,
        userId: user.id,
        userName: user.name,
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl,
        uploadedAt: new Date().toISOString(),
      };

      const current = data[storeId] ?? emptyData();
      persist({
        ...data,
        [storeId]: { ...current, files: [...current.files, storeFile] },
      });
      return { success: true };
    },
    [user, data, persist]
  );

  const deleteFile = useCallback(
    (storeId: string, fileId: string) => {
      const current = data[storeId] ?? emptyData();
      persist({
        ...data,
        [storeId]: {
          ...current,
          files: current.files.filter((f) => f.id !== fileId),
        },
      });
    },
    [data, persist]
  );

  const importMaterials = useCallback(
    (
      storeId: string,
      rows: ParsedMaterialRow[],
      mode: "append" | "replace" = "replace"
    ) => {
      if (!user) return 0;
      const now = new Date().toISOString();
      const imported: StoreMaterial[] = rows.map((row, i) => ({
        id: `material-${Date.now()}-${i}`,
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

      persist({
        ...data,
        [storeId]: { ...current, materials },
      });

      return imported.length;
    },
    [user, data, persist]
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
      persist({
        ...data,
        [storeId]: {
          ...current,
          materials: [...current.materials, newMaterial],
        },
      });
    },
    [user, data, persist]
  );

  const updateMaterial = useCallback(
    (
      storeId: string,
      materialId: string,
      updates: Partial<StoreMaterial>
    ) => {
      const current = data[storeId] ?? emptyData();
      persist({
        ...data,
        [storeId]: {
          ...current,
          materials: current.materials.map((m) =>
            m.id === materialId ? { ...m, ...updates } : m
          ),
        },
      });
    },
    [data, persist]
  );

  const deleteMaterial = useCallback(
    (storeId: string, materialId: string) => {
      const current = data[storeId] ?? emptyData();
      persist({
        ...data,
        [storeId]: {
          ...current,
          materials: current.materials.filter((m) => m.id !== materialId),
        },
      });
    },
    [data, persist]
  );

  const clearMaterials = useCallback(
    (storeId: string) => {
      const current = data[storeId] ?? emptyData();
      persist({
        ...data,
        [storeId]: { ...current, materials: [] },
      });
    },
    [data, persist]
  );

  const importWorkPlan = useCallback(
    (
      storeId: string,
      rows: ParsedWorkPlanRow[],
      mode: "append" | "replace" = "replace"
    ) => {
      if (!user) return 0;
      const now = new Date().toISOString();
      const imported: StoreWorkPlanItem[] = rows.map((row, i) => ({
        id: `workplan-${Date.now()}-${i}`,
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

      persist({
        ...data,
        [storeId]: { ...current, workPlan },
      });

      return imported.length;
    },
    [user, data, persist]
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
      persist({
        ...data,
        [storeId]: {
          ...current,
          workPlan: [...current.workPlan, newItem],
        },
      });
    },
    [user, data, persist]
  );

  const updateWorkPlanItem = useCallback(
    (
      storeId: string,
      itemId: string,
      updates: Partial<StoreWorkPlanItem>
    ) => {
      const current = data[storeId] ?? emptyData();
      persist({
        ...data,
        [storeId]: {
          ...current,
          workPlan: current.workPlan.map((w) =>
            w.id === itemId ? { ...w, ...updates } : w
          ),
        },
      });
    },
    [data, persist]
  );

  const deleteWorkPlanItem = useCallback(
    (storeId: string, itemId: string) => {
      const current = data[storeId] ?? emptyData();
      persist({
        ...data,
        [storeId]: {
          ...current,
          workPlan: current.workPlan.filter((w) => w.id !== itemId),
        },
      });
    },
    [data, persist]
  );

  const clearWorkPlan = useCallback(
    (storeId: string) => {
      const current = data[storeId] ?? emptyData();
      persist({
        ...data,
        [storeId]: { ...current, workPlan: [] },
      });
    },
    [data, persist]
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

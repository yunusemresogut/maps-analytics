"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAuth } from "@/contexts/auth-context";
import { isAllowedFileType } from "@/lib/file-types";
import type { ParsedMaterialRow } from "@/lib/excel-materials";
import type { ParsedWorkPlanRow } from "@/lib/excel-work-plan";
import { getStoreDataKey } from "@/lib/storage-keys";
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
  importMaterials: (
    storeId: string,
    rows: ParsedMaterialRow[],
    mode?: "append" | "replace"
  ) => number;
  deleteMaterial: (storeId: string, materialId: string) => void;
  clearMaterials: (storeId: string) => void;
  importWorkPlan: (
    storeId: string,
    rows: ParsedWorkPlanRow[],
    mode?: "append" | "replace"
  ) => number;
  deleteWorkPlanItem: (storeId: string, itemId: string) => void;
  clearWorkPlan: (storeId: string) => void;
};

const StoreDataContext = createContext<StoreDataContextValue | null>(null);

function loadAll(userId: string): Record<string, StoreUserData> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(getStoreDataKey(userId));
  if (!raw) return {};

  const parsed = JSON.parse(raw) as Record<
    string,
    StoreUserData & { customFields?: Record<string, string> }
  >;
  const migrated: Record<string, StoreUserData> = {};

  for (const [id, entry] of Object.entries(parsed)) {
    migrated[id] = {
      notes: (entry.notes ?? []).map((n) => ({
        ...n,
        userName: n.userName ?? "Bilinmeyen",
      })),
      files: (entry.files ?? []).map((f) => ({
        ...f,
        userName: f.userName ?? "Bilinmeyen",
      })),
      materials: (entry.materials ?? []).map((m) => ({
        ...m,
        unit: m.unit ?? "",
      })),
      workPlan: entry.workPlan ?? [],
      specialNote: entry.specialNote ?? entry.customFields?.responsible ?? "",
    };
  }

  return migrated;
}

function saveAll(userId: string, data: Record<string, StoreUserData>) {
  localStorage.setItem(getStoreDataKey(userId), JSON.stringify(data));
}

const emptyData = (): StoreUserData => ({
  notes: [],
  files: [],
  materials: [],
  workPlan: [],
  specialNote: "",
});

export function StoreDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [data, setData] = useState<Record<string, StoreUserData>>({});

  useEffect(() => {
    if (user) {
      setData(loadAll(user.id));
    } else {
      setData({});
    }
  }, [user]);

  const persist = useCallback(
    (next: Record<string, StoreUserData>) => {
      if (!user) return;
      setData(next);
      saveAll(user.id, next);
    },
    [user]
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
        status: row.status,
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
        deleteMaterial,
        clearMaterials,
        importWorkPlan,
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

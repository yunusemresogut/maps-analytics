"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAuth } from "@/contexts/auth-context";
import type { StoreFile, StoreNote, StoreUserData } from "@/types";

type StoreDataContextValue = {
  getStoreData: (storeId: string) => StoreUserData;
  addNote: (storeId: string, content: string) => void;
  deleteNote: (storeId: string, noteId: string) => void;
  updateSpecialNote: (storeId: string, note: string) => void;
  addFile: (storeId: string, file: File) => Promise<void>;
  deleteFile: (storeId: string, fileId: string) => void;
};

const StoreDataContext = createContext<StoreDataContextValue | null>(null);

const DATA_KEY = "lcw-map-store-data";

function storageKey(userId: string) {
  return `${DATA_KEY}:${userId}`;
}

function loadAll(userId: string): Record<string, StoreUserData> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(storageKey(userId));
  if (!raw) return {};

  const parsed = JSON.parse(raw) as Record<string, StoreUserData & { customFields?: Record<string, string> }>;
  const migrated: Record<string, StoreUserData> = {};

  for (const [id, entry] of Object.entries(parsed)) {
    migrated[id] = {
      notes: entry.notes ?? [],
      files: entry.files ?? [],
      specialNote: entry.specialNote ?? entry.customFields?.responsible ?? "",
    };
  }

  return migrated;
}

function saveAll(userId: string, data: Record<string, StoreUserData>) {
  localStorage.setItem(storageKey(userId), JSON.stringify(data));
}

const emptyData = (): StoreUserData => ({
  notes: [],
  files: [],
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
        content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const current = data[storeId] ?? emptyData();
      persist({ ...data, [storeId]: { ...current, notes: [...current.notes, note] } });
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
      if (!user) return;
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

  return (
    <StoreDataContext.Provider
      value={{
        getStoreData,
        addNote,
        deleteNote,
        updateSpecialNote,
        addFile,
        deleteFile,
      }}
    >
      {children}
    </StoreDataContext.Provider>
  );
}

export function useStoreData() {
  const ctx = useContext(StoreDataContext);
  if (!ctx) throw new Error("useStoreData must be used within StoreDataProvider");
  return ctx;
}

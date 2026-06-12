"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { demoStores } from "@/data/stores";
import { migrateStore } from "@/lib/migrations";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import type { Store, StoreInput } from "@/types";

type StoresContextValue = {
  stores: Store[];
  addStore: (
    store: StoreInput,
    meta: { userId: string; userName: string }
  ) => Store;
  updateStore: (
    id: string,
    data: Partial<Store>,
    meta?: { userId: string; userName: string }
  ) => void;
  deleteStore: (id: string) => void;
  getStore: (id: string) => Store | undefined;
};

const StoresContext = createContext<StoresContextValue | null>(null);

function loadStores(): Store[] {
  if (typeof window === "undefined") return demoStores;
  const stored = localStorage.getItem(STORAGE_KEYS.stores);
  if (stored) {
    return (JSON.parse(stored) as Record<string, unknown>[]).map(migrateStore);
  }
  localStorage.setItem(STORAGE_KEYS.stores, JSON.stringify(demoStores));
  return demoStores;
}

function saveStores(stores: Store[]) {
  localStorage.setItem(STORAGE_KEYS.stores, JSON.stringify(stores));
}

export function StoresProvider({ children }: { children: React.ReactNode }) {
  const [stores, setStores] = useState<Store[]>(demoStores);

  useEffect(() => {
    setStores(loadStores());
  }, []);

  const persist = useCallback((next: Store[]) => {
    setStores(next);
    saveStores(next);
  }, []);

  const addStore = useCallback(
    (data: StoreInput, meta: { userId: string; userName: string }) => {
      const now = new Date().toISOString();
      const store: Store = {
        ...data,
        id: `custom-${Date.now()}`,
        isCustom: true,
        createdBy: meta.userId,
        createdByName: meta.userName,
        createdAt: now,
      };
      const next = [...stores, store];
      persist(next);
      return store;
    },
    [stores, persist]
  );

  const updateStore = useCallback(
    (
      id: string,
      data: Partial<Store>,
      meta?: { userId: string; userName: string }
    ) => {
      const now = new Date().toISOString();
      const next = stores.map((s) => {
        if (s.id !== id) return s;
        return {
          ...s,
          ...data,
          ...(meta
            ? {
                updatedBy: meta.userId,
                updatedByName: meta.userName,
                updatedAt: now,
              }
            : {}),
        };
      });
      persist(next);
    },
    [stores, persist]
  );

  const deleteStore = useCallback(
    (id: string) => {
      persist(stores.filter((s) => s.id !== id));
    },
    [stores, persist]
  );

  const getStore = useCallback(
    (id: string) => stores.find((s) => s.id === id),
    [stores]
  );

  return (
    <StoresContext.Provider
      value={{ stores, addStore, updateStore, deleteStore, getStore }}
    >
      {children}
    </StoresContext.Provider>
  );
}

export function useStores() {
  const ctx = useContext(StoresContext);
  if (!ctx) throw new Error("useStores must be used within StoresProvider");
  return ctx;
}

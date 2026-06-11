"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { lcwStores } from "@/data/stores";
import type { Store } from "@/types";

type StoresContextValue = {
  stores: Store[];
  addStore: (store: Omit<Store, "id" | "isCustom">) => Store;
  updateStore: (id: string, data: Partial<Store>) => void;
  deleteStore: (id: string) => void;
  getStore: (id: string) => Store | undefined;
};

const StoresContext = createContext<StoresContextValue | null>(null);

const STORES_KEY = "lcw-map-stores-v2";

function loadStores(): Store[] {
  if (typeof window === "undefined") return lcwStores;
  const stored = localStorage.getItem(STORES_KEY);
  if (stored) return JSON.parse(stored);
  localStorage.setItem(STORES_KEY, JSON.stringify(lcwStores));
  return lcwStores;
}

function saveStores(stores: Store[]) {
  localStorage.setItem(STORES_KEY, JSON.stringify(stores));
}

export function StoresProvider({ children }: { children: React.ReactNode }) {
  const [stores, setStores] = useState<Store[]>(lcwStores);

  useEffect(() => {
    setStores(loadStores());
  }, []);

  const persist = useCallback((next: Store[]) => {
    setStores(next);
    saveStores(next);
  }, []);

  const addStore = useCallback(
    (data: Omit<Store, "id" | "isCustom">) => {
      const store: Store = {
        ...data,
        id: `custom-${Date.now()}`,
        isCustom: true,
      };
      const next = [...stores, store];
      persist(next);
      return store;
    },
    [stores, persist]
  );

  const updateStore = useCallback(
    (id: string, data: Partial<Store>) => {
      const next = stores.map((s) => (s.id === id ? { ...s, ...data } : s));
      persist(next);
    },
    [stores, persist]
  );

  const deleteStore = useCallback(
    (id: string) => {
      const store = stores.find((s) => s.id === id);
      if (!store?.isCustom) return;
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

"use client";

import {
  createContext,
  useCallback,
  useContext,
} from "react";
import { useDb } from "@/contexts/db-context";
import { appendActivityLog } from "@/lib/activity-log";
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

export function StoresProvider({ children }: { children: React.ReactNode }) {
  const { stores, setStores } = useDb();

  const persist = useCallback(
    (next: Store[]) => {
      setStores(next);
    },
    [setStores]
  );

  const addStore = useCallback(
    (data: StoreInput, meta: { userId: string; userName: string }) => {
      const now = new Date().toISOString();
      const store: Store = {
        totalBudget: 1500000,
        ...data,
        id: `custom-${Date.now()}`,
        isCustom: true,
        createdBy: meta.userId,
        createdByName: meta.userName,
        createdAt: now,
      };
      const next = [...stores, store];
      persist(next);
      appendActivityLog({
        category: "store",
        action: "create",
        message: `Yeni konum eklendi: ${store.name}`,
        actorId: meta.userId,
        actorName: meta.userName,
        targetId: store.id,
        targetLabel: store.name,
      });
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
      const target = stores.find((s) => s.id === id);
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
      if (target) {
        appendActivityLog({
          category: "store",
          action: "update",
          message: `Konum güncellendi: ${target.name}`,
          actorId: meta?.userId,
          actorName: meta?.userName,
          targetId: id,
          targetLabel: target.name,
        });
      }
    },
    [stores, persist]
  );

  const deleteStore = useCallback(
    (id: string) => {
      const target = stores.find((s) => s.id === id);
      persist(stores.filter((s) => s.id !== id));
      if (target) {
        appendActivityLog({
          category: "store",
          action: "delete",
          message: `Konum silindi: ${target.name}`,
          targetId: id,
          targetLabel: target.name,
        });
      }
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

"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Store, StoreUserData } from "@/types";

type DbContextType = {
  stores: Store[];
  storeData: Record<string, StoreUserData>;
  setStores: (stores: Store[]) => Promise<void>;
  setStoreData: (storeData: Record<string, StoreUserData>) => Promise<void>;
  isLoading: boolean;
  refetch: () => Promise<void>;
};

const DbContext = createContext<DbContextType | null>(null);

export function DbProvider({ children }: { children: React.ReactNode }) {
  const [stores, setStoresState] = useState<Store[]>([]);
  const [storeData, setStoreDataState] = useState<Record<string, StoreUserData>>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      const response = await fetch("/api/db");
      if (response.ok) {
        const data = await response.json();
        setStoresState(data.stores ?? []);
        setStoreDataState(data.storeData ?? {});
      }
    } catch (err) {
      console.error("Veritabanı yüklenirken hata oluştu:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const saveToDb = async (nextStores: Store[], nextStoreData: Record<string, StoreUserData>) => {
    try {
      await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stores: nextStores, storeData: nextStoreData }),
      });
    } catch (err) {
      console.error("Veritabanı kaydedilirken hata oluştu:", err);
    }
  };

  const setStores = async (nextStores: Store[]) => {
    setStoresState(nextStores);
    await saveToDb(nextStores, storeData);
  };

  const setStoreData = async (nextStoreData: Record<string, StoreUserData>) => {
    setStoreDataState(nextStoreData);
    await saveToDb(stores, nextStoreData);
  };

  return (
    <DbContext.Provider
      value={{
        stores,
        storeData,
        setStores,
        setStoreData,
        isLoading,
        refetch: fetchData,
      }}
    >
      {isLoading ? (
        <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-200">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
            <p className="text-sm font-medium text-zinc-400">Veriler yükleniyor...</p>
          </div>
        </div>
      ) : (
        children
      )}
    </DbContext.Provider>
  );
}

export function useDb() {
  const context = useContext(DbContext);
  if (!context) {
    throw new Error("useDb must be used within a DbProvider");
  }
  return context;
}

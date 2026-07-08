"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Store, StoreUserData, User, ActivityLogEntry } from "@/types";

type DbContextType = {
  stores: Store[];
  storeData: Record<string, StoreUserData>;
  users: (User & { password: string })[];
  activityLogs: ActivityLogEntry[];
  setStores: (stores: Store[]) => Promise<void>;
  setStoreData: (storeData: Record<string, StoreUserData>) => Promise<void>;
  setUsers: (users: (User & { password: string })[]) => Promise<void>;
  setActivityLogs: (activityLogs: ActivityLogEntry[]) => Promise<void>;
  isLoading: boolean;
  refetch: () => Promise<void>;
};

const DbContext = createContext<DbContextType | null>(null);

export function DbProvider({ children }: { children: React.ReactNode }) {
  const [stores, setStoresState] = useState<Store[]>([]);
  const [storeData, setStoreDataState] = useState<Record<string, StoreUserData>>({});
  const [users, setUsersState] = useState<(User & { password: string })[]>([]);
  const [activityLogs, setActivityLogsState] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      const response = await fetch("/api/db");
      if (response.ok) {
        const data = await response.json();
        setStoresState(data.stores ?? []);
        setStoreDataState(data.storeData ?? {});
        setUsersState(data.users ?? []);
        setActivityLogsState(data.activityLogs ?? []);
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

  const saveToDb = async (
    nextStores: Store[],
    nextStoreData: Record<string, StoreUserData>,
    nextUsers: (User & { password: string })[],
    nextActivityLogs: ActivityLogEntry[]
  ) => {
    try {
      await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stores: nextStores,
          storeData: nextStoreData,
          users: nextUsers,
          activityLogs: nextActivityLogs,
        }),
      });
    } catch (err) {
      console.error("Veritabanı kaydedilirken hata oluştu:", err);
    }
  };

  const setStores = async (nextStores: Store[]) => {
    setStoresState(nextStores);
    await saveToDb(nextStores, storeData, users, activityLogs);
  };

  const setStoreData = async (nextStoreData: Record<string, StoreUserData>) => {
    setStoreDataState(nextStoreData);
    await saveToDb(stores, nextStoreData, users, activityLogs);
  };

  const setUsers = async (nextUsers: (User & { password: string })[]) => {
    setUsersState(nextUsers);
    await saveToDb(stores, storeData, nextUsers, activityLogs);
  };

  const setActivityLogs = async (nextActivityLogs: ActivityLogEntry[]) => {
    setActivityLogsState(nextActivityLogs);
    await saveToDb(stores, storeData, users, nextActivityLogs);
  };

  return (
    <DbContext.Provider
      value={{
        stores,
        storeData,
        users,
        activityLogs,
        setStores,
        setStoreData,
        setUsers,
        setActivityLogs,
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

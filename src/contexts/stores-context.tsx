"use client";

import { createContext, useCallback, useContext } from "react";
import { useDb } from "@/contexts/db-context";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase";
import { appendActivityLog, logActivity } from "@/lib/activity-log";
import { approvalsToDb } from "@/lib/store-mapper";
import { emptyApprovals } from "@/types";
import type { ProjectApprovals, Store, StoreInput } from "@/types";

function describeStoreUpdate(
  prev: Store,
  data: Partial<Store>
): { category: "store" | "approval" | "budget"; action: string; message: string } {
  if (data.totalBudget !== undefined && data.totalBudget !== prev.totalBudget) {
    return {
      category: "budget",
      action: "update",
      message: `Bütçe güncellendi: ${prev.name} → ${data.totalBudget}`,
    };
  }

  if (data.approvals) {
    const next = data.approvals;
    const prevA = prev.approvals ?? emptyApprovals();

    if (next.projectOpened && !prevA.projectOpened) {
      return {
        category: "approval",
        action: "open",
        message: `Proje açıldı: ${prev.name}`,
      };
    }
    if (!next.projectOpened && prevA.projectOpened) {
      return {
        category: "approval",
        action: "close",
        message: `Proje kapatıldı: ${prev.name}`,
      };
    }

    const disciplines: Array<{
      key: keyof Pick<
        ProjectApprovals,
        "architectural" | "mechanical" | "electrical"
      >;
      label: string;
    }> = [
      { key: "architectural", label: "Mimari" },
      { key: "mechanical", label: "Mekanik" },
      { key: "electrical", label: "Elektrik" },
    ];
    for (const d of disciplines) {
      const was = prevA[d.key].approved;
      const now = next[d.key].approved;
      if (was !== now) {
        return {
          category: "approval",
          action: now ? "approve" : "revoke",
          message: now
            ? `${d.label} onaylandı: ${prev.name}`
            : `${d.label} onayı geri alındı: ${prev.name}`,
        };
      }
    }
  }

  if (
    data.projectStatus !== undefined &&
    data.projectStatus !== prev.projectStatus
  ) {
    return {
      category: "store",
      action: "update",
      message: `Durum güncellendi: ${prev.name} → ${data.projectStatus}`,
    };
  }

  return {
    category: "store",
    action: "update",
    message: `Konum güncellendi: ${prev.name}`,
  };
}

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
  const { user } = useAuth();

  const addStore = useCallback(
    (data: StoreInput, meta: { userId: string; userName: string }) => {
      const now = new Date().toISOString();
      const approvals = data.approvals ?? emptyApprovals();
      const store: Store = {
        totalBudget: 1500000,
        ...data,
        id: `custom-${Date.now()}`,
        isCustom: true,
        organizationId: data.organizationId ?? user?.organizationId,
        approvals,
        createdBy: meta.userId,
        createdByName: meta.userName,
        createdAt: now,
      };

      const next = [store, ...stores];
      setStores(next);

      supabase
        .from("stores")
        .insert({
          id: store.id,
          organization_id: store.organizationId ?? null,
          name: store.name,
          city: store.city,
          address: store.address,
          latitude: store.latitude,
          longitude: store.longitude,
          project_status: store.projectStatus,
          opening_date: store.openingDate,
          acceptance_date: store.acceptanceDate,
          contractor_company: store.contractorCompany,
          site_manager: store.siteManager,
          location_type: store.locationType,
          gross_m2: store.grossM2,
          floor_count: store.floorCount,
          phone: store.phone,
          is_custom: store.isCustom,
          total_budget: store.totalBudget,
          created_by: store.createdBy,
          created_by_name: store.createdByName,
          created_at: store.createdAt,
          ...approvalsToDb(store.approvals),
        })
        .then(({ error }) => {
          if (error) console.error("Error inserting store in Supabase:", error);
        });

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
    [stores, setStores, user?.organizationId]
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
      setStores(next);

      const dbUpdates: Record<string, unknown> = {};
      if (data.name !== undefined) dbUpdates.name = data.name;
      if (data.city !== undefined) dbUpdates.city = data.city;
      if (data.address !== undefined) dbUpdates.address = data.address;
      if (data.latitude !== undefined) dbUpdates.latitude = data.latitude;
      if (data.longitude !== undefined) dbUpdates.longitude = data.longitude;
      if (data.projectStatus !== undefined)
        dbUpdates.project_status = data.projectStatus;
      if (data.openingDate !== undefined)
        dbUpdates.opening_date = data.openingDate;
      if (data.acceptanceDate !== undefined)
        dbUpdates.acceptance_date = data.acceptanceDate;
      if (data.contractorCompany !== undefined)
        dbUpdates.contractor_company = data.contractorCompany;
      if (data.siteManager !== undefined)
        dbUpdates.site_manager = data.siteManager;
      if (data.locationType !== undefined)
        dbUpdates.location_type = data.locationType;
      if (data.grossM2 !== undefined) dbUpdates.gross_m2 = data.grossM2;
      if (data.floorCount !== undefined)
        dbUpdates.floor_count = data.floorCount;
      if (data.phone !== undefined) dbUpdates.phone = data.phone;
      if (data.totalBudget !== undefined)
        dbUpdates.total_budget = data.totalBudget;
      if (data.organizationId !== undefined)
        dbUpdates.organization_id = data.organizationId;
      if (data.approvals !== undefined) {
        Object.assign(dbUpdates, approvalsToDb(data.approvals));
      }

      if (meta) {
        dbUpdates.updated_by = meta.userId;
        dbUpdates.updated_by_name = meta.userName;
        dbUpdates.updated_at = now;
      }

      supabase
        .from("stores")
        .update(dbUpdates)
        .eq("id", id)
        .then(({ error }) => {
          if (error) console.error("Error updating store in Supabase:", error);
        });

      if (target) {
        const desc = describeStoreUpdate(target, data);
        logActivity({
          category: desc.category,
          action: desc.action,
          message: desc.message,
          actorId: meta?.userId ?? user?.id ?? "system",
          actorName: meta?.userName ?? user?.name ?? "Sistem",
          targetId: id,
          targetLabel: target.name,
        });
      }
    },
    [stores, setStores, user?.id, user?.name]
  );

  const deleteStore = useCallback(
    (id: string) => {
      const target = stores.find((s) => s.id === id);
      setStores(stores.filter((s) => s.id !== id));

      supabase
        .from("stores")
        .delete()
        .eq("id", id)
        .then(({ error }) => {
          if (error) console.error("Error deleting store from Supabase:", error);
        });

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
    [stores, setStores]
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

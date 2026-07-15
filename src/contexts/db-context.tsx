"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Store, StoreUserData, User, ActivityLogEntry, StoreNote, StoreFile, StoreMaterial, StoreWorkPlanItem } from "@/types";

type DbContextType = {
  stores: Store[];
  storeData: Record<string, StoreUserData>;
  users: User[];
  activityLogs: ActivityLogEntry[];
  setStores: (stores: Store[]) => Promise<void>;
  setStoreData: (storeData: Record<string, StoreUserData>) => Promise<void>;
  setUsers: (users: User[]) => Promise<void>;
  setActivityLogs: (activityLogs: ActivityLogEntry[]) => Promise<void>;
  isLoading: boolean;
  refetch: () => Promise<void>;
};

const DbContext = createContext<DbContextType | null>(null);

export function DbProvider({ children }: { children: React.ReactNode }) {
  const [stores, setStoresState] = useState<Store[]>([]);
  const [storeData, setStoreDataState] = useState<Record<string, StoreUserData>>({});
  const [users, setUsersState] = useState<User[]>([]);
  const [activityLogs, setActivityLogsState] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      // 1. Fetch stores
      const { data: storesDataRes, error: storesErr } = await supabase
        .from("stores")
        .select("*")
        .order("created_at", { ascending: false });
      if (storesErr) throw storesErr;

      // Map snake_case database columns to camelCase JS fields
      const mappedStores: Store[] = (storesDataRes || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        city: s.city,
        address: s.address,
        latitude: s.latitude,
        longitude: s.longitude,
        projectStatus: s.project_status,
        openingDate: s.opening_date,
        acceptanceDate: s.acceptance_date,
        contractorCompany: s.contractor_company,
        siteManager: s.site_manager,
        locationType: s.location_type,
        grossM2: s.gross_m2,
        floorCount: s.floor_count,
        phone: s.phone,
        isCustom: s.is_custom,
        totalBudget: Number(s.total_budget || 0),
        createdBy: s.created_by,
        createdByName: s.created_by_name,
        createdAt: s.created_at,
        updatedBy: s.updated_by,
        updatedByName: s.updated_by_name,
        updatedAt: s.updated_at,
      }));

      // 2. Fetch profiles
      const { data: profilesRes, error: profilesErr } = await supabase
        .from("profiles")
        .select("*");
      if (profilesErr) throw profilesErr;

      const mappedUsers: User[] = (profilesRes || []).map((p: any) => ({
        id: p.id,
        email: p.email,
        name: p.name,
        role: p.role,
        permissions: p.permissions,
        restricted: p.restricted,
      }));

      // 3. Fetch activity logs
      const { data: logsRes, error: logsErr } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (logsErr) throw logsErr;

      const mappedLogs: ActivityLogEntry[] = (logsRes || []).map((l: any) => ({
        id: l.id,
        category: l.category,
        action: l.action,
        message: l.message,
        actorId: l.actor_id,
        actorName: l.actor_name,
        targetId: l.target_id,
        targetLabel: l.target_label,
        createdAt: l.created_at,
      }));

      // 4. Fetch store details (notes, files, materials, work plans)
      const [notesRes, filesRes, materialsRes, workPlanRes] = await Promise.all([
        supabase.from("store_notes").select("*").order("created_at", { ascending: true }),
        supabase.from("store_files").select("*").order("uploaded_at", { ascending: true }),
        supabase.from("store_materials").select("*").order("imported_at", { ascending: true }),
        supabase.from("store_work_plan").select("*").order("imported_at", { ascending: true }),
      ]);

      if (notesRes.error) throw notesRes.error;
      if (filesRes.error) throw filesRes.error;
      if (materialsRes.error) throw materialsRes.error;
      if (workPlanRes.error) throw workPlanRes.error;

      // Group these into a StoreUserData record
      const tempStoreData: Record<string, StoreUserData> = {};

      // Initialize structures for all existing stores
      const specialNotesMap: Record<string, string> = {};
      (storesDataRes || []).forEach((s: any) => {
        specialNotesMap[s.id] = s.special_note || "";
      });

      mappedStores.forEach((st) => {
        tempStoreData[st.id] = {
          notes: [],
          files: [],
          materials: [],
          workPlan: [],
          specialNote: specialNotesMap[st.id] || "",
        };
      });

      // Populate notes
      (notesRes.data || []).forEach((n: any) => {
        if (!tempStoreData[n.store_id]) return;
        const note: StoreNote = {
          id: n.id,
          storeId: n.store_id,
          userId: n.user_id,
          userName: n.user_name,
          content: n.content,
          createdAt: n.created_at,
          updatedAt: n.updated_at,
        };
        tempStoreData[n.store_id].notes.push(note);
      });

      // Populate files
      (filesRes.data || []).forEach((f: any) => {
        if (!tempStoreData[f.store_id]) return;
        const fileEntry: StoreFile = {
          id: f.id,
          storeId: f.store_id,
          userId: f.user_id,
          userName: f.user_name,
          name: f.name,
          size: f.size,
          type: f.type,
          dataUrl: f.data_url,
          uploadedAt: f.uploaded_at,
        };
        tempStoreData[f.store_id].files.push(fileEntry);
      });

      // Populate materials
      (materialsRes.data || []).forEach((m: any) => {
        if (!tempStoreData[m.store_id]) return;
        const material: StoreMaterial = {
          id: m.id,
          storeId: m.store_id,
          userId: m.user_id,
          name: m.name,
          quantity: Number(m.quantity || 0),
          unit: m.unit,
          unitPrice: Number(m.unit_price || 0),
          status: m.status,
          importedAt: m.imported_at,
        };
        tempStoreData[m.store_id].materials.push(material);
      });

      // Populate workPlan
      (workPlanRes.data || []).forEach((w: any) => {
        if (!tempStoreData[w.store_id]) return;
        const wpItem: StoreWorkPlanItem = {
          id: w.id,
          storeId: w.store_id,
          userId: w.user_id,
          description: w.description,
          startDate: w.start_date,
          endDate: w.end_date,
          responsible: w.responsible,
          status: w.status,
          importedAt: w.imported_at,
        };
        tempStoreData[w.store_id].workPlan.push(wpItem);
      });

      setStoresState(mappedStores);
      setStoreDataState(tempStoreData);
      setUsersState(mappedUsers);
      setActivityLogsState(mappedLogs);
    } catch (err) {
      console.error("Veritabanı yüklenirken hata oluştu:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const setStores = async (nextStores: Store[]) => {
    setStoresState(nextStores);
  };

  const setStoreData = async (nextStoreData: Record<string, StoreUserData>) => {
    setStoreDataState(nextStoreData);
  };

  const setUsers = async (nextUsers: User[]) => {
    setUsersState(nextUsers);
  };

  const setActivityLogs = async (nextActivityLogs: ActivityLogEntry[]) => {
    setActivityLogsState(nextActivityLogs);
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

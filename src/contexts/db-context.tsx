"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { mapStoreFromDb } from "@/lib/store-mapper";
import { mapOrganizationFromDb } from "@/lib/migrations";
import { normalizeRole } from "@/lib/roles";
import { normalizePermissions } from "@/lib/permissions";
import type {
  Organization,
  Store,
  StoreUserData,
  User,
  ActivityLogEntry,
  StoreNote,
  StoreFile,
  StoreMaterial,
  StoreWorkPlanItem,
  Ticket,
  Contract,
  ProgressPayment,
  Invoice,
} from "@/types";

type DbContextType = {
  stores: Store[];
  storeData: Record<string, StoreUserData>;
  users: User[];
  activityLogs: ActivityLogEntry[];
  organization: Organization | null;
  tickets: Ticket[];
  contracts: Contract[];
  progressPayments: ProgressPayment[];
  invoices: Invoice[];
  setStores: (stores: Store[]) => Promise<void>;
  setStoreData: (storeData: Record<string, StoreUserData>) => Promise<void>;
  setUsers: (users: User[]) => Promise<void>;
  setActivityLogs: (activityLogs: ActivityLogEntry[]) => Promise<void>;
  setOrganization: (org: Organization | null) => void;
  setTickets: (items: Ticket[]) => void;
  setContracts: (items: Contract[]) => void;
  setProgressPayments: (items: ProgressPayment[]) => void;
  setInvoices: (items: Invoice[]) => void;
  isLoading: boolean;
  refetch: () => Promise<void>;
};

const DbContext = createContext<DbContextType | null>(null);

function mapTicket(t: any): Ticket {
  return {
    id: t.id,
    organizationId: t.organization_id,
    storeId: t.store_id || undefined,
    title: t.title,
    description: t.description || "",
    priority: t.priority,
    status: t.status,
    assigneeId: t.assignee_id || undefined,
    assigneeName: t.assignee_name || undefined,
    createdBy: t.created_by,
    createdByName: t.created_by_name,
    createdAt: t.created_at,
    updatedBy: t.updated_by || undefined,
    updatedByName: t.updated_by_name || undefined,
    updatedAt: t.updated_at || undefined,
  };
}

function mapContract(c: any): Contract {
  return {
    id: c.id,
    organizationId: c.organization_id,
    storeId: c.store_id || undefined,
    title: c.title,
    partyName: c.party_name || "",
    startDate: c.start_date || undefined,
    endDate: c.end_date || undefined,
    amount: Number(c.amount || 0),
    status: c.status,
    fileUrl: c.file_url || undefined,
    createdBy: c.created_by,
    createdByName: c.created_by_name,
    createdAt: c.created_at,
    updatedBy: c.updated_by || undefined,
    updatedByName: c.updated_by_name || undefined,
    updatedAt: c.updated_at || undefined,
  };
}

function mapPayment(p: any): ProgressPayment {
  return {
    id: p.id,
    organizationId: p.organization_id,
    storeId: p.store_id || undefined,
    title: p.title,
    periodLabel: p.period_label || "",
    amount: Number(p.amount || 0),
    status: p.status,
    createdBy: p.created_by,
    createdByName: p.created_by_name,
    createdAt: p.created_at,
    updatedBy: p.updated_by || undefined,
    updatedByName: p.updated_by_name || undefined,
    updatedAt: p.updated_at || undefined,
  };
}

function mapInvoice(i: any): Invoice {
  return {
    id: i.id,
    organizationId: i.organization_id,
    storeId: i.store_id || undefined,
    progressPaymentId: i.progress_payment_id || undefined,
    invoiceNumber: i.invoice_number,
    amount: Number(i.amount || 0),
    taxAmount: Number(i.tax_amount || 0),
    status: i.status,
    issuedAt: i.issued_at || undefined,
    createdBy: i.created_by,
    createdByName: i.created_by_name,
    createdAt: i.created_at,
    updatedBy: i.updated_by || undefined,
    updatedByName: i.updated_by_name || undefined,
    updatedAt: i.updated_at || undefined,
  };
}

export function DbProvider({ children }: { children: React.ReactNode }) {
  const [stores, setStoresState] = useState<Store[]>([]);
  const [storeData, setStoreDataState] = useState<Record<string, StoreUserData>>({});
  const [users, setUsersState] = useState<User[]>([]);
  const [activityLogs, setActivityLogsState] = useState<ActivityLogEntry[]>([]);
  const [organization, setOrganizationState] = useState<Organization | null>(null);
  const [tickets, setTicketsState] = useState<Ticket[]>([]);
  const [contracts, setContractsState] = useState<Contract[]>([]);
  const [progressPayments, setProgressPaymentsState] = useState<ProgressPayment[]>([]);
  const [invoices, setInvoicesState] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const clearLocalState = () => {
    setStoresState([]);
    setStoreDataState({});
    setUsersState([]);
    setActivityLogsState([]);
    setOrganizationState(null);
    setTicketsState([]);
    setContractsState([]);
    setProgressPaymentsState([]);
    setInvoicesState([]);
  };

  const fetchData = async (options?: { showBootstrapLoader?: boolean }) => {
    if (options?.showBootstrapLoader) {
      setIsLoading(true);
    }
    try {
      // 1. Fetch stores
      const { data: storesDataRes, error: storesErr } = await supabase
        .from("stores")
        .select("*")
        .order("created_at", { ascending: false });
      if (storesErr) throw storesErr;

      const mappedStores: Store[] = (storesDataRes || []).map((s: any) =>
        mapStoreFromDb(s)
      );

      // 2. Fetch profiles
      const { data: profilesRes, error: profilesErr } = await supabase
        .from("profiles")
        .select("*");
      if (profilesErr) throw profilesErr;

      const mappedUsers: User[] = (profilesRes || []).map((p: any) => {
        const role = normalizeRole(p.role);
        return {
          id: p.id,
          email: p.email,
          name: p.name,
          role,
          permissions: normalizePermissions(role, p.permissions),
          organizationId: p.organization_id || undefined,
          phone: p.phone || undefined,
          avatarUrl: p.avatar_url || undefined,
          restricted: p.restricted,
        };
      });

      // 2b. Organization of current session user (if any)
      const {
        data: { session },
      } = await supabase.auth.getSession();
      let org: Organization | null = null;
      if (session?.user) {
        const me = mappedUsers.find((u) => u.id === session.user.id);
        const orgId = me?.organizationId;
        if (orgId) {
          const { data: orgRow } = await supabase
            .from("organizations")
            .select("*")
            .eq("id", orgId)
            .maybeSingle();
          if (orgRow) org = mapOrganizationFromDb(orgRow);
        }
      }

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

      const tempStoreData: Record<string, StoreUserData> = {};
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

      // 5. Module tables (ignore if migration not applied yet)
      let mappedTickets: Ticket[] = [];
      let mappedContracts: Contract[] = [];
      let mappedPayments: ProgressPayment[] = [];
      let mappedInvoices: Invoice[] = [];

      const [ticketsRes, contractsRes, paymentsRes, invoicesRes] =
        await Promise.all([
          supabase
            .from("tickets")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase
            .from("contracts")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase
            .from("progress_payments")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase
            .from("invoices")
            .select("*")
            .order("created_at", { ascending: false }),
        ]);

      if (!ticketsRes.error) {
        mappedTickets = (ticketsRes.data || []).map(mapTicket);
      }
      if (!contractsRes.error) {
        mappedContracts = (contractsRes.data || []).map(mapContract);
      }
      if (!paymentsRes.error) {
        mappedPayments = (paymentsRes.data || []).map(mapPayment);
      }
      if (!invoicesRes.error) {
        mappedInvoices = (invoicesRes.data || []).map(mapInvoice);
      }

      setStoresState(mappedStores);
      setStoreDataState(tempStoreData);
      setUsersState(mappedUsers);
      setActivityLogsState(mappedLogs);
      setOrganizationState(org);
      setTicketsState(mappedTickets);
      setContractsState(mappedContracts);
      setProgressPaymentsState(mappedPayments);
      setInvoicesState(mappedInvoices);
    } catch (err) {
      console.error("Veritabanı yüklenirken hata oluştu:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    // Session may hydrate after first paint. Fetch only once auth state is known,
    // and again on login — otherwise RLS returns empty rows with no error.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Defer async work to avoid Supabase auth deadlock risks
      setTimeout(() => {
        if (cancelled) return;

        if (event === "SIGNED_OUT") {
          clearLocalState();
          setIsLoading(false);
          return;
        }

        if (event === "INITIAL_SESSION") {
          if (!session) {
            setIsLoading(false);
            return;
          }
          void fetchData({ showBootstrapLoader: true });
          return;
        }

        if (event === "SIGNED_IN") {
          // Soft refresh: keep the tree mounted (AuthProvider lives under us)
          void fetchData({ showBootstrapLoader: false });
        }
      }, 0);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
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
        organization,
        tickets,
        contracts,
        progressPayments,
        invoices,
        setStores,
        setStoreData,
        setUsers,
        setActivityLogs,
        setOrganization: setOrganizationState,
        setTickets: setTicketsState,
        setContracts: setContractsState,
        setProgressPayments: setProgressPaymentsState,
        setInvoices: setInvoicesState,
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

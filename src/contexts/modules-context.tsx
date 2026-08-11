"use client";

import { createContext, useCallback, useContext } from "react";
import { useDb } from "@/contexts/db-context";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/activity-log";
import type {
  Contract,
  Invoice,
  ProgressPayment,
  Ticket,
  TicketPriority,
  TicketStatus,
  ContractStatus,
  ProgressPaymentStatus,
  InvoiceStatus,
} from "@/types";

function actorOf(user: { id: string; name: string } | null | undefined) {
  return {
    actorId: user?.id ?? "system",
    actorName: user?.name ?? "Sistem",
  };
}

type ModulesContextValue = {
  tickets: Ticket[];
  contracts: Contract[];
  progressPayments: ProgressPayment[];
  invoices: Invoice[];
  createTicket: (data: {
    title: string;
    description?: string;
    priority?: TicketPriority;
    status?: TicketStatus;
    storeId?: string;
    assigneeId?: string;
    assigneeName?: string;
  }) => Promise<boolean>;
  updateTicket: (id: string, data: Partial<Ticket>) => Promise<boolean>;
  deleteTicket: (id: string) => Promise<boolean>;
  createContract: (data: {
    title: string;
    partyName?: string;
    startDate?: string;
    endDate?: string;
    amount?: number;
    status?: ContractStatus;
    storeId?: string;
    fileUrl?: string;
  }) => Promise<boolean>;
  updateContract: (id: string, data: Partial<Contract>) => Promise<boolean>;
  deleteContract: (id: string) => Promise<boolean>;
  createPayment: (data: {
    title: string;
    periodLabel?: string;
    amount?: number;
    status?: ProgressPaymentStatus;
    storeId?: string;
  }) => Promise<boolean>;
  updatePayment: (
    id: string,
    data: Partial<ProgressPayment>
  ) => Promise<boolean>;
  deletePayment: (id: string) => Promise<boolean>;
  createInvoice: (data: {
    invoiceNumber: string;
    amount?: number;
    taxAmount?: number;
    status?: InvoiceStatus;
    issuedAt?: string;
    storeId?: string;
    progressPaymentId?: string;
  }) => Promise<boolean>;
  updateInvoice: (id: string, data: Partial<Invoice>) => Promise<boolean>;
  deleteInvoice: (id: string) => Promise<boolean>;
};

const ModulesContext = createContext<ModulesContextValue | null>(null);

export function ModulesProvider({ children }: { children: React.ReactNode }) {
  const {
    tickets,
    contracts,
    progressPayments,
    invoices,
    setTickets,
    setContracts,
    setProgressPayments,
    setInvoices,
  } = useDb();
  const { user } = useAuth();

  const requireOrg = () => user?.organizationId;

  const createTicket = useCallback(
    async (data: {
      title: string;
      description?: string;
      priority?: TicketPriority;
      status?: TicketStatus;
      storeId?: string;
      assigneeId?: string;
      assigneeName?: string;
    }) => {
      const orgId = requireOrg();
      if (!user || !orgId) return false;
      const now = new Date().toISOString();
      const row = {
        organization_id: orgId,
        store_id: data.storeId || null,
        title: data.title,
        description: data.description || "",
        priority: data.priority || "medium",
        status: data.status || "open",
        assignee_id: data.assigneeId || null,
        assignee_name: data.assigneeName || null,
        created_by: user.id,
        created_by_name: user.name,
        created_at: now,
      };
      const { data: inserted, error } = await supabase
        .from("tickets")
        .insert(row)
        .select("*")
        .single();
      if (error || !inserted) {
        console.error(error);
        return false;
      }
      const ticket: Ticket = {
        id: inserted.id,
        organizationId: inserted.organization_id,
        storeId: inserted.store_id || undefined,
        title: inserted.title,
        description: inserted.description || "",
        priority: inserted.priority,
        status: inserted.status,
        assigneeId: inserted.assignee_id || undefined,
        assigneeName: inserted.assignee_name || undefined,
        createdBy: inserted.created_by,
        createdByName: inserted.created_by_name,
        createdAt: inserted.created_at,
      };
      setTickets([ticket, ...tickets]);
      logActivity({
        category: "ticket",
        action: "create",
        message: `Ticket oluşturuldu: ${ticket.title}`,
        ...actorOf(user),
        targetId: ticket.id,
        targetLabel: ticket.title,
      });
      return true;
    },
    [user, tickets, setTickets]
  );

  const updateTicket = useCallback(
    async (id: string, data: Partial<Ticket>) => {
      if (!user) return false;
      const db: Record<string, unknown> = {
        updated_by: user.id,
        updated_by_name: user.name,
        updated_at: new Date().toISOString(),
      };
      if (data.title !== undefined) db.title = data.title;
      if (data.description !== undefined) db.description = data.description;
      if (data.priority !== undefined) db.priority = data.priority;
      if (data.status !== undefined) db.status = data.status;
      if (data.storeId !== undefined) db.store_id = data.storeId || null;
      if (data.assigneeId !== undefined) db.assignee_id = data.assigneeId || null;
      if (data.assigneeName !== undefined)
        db.assignee_name = data.assigneeName || null;

      const { error } = await supabase.from("tickets").update(db).eq("id", id);
      if (error) {
        console.error(error);
        return false;
      }
      setTickets(
        tickets.map((t) =>
          t.id === id
            ? {
                ...t,
                ...data,
                updatedBy: user.id,
                updatedByName: user.name,
                updatedAt: String(db.updated_at),
              }
            : t
        )
      );
      const title =
        data.title ?? tickets.find((t) => t.id === id)?.title ?? id;
      logActivity({
        category: "ticket",
        action: "update",
        message: `Ticket güncellendi: ${title}`,
        ...actorOf(user),
        targetId: id,
        targetLabel: title,
      });
      return true;
    },
    [user, tickets, setTickets]
  );

  const deleteTicket = useCallback(
    async (id: string) => {
      const prev = tickets.find((t) => t.id === id);
      const { error } = await supabase.from("tickets").delete().eq("id", id);
      if (error) {
        console.error(error);
        return false;
      }
      setTickets(tickets.filter((t) => t.id !== id));
      logActivity({
        category: "ticket",
        action: "delete",
        message: `Ticket silindi: ${prev?.title ?? id}`,
        ...actorOf(user),
        targetId: id,
        targetLabel: prev?.title,
      });
      return true;
    },
    [tickets, setTickets, user]
  );

  const createContract = useCallback(
    async (data: {
      title: string;
      partyName?: string;
      startDate?: string;
      endDate?: string;
      amount?: number;
      status?: ContractStatus;
      storeId?: string;
      fileUrl?: string;
    }) => {
      const orgId = requireOrg();
      if (!user || !orgId) return false;
      const now = new Date().toISOString();
      const { data: inserted, error } = await supabase
        .from("contracts")
        .insert({
          organization_id: orgId,
          store_id: data.storeId || null,
          title: data.title,
          party_name: data.partyName || "",
          start_date: data.startDate || null,
          end_date: data.endDate || null,
          amount: data.amount ?? 0,
          status: data.status || "draft",
          file_url: data.fileUrl || null,
          created_by: user.id,
          created_by_name: user.name,
          created_at: now,
        })
        .select("*")
        .single();
      if (error || !inserted) {
        console.error(error);
        return false;
      }
      const item: Contract = {
        id: inserted.id,
        organizationId: inserted.organization_id,
        storeId: inserted.store_id || undefined,
        title: inserted.title,
        partyName: inserted.party_name || "",
        startDate: inserted.start_date || undefined,
        endDate: inserted.end_date || undefined,
        amount: Number(inserted.amount || 0),
        status: inserted.status,
        fileUrl: inserted.file_url || undefined,
        createdBy: inserted.created_by,
        createdByName: inserted.created_by_name,
        createdAt: inserted.created_at,
      };
      setContracts([item, ...contracts]);
      logActivity({
        category: "contract",
        action: "create",
        message: `Sözleşme oluşturuldu: ${item.title}`,
        ...actorOf(user),
        targetId: item.id,
        targetLabel: item.title,
      });
      return true;
    },
    [user, contracts, setContracts]
  );

  const updateContract = useCallback(
    async (id: string, data: Partial<Contract>) => {
      if (!user) return false;
      const db: Record<string, unknown> = {
        updated_by: user.id,
        updated_by_name: user.name,
        updated_at: new Date().toISOString(),
      };
      if (data.title !== undefined) db.title = data.title;
      if (data.partyName !== undefined) db.party_name = data.partyName;
      if (data.startDate !== undefined) db.start_date = data.startDate || null;
      if (data.endDate !== undefined) db.end_date = data.endDate || null;
      if (data.amount !== undefined) db.amount = data.amount;
      if (data.status !== undefined) db.status = data.status;
      if (data.storeId !== undefined) db.store_id = data.storeId || null;
      if (data.fileUrl !== undefined) db.file_url = data.fileUrl || null;

      const { error } = await supabase.from("contracts").update(db).eq("id", id);
      if (error) return false;
      setContracts(
        contracts.map((c) => (c.id === id ? { ...c, ...data } : c))
      );
      const title =
        data.title ?? contracts.find((c) => c.id === id)?.title ?? id;
      logActivity({
        category: "contract",
        action: "update",
        message: `Sözleşme güncellendi: ${title}`,
        ...actorOf(user),
        targetId: id,
        targetLabel: title,
      });
      return true;
    },
    [user, contracts, setContracts]
  );

  const deleteContract = useCallback(
    async (id: string) => {
      const prev = contracts.find((c) => c.id === id);
      const { error } = await supabase.from("contracts").delete().eq("id", id);
      if (error) return false;
      setContracts(contracts.filter((c) => c.id !== id));
      logActivity({
        category: "contract",
        action: "delete",
        message: `Sözleşme silindi: ${prev?.title ?? id}`,
        ...actorOf(user),
        targetId: id,
        targetLabel: prev?.title,
      });
      return true;
    },
    [contracts, setContracts, user]
  );

  const createPayment = useCallback(
    async (data: {
      title: string;
      periodLabel?: string;
      amount?: number;
      status?: ProgressPaymentStatus;
      storeId?: string;
    }) => {
      const orgId = requireOrg();
      if (!user || !orgId) return false;
      const { data: inserted, error } = await supabase
        .from("progress_payments")
        .insert({
          organization_id: orgId,
          store_id: data.storeId || null,
          title: data.title,
          period_label: data.periodLabel || "",
          amount: data.amount ?? 0,
          status: data.status || "draft",
          created_by: user.id,
          created_by_name: user.name,
          created_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      if (error || !inserted) {
        console.error(error);
        return false;
      }
      const item: ProgressPayment = {
        id: inserted.id,
        organizationId: inserted.organization_id,
        storeId: inserted.store_id || undefined,
        title: inserted.title,
        periodLabel: inserted.period_label || "",
        amount: Number(inserted.amount || 0),
        status: inserted.status,
        createdBy: inserted.created_by,
        createdByName: inserted.created_by_name,
        createdAt: inserted.created_at,
      };
      setProgressPayments([item, ...progressPayments]);
      logActivity({
        category: "payment",
        action: "create",
        message: `Hakediş oluşturuldu: ${item.title}`,
        ...actorOf(user),
        targetId: item.id,
        targetLabel: item.title,
      });
      return true;
    },
    [user, progressPayments, setProgressPayments]
  );

  const updatePayment = useCallback(
    async (id: string, data: Partial<ProgressPayment>) => {
      if (!user) return false;
      const db: Record<string, unknown> = {
        updated_by: user.id,
        updated_by_name: user.name,
        updated_at: new Date().toISOString(),
      };
      if (data.title !== undefined) db.title = data.title;
      if (data.periodLabel !== undefined) db.period_label = data.periodLabel;
      if (data.amount !== undefined) db.amount = data.amount;
      if (data.status !== undefined) db.status = data.status;
      if (data.storeId !== undefined) db.store_id = data.storeId || null;
      const { error } = await supabase
        .from("progress_payments")
        .update(db)
        .eq("id", id);
      if (error) return false;
      setProgressPayments(
        progressPayments.map((p) => (p.id === id ? { ...p, ...data } : p))
      );
      const title =
        data.title ??
        progressPayments.find((p) => p.id === id)?.title ??
        id;
      logActivity({
        category: "payment",
        action: "update",
        message: `Hakediş güncellendi: ${title}`,
        ...actorOf(user),
        targetId: id,
        targetLabel: title,
      });
      return true;
    },
    [user, progressPayments, setProgressPayments]
  );

  const deletePayment = useCallback(
    async (id: string) => {
      const prev = progressPayments.find((p) => p.id === id);
      const { error } = await supabase
        .from("progress_payments")
        .delete()
        .eq("id", id);
      if (error) return false;
      setProgressPayments(progressPayments.filter((p) => p.id !== id));
      logActivity({
        category: "payment",
        action: "delete",
        message: `Hakediş silindi: ${prev?.title ?? id}`,
        ...actorOf(user),
        targetId: id,
        targetLabel: prev?.title,
      });
      return true;
    },
    [progressPayments, setProgressPayments, user]
  );

  const createInvoice = useCallback(
    async (data: {
      invoiceNumber: string;
      amount?: number;
      taxAmount?: number;
      status?: InvoiceStatus;
      issuedAt?: string;
      storeId?: string;
      progressPaymentId?: string;
    }) => {
      const orgId = requireOrg();
      if (!user || !orgId) return false;
      const { data: inserted, error } = await supabase
        .from("invoices")
        .insert({
          organization_id: orgId,
          store_id: data.storeId || null,
          progress_payment_id: data.progressPaymentId || null,
          invoice_number: data.invoiceNumber,
          amount: data.amount ?? 0,
          tax_amount: data.taxAmount ?? 0,
          status: data.status || "draft",
          issued_at: data.issuedAt || null,
          created_by: user.id,
          created_by_name: user.name,
          created_at: new Date().toISOString(),
        })
        .select("*")
        .single();
      if (error || !inserted) {
        console.error(error);
        return false;
      }
      const item: Invoice = {
        id: inserted.id,
        organizationId: inserted.organization_id,
        storeId: inserted.store_id || undefined,
        progressPaymentId: inserted.progress_payment_id || undefined,
        invoiceNumber: inserted.invoice_number,
        amount: Number(inserted.amount || 0),
        taxAmount: Number(inserted.tax_amount || 0),
        status: inserted.status,
        issuedAt: inserted.issued_at || undefined,
        createdBy: inserted.created_by,
        createdByName: inserted.created_by_name,
        createdAt: inserted.created_at,
      };
      setInvoices([item, ...invoices]);
      logActivity({
        category: "invoice",
        action: "create",
        message: `Fatura oluşturuldu: ${item.invoiceNumber}`,
        ...actorOf(user),
        targetId: item.id,
        targetLabel: item.invoiceNumber,
      });
      return true;
    },
    [user, invoices, setInvoices]
  );

  const updateInvoice = useCallback(
    async (id: string, data: Partial<Invoice>) => {
      if (!user) return false;
      const db: Record<string, unknown> = {
        updated_by: user.id,
        updated_by_name: user.name,
        updated_at: new Date().toISOString(),
      };
      if (data.invoiceNumber !== undefined)
        db.invoice_number = data.invoiceNumber;
      if (data.amount !== undefined) db.amount = data.amount;
      if (data.taxAmount !== undefined) db.tax_amount = data.taxAmount;
      if (data.status !== undefined) db.status = data.status;
      if (data.issuedAt !== undefined) db.issued_at = data.issuedAt || null;
      if (data.storeId !== undefined) db.store_id = data.storeId || null;
      if (data.progressPaymentId !== undefined)
        db.progress_payment_id = data.progressPaymentId || null;
      const { error } = await supabase.from("invoices").update(db).eq("id", id);
      if (error) return false;
      setInvoices(invoices.map((i) => (i.id === id ? { ...i, ...data } : i)));
      const label =
        data.invoiceNumber ??
        invoices.find((i) => i.id === id)?.invoiceNumber ??
        id;
      logActivity({
        category: "invoice",
        action: "update",
        message: `Fatura güncellendi: ${label}`,
        ...actorOf(user),
        targetId: id,
        targetLabel: label,
      });
      return true;
    },
    [user, invoices, setInvoices]
  );

  const deleteInvoice = useCallback(
    async (id: string) => {
      const prev = invoices.find((i) => i.id === id);
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) return false;
      setInvoices(invoices.filter((i) => i.id !== id));
      logActivity({
        category: "invoice",
        action: "delete",
        message: `Fatura silindi: ${prev?.invoiceNumber ?? id}`,
        ...actorOf(user),
        targetId: id,
        targetLabel: prev?.invoiceNumber,
      });
      return true;
    },
    [invoices, setInvoices, user]
  );

  return (
    <ModulesContext.Provider
      value={{
        tickets,
        contracts,
        progressPayments,
        invoices,
        createTicket,
        updateTicket,
        deleteTicket,
        createContract,
        updateContract,
        deleteContract,
        createPayment,
        updatePayment,
        deletePayment,
        createInvoice,
        updateInvoice,
        deleteInvoice,
      }}
    >
      {children}
    </ModulesContext.Provider>
  );
}

export function useModules() {
  const ctx = useContext(ModulesContext);
  if (!ctx) throw new Error("useModules must be used within ModulesProvider");
  return ctx;
}

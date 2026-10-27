import type {
  Contract,
  ContractStatus,
  Invoice,
  InvoiceStatus,
  ProgressPayment,
  ProgressPaymentStatus,
  TicketPriority,
  TicketStatus,
} from "@/types";
import { localizedRecord } from "@/i18n/runtime";
import { format, isValid, parseISO } from "date-fns";
import type { Locale } from "date-fns";
import { roundMoney, sumMoney, type MoneyTotals } from "@/lib/currency";

const PERIOD_SEPARATOR = "..";
export const VAT_RATE_OPTIONS = [0, 1, 10, 20] as const;

/** vatRate yüzde olarak verilir (örn. 20 → %20) */
export function calculateVat(amount: number, vatRate: number): number {
  return roundMoney((amount * vatRate) / 100);
}

export function inferVatRate(amount: number, taxAmount: number): number {
  if (amount <= 0) return 20;
  return Number(((taxAmount / amount) * 100).toFixed(2));
}

export function encodePaymentPeriod(startDate: string, endDate: string): string {
  if (startDate && endDate) return `${startDate}${PERIOD_SEPARATOR}${endDate}`;
  return startDate || endDate;
}

export function parsePaymentPeriod(periodLabel: string): {
  startDate: string;
  endDate: string;
} {
  const [startDate = "", endDate = ""] = periodLabel.split(PERIOD_SEPARATOR);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return { startDate: "", endDate: "" };
  }
  if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return { startDate: "", endDate: "" };
  }
  return { startDate, endDate };
}

export function formatPaymentPeriod(periodLabel: string, locale?: Locale): string {
  const range = parsePaymentPeriod(periodLabel);
  if (!range.startDate) return periodLabel || "—";
  const start = parseISO(range.startDate);
  const end = range.endDate ? parseISO(range.endDate) : null;
  if (!isValid(start) || (end && !isValid(end))) return periodLabel;
  const formattedStart = format(start, "d MMM yyyy", { locale });
  return end
    ? `${formattedStart} – ${format(end, "d MMM yyyy", { locale })}`
    : formattedStart;
}

/** Hakedişe bağlı ödenen tutar (status=paid faturaların KDV dahil toplamı), para birimine göre */
export function paidAmountForPayment(
  paymentId: string,
  invoices: Invoice[]
): MoneyTotals {
  return sumMoney(
    invoices.filter((i) => i.progressPaymentId === paymentId && i.status === "paid"),
    (i) => i.currency,
    (i) => i.amount + i.taxAmount
  );
}

/**
 * Sözleşmeye bağlı ödenen tutar, sözleşmenin para biriminde. Kur çevrimi
 * olmadığından başka birimdeki faturalar sayılmaz (progress_payments_list ile aynı).
 */
export function paidAmountForContract(
  contract: Contract,
  payments: ProgressPayment[],
  invoices: Invoice[]
): number {
  const paymentIds = new Set(
    payments.filter((p) => p.contractId === contract.id).map((p) => p.id)
  );
  return roundMoney(
    invoices
      .filter(
        (i) =>
          i.progressPaymentId &&
          paymentIds.has(i.progressPaymentId) &&
          i.status === "paid" &&
          i.currency === contract.currency
      )
      .reduce((sum, i) => sum + i.amount + i.taxAmount, 0)
  );
}

/** Sözleşme ilerleme yüzdesi (0–100) */
export function contractProgressPercent(
  contract: Contract,
  payments: ProgressPayment[],
  invoices: Invoice[]
): number {
  if (!contract.amount || contract.amount <= 0) return 0;
  const paid = paidAmountForContract(contract, payments, invoices);
  return Math.min(100, Math.round((paid / contract.amount) * 100));
}

/** Mağaza için geçerli sözleşme (fesih/iptal hariç) */
export function storeHasContract(
  storeId: string,
  contracts: Contract[]
): boolean {
  return contracts.some(
    (c) =>
      c.storeId === storeId &&
      c.status !== "terminated" &&
      c.status !== "cancelled"
  );
}

/** @deprecated storeHasContract kullanın */
export function storeHasActiveContract(
  storeId: string,
  contracts: Contract[]
): boolean {
  return storeHasContract(storeId, contracts);
}

/** Mağaza ihale durumunda sözleşme uyarısı göster */
export function needsContractWarning(
  storeProjectStatus: string,
  storeId: string,
  contracts: Contract[]
): boolean {
  if (storeProjectStatus !== "ihale") return false;
  return !storeHasContract(storeId, contracts);
}

/** Modül durum / öncelik etiketleri; her okunuşta seçili dile çevrilir */
export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = localizedRecord({
  open: "finance.ticketStatus.open",
  in_progress: "finance.ticketStatus.in_progress",
  resolved: "finance.ticketStatus.resolved",
  closed: "finance.ticketStatus.closed",
});

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = localizedRecord({
  low: "finance.ticketPriority.low",
  medium: "finance.ticketPriority.medium",
  high: "finance.ticketPriority.high",
});

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = localizedRecord({
  draft: "finance.contractStatus.draft",
  active: "finance.contractStatus.active",
  expired: "finance.contractStatus.expired",
  cancelled: "finance.contractStatus.cancelled",
  terminated: "finance.contractStatus.terminated",
  completed: "finance.contractStatus.completed",
});

export const PAYMENT_STATUS_LABELS: Record<ProgressPaymentStatus, string> = localizedRecord({
  draft: "finance.paymentStatus.draft",
  submitted: "finance.paymentStatus.submitted",
  approved: "finance.paymentStatus.approved",
  paid: "finance.paymentStatus.paid",
});

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = localizedRecord({
  draft: "finance.invoiceStatus.draft",
  issued: "finance.invoiceStatus.issued",
  paid: "finance.invoiceStatus.paid",
  cancelled: "finance.invoiceStatus.cancelled",
});

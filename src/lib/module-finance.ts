import type { Contract, Invoice, ProgressPayment } from "@/types";
import { format, isValid, parseISO } from "date-fns";
import type { Locale } from "date-fns";

const PERIOD_SEPARATOR = "..";
export const VAT_RATE_OPTIONS = [0, 1, 10, 20] as const;

export function calculateVat(amount: number, vatRate: number): number {
  return Math.round((amount * vatRate + Number.EPSILON) * 100) / 100;
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

/** Hakedişe bağlı ödenen tutar (status=paid faturaların toplamı) */
export function paidAmountForPayment(
  paymentId: string,
  invoices: Invoice[]
): number {
  return invoices
    .filter((i) => i.progressPaymentId === paymentId && i.status === "paid")
    .reduce((sum, i) => sum + i.amount + i.taxAmount, 0);
}

/** Sözleşmeye bağlı toplam ödenen tutar */
export function paidAmountForContract(
  contractId: string,
  payments: ProgressPayment[],
  invoices: Invoice[]
): number {
  const paymentIds = payments
    .filter((p) => p.contractId === contractId)
    .map((p) => p.id);
  return invoices
    .filter(
      (i) =>
        i.progressPaymentId &&
        paymentIds.includes(i.progressPaymentId) &&
        i.status === "paid"
    )
    .reduce((sum, i) => sum + i.amount + i.taxAmount, 0);
}

/** Sözleşme ilerleme yüzdesi (0–100) */
export function contractProgressPercent(
  contract: Contract,
  payments: ProgressPayment[],
  invoices: Invoice[]
): number {
  if (!contract.amount || contract.amount <= 0) return 0;
  const paid = paidAmountForContract(contract.id, payments, invoices);
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

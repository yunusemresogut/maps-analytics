import type { Contract, Invoice, ProgressPayment } from "@/types";

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

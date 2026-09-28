/** TRY para birimi — kur dönüşümü yok, tüm uygulama genelinde kullanın. */
export function formatTry(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** @deprecated formatTry kullanın */
export const formatCurrency = formatTry;

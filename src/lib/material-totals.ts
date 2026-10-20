import { roundMoney } from "@/lib/currency";

/**
 * Keşif kalemi tutarı (kuruşa yuvarlanır). Birimi "%" olan kalem, başka kalemlerin toplamının
 * yüzdesidir: miktar = yüzde, birim fiyat = seçilen kalemlerin toplam tutarı,
 * tutar = birim fiyat × miktar / 100. Örn. (100 + 100) × %10 = 20.
 * Veritabanındaki store_detail_summary görünümü de aynı formülü kullanır.
 */
export const PERCENT_UNIT = "%";

type MaterialAmount = { quantity: number; unit: string; unitPrice: number };

export function isPercentMaterial(material: Pick<MaterialAmount, "unit">): boolean {
  return material.unit.trim() === PERCENT_UNIT;
}

export function materialLineTotal(material: MaterialAmount): number {
  const quantity = Number(material.quantity) || 0;
  const unitPrice = Number(material.unitPrice) || 0;
  return roundMoney(isPercentMaterial(material) ? (unitPrice * quantity) / 100 : unitPrice * quantity);
}

import { getOpeningAlert } from "@/lib/opening-dates";
import { paidAmountForPayment } from "@/lib/module-finance";
import type {
  Contract,
  Invoice,
  ProgressPayment,
  Store,
  StoreDetailSummary,
  StoreMaterial,
  StoreWorkPlanItem,
  Ticket,
} from "@/types";
import { materialLineTotal } from "@/lib/material-totals";

const STATUS_LABELS: Record<string, string> = {
  proje: "Proje",
  ihale: "İhale",
  santiye: "Şantiye",
  acilis: "Açılış",
  hakedis: "Hakediş",
  fatura: "Fatura",
  yakinda_aciliyor: "Yakında Açılıyor",
};

const MAX_STORES = 150;
/** Route 60.000 karakterde keser; detaylar bu bütçeye sığdırılır */
const MAX_CONTEXT_CHARS = 55000;
export const MAX_ITEMS_PER_STORE = 60;
/** Bir soruda detayı çekilecek en fazla mağaza; bağlam sınırına zaten bu kadarı sığar */
export const MAX_DETAIL_STORES = 8;

const MATERIAL_STATUS: Record<string, string> = {
  bekleniyor: "bekleniyor",
  geldi: "geldi",
  gitti: "gitti",
};

const WORK_PLAN_STATUS: Record<string, string> = {
  yapilacak: "yapılacak",
  devam_ediyor: "devam ediyor",
  tamamlandi: "tamamlandı",
};

function normalize(text: string): string {
  return text.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
}

type AssistantContextInput = {
  /** Son kullanıcı sorusu: adı geçen mağazaların detayları önce eklenir */
  question?: string;
  organizationName?: string;
  userName: string;
  stores: Store[];
  storeSummaries: Record<string, StoreDetailSummary>;
  /** pickDetailStores ile seçilen mağazaların ilk kalemleri */
  storeDetails: Record<string, StoreDetails>;
  contracts: Contract[];
  progressPayments: ProgressPayment[];
  invoices: Invoice[];
  tickets: Ticket[];
};

export type StoreDetails = {
  materials: StoreMaterial[];
  workPlan: StoreWorkPlanItem[];
};

/**
 * Detayı (malzeme/iş planı kalemleri) asistana gönderilecek mağazalar:
 * soruda adı geçenler önce, kalemi olmayanlar hariç.
 */
export function pickDetailStores(
  stores: Store[],
  summaries: Record<string, StoreDetailSummary>,
  question: string
): Store[] {
  const normalized = normalize(question);
  const withDetails = stores.filter((store) => {
    const summary = summaries[store.id];
    return (summary?.materialCount ?? 0) + (summary?.workPlanCount ?? 0) > 0;
  });
  const mentioned = (store: Store) => normalized.includes(normalize(store.name));
  return [
    ...withDetails.filter(mentioned),
    ...withDetails.filter((store) => !mentioned(store)),
  ].slice(0, MAX_DETAIL_STORES);
}

function money(value: number): string {
  return `${Math.round(value).toLocaleString("tr-TR")} TRY`;
}

/**
 * Asistana gönderilecek, kullanıcının zaten görebildiği verinin kısa özeti.
 * Sadece RLS ile kullanıcının firmasına ait, istemcide yüklü veri kullanılır.
 */
export function buildAssistantContext(input: AssistantContextInput): string {
  const today = new Date().toISOString().slice(0, 10);
  const lines: string[] = [
    `Bugün: ${today}`,
    `Kullanıcı: ${input.userName}${input.organizationName ? ` (${input.organizationName})` : ""}`,
    "",
    `## Mağazalar (${input.stores.length})`,
  ];

  if (input.stores.length === 0) lines.push("Henüz mağaza yok.");

  for (const store of input.stores.slice(0, MAX_STORES)) {
    const summary = input.storeSummaries[store.id];
    const alert = store.openingDate ? getOpeningAlert(store.openingDate) : null;
    const workPlanCount = summary?.workPlanCount ?? 0;
    const materialCount = summary?.materialCount ?? 0;
    const parts = [
      `- ${store.name} | ${store.city} | durum: ${STATUS_LABELS[store.projectStatus] ?? store.projectStatus}`,
      store.openingDate ? `açılış: ${store.openingDate}${alert ? ` (${alert.label})` : ""}` : null,
      store.totalBudget ? `bütçe: ${money(store.totalBudget)}` : null,
      store.contractorCompany ? `yüklenici: ${store.contractorCompany}` : null,
      store.siteManager ? `şantiye şefi: ${store.siteManager}` : null,
      workPlanCount > 0
        ? `iş planı: ${workPlanCount} kalem, ort. %${summary?.workPlanAvgProgress ?? 0}`
        : null,
      materialCount > 0
        ? `keşif: ${materialCount} kalem, ${money(summary?.materialTotal ?? 0)}`
        : null,
    ];
    lines.push(parts.filter(Boolean).join(" | "));
  }
  if (input.stores.length > MAX_STORES) {
    lines.push(`… ve ${input.stores.length - MAX_STORES} mağaza daha`);
  }

  const storeName = (id?: string) =>
    input.stores.find((store) => store.id === id)?.name ?? "—";

  lines.push("", `## Sözleşmeler (${input.contracts.length})`);
  for (const contract of input.contracts.slice(0, 100)) {
    lines.push(
      `- ${contract.code ?? contract.title} | ${storeName(contract.storeId)} | ${contract.partyName} | ${money(contract.amount)} | ${contract.status}`
    );
  }

  lines.push("", `## Hakedişler (${input.progressPayments.length})`);
  for (const payment of input.progressPayments.slice(0, 100)) {
    const paid = paidAmountForPayment(payment.id, input.invoices);
    lines.push(
      `- ${payment.title} | ${storeName(payment.storeId)} | dönem: ${payment.periodLabel || "—"} | toplam: ${money(payment.amount)} | ödenen: ${money(paid)} | ${payment.status}`
    );
  }

  lines.push("", `## Faturalar (${input.invoices.length})`);
  for (const invoice of input.invoices.slice(0, 100)) {
    lines.push(
      `- ${invoice.invoiceNumber} | ${storeName(invoice.storeId)} | tutar: ${money(invoice.amount)} | KDV: ${money(invoice.taxAmount)} | ${invoice.status}${invoice.issuedAt ? ` | ${invoice.issuedAt}` : ""}`
    );
  }

  lines.push("", `## Tadilat talepleri (${input.tickets.length})`);
  for (const ticket of input.tickets.slice(0, 100)) {
    lines.push(
      `- ${ticket.code ?? ticket.title} | ${storeName(ticket.storeId)} | ${ticket.title} | öncelik: ${ticket.priority} | ${ticket.status}`
    );
  }

  // Mağaza detayları: keşif ve iş planı kalemleri (birim fiyat, tarih vb.)
  const ordered = pickDetailStores(input.stores, input.storeSummaries, input.question ?? "");
  const storesWithDetails = ordered.filter((store) => input.storeDetails[store.id]);

  lines.push("", "## Mağaza detayları (keşif ve iş planı)");
  let length = lines.join("\n").length;
  let skipped = 0;
  for (const store of storesWithDetails) {
    const data = input.storeDetails[store.id];
    const summary = input.storeSummaries[store.id];
    const materialCount = summary?.materialCount ?? data.materials.length;
    const workPlanCount = summary?.workPlanCount ?? data.workPlan.length;
    const block: string[] = [`### ${store.name} (${store.city})`];
    if (data.materials.length > 0) {
      block.push("Keşif (kalem | miktar | birim fiyat | tutar | durum):");
      for (const m of data.materials.slice(0, MAX_ITEMS_PER_STORE)) {
        block.push(
          `- ${m.name} | ${m.quantity} ${m.unit} | ${money(m.unitPrice)} | ${money(materialLineTotal(m))} | ${MATERIAL_STATUS[m.status] ?? m.status}`
        );
      }
      if (materialCount > data.materials.length) {
        block.push(`… ve ${materialCount - data.materials.length} keşif kalemi daha`);
      }
    }
    if (data.workPlan.length > 0) {
      block.push("İş planı (iş | başlangıç – bitiş | ilerleme | sorumlu | durum):");
      for (const w of data.workPlan.slice(0, MAX_ITEMS_PER_STORE)) {
        block.push(
          `- ${w.activityCode ? `${w.activityCode} ` : ""}${w.description} | ${w.startDate || "—"} – ${w.endDate || "—"} | %${w.percentComplete} | ${w.responsible || "—"} | ${WORK_PLAN_STATUS[w.status] ?? w.status}`
        );
      }
      if (workPlanCount > data.workPlan.length) {
        block.push(`… ve ${workPlanCount - data.workPlan.length} iş kalemi daha`);
      }
    }
    const text = block.join("\n");
    if (length + text.length + 1 > MAX_CONTEXT_CHARS) {
      skipped++;
      continue;
    }
    lines.push(text);
    length += text.length + 1;
  }
  const totalWithDetails = input.stores.filter((store) => {
    const summary = input.storeSummaries[store.id];
    return (summary?.materialCount ?? 0) + (summary?.workPlanCount ?? 0) > 0;
  }).length;
  if (totalWithDetails === 0) lines.push("Kayıtlı keşif veya iş planı yok.");
  // Detayı hiç çekilmeyen mağazalar da atlanmış sayılır
  skipped += totalWithDetails - storesWithDetails.length;
  if (skipped > 0) {
    lines.push(`(${skipped} mağazanın detayı boyut sınırı nedeniyle eklenmedi; soruda mağaza adını belirtin.)`);
  }

  return lines.join("\n");
}

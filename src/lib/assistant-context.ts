import { getOpeningAlert } from "@/lib/opening-dates";
import { paidAmountForPayment } from "@/lib/module-finance";
import type {
  Contract,
  Invoice,
  ProgressPayment,
  Store,
  StoreUserData,
  Ticket,
} from "@/types";

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
const MAX_ITEMS_PER_STORE = 60;

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
  storeData: Record<string, StoreUserData>;
  contracts: Contract[];
  progressPayments: ProgressPayment[];
  invoices: Invoice[];
  tickets: Ticket[];
};

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
    const data = input.storeData[store.id];
    const alert = store.openingDate ? getOpeningAlert(store.openingDate) : null;
    const workPlan = data?.workPlan ?? [];
    const materials = data?.materials ?? [];
    const progress =
      workPlan.length > 0
        ? Math.round(workPlan.reduce((sum, item) => sum + item.percentComplete, 0) / workPlan.length)
        : null;
    const materialTotal = materials.reduce((sum, m) => sum + m.quantity * m.unitPrice, 0);
    const parts = [
      `- ${store.name} | ${store.city} | durum: ${STATUS_LABELS[store.projectStatus] ?? store.projectStatus}`,
      store.openingDate ? `açılış: ${store.openingDate}${alert ? ` (${alert.label})` : ""}` : null,
      store.totalBudget ? `bütçe: ${money(store.totalBudget)}` : null,
      store.contractorCompany ? `yüklenici: ${store.contractorCompany}` : null,
      store.siteManager ? `şantiye şefi: ${store.siteManager}` : null,
      workPlan.length > 0 ? `iş planı: ${workPlan.length} kalem, ort. %${progress}` : null,
      materials.length > 0 ? `malzeme: ${materials.length} kalem, ${money(materialTotal)}` : null,
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

  // Mağaza detayları: malzeme ve iş planı kalemleri (birim fiyat, tarih vb.)
  const question = normalize(input.question ?? "");
  const storesWithDetails = input.stores.filter((store) => {
    const data = input.storeData[store.id];
    return (data?.materials.length ?? 0) + (data?.workPlan.length ?? 0) > 0;
  });
  const mentioned = (store: Store) => question.includes(normalize(store.name));
  const ordered = [
    ...storesWithDetails.filter(mentioned),
    ...storesWithDetails.filter((store) => !mentioned(store)),
  ];

  lines.push("", "## Mağaza detayları (malzemeler ve iş planı)");
  let length = lines.join("\n").length;
  let skipped = 0;
  for (const store of ordered) {
    const data = input.storeData[store.id];
    const block: string[] = [`### ${store.name} (${store.city})`];
    if (data.materials.length > 0) {
      block.push("Malzemeler (ad | miktar | birim fiyat | tutar | durum):");
      for (const m of data.materials.slice(0, MAX_ITEMS_PER_STORE)) {
        block.push(
          `- ${m.name} | ${m.quantity} ${m.unit} | ${money(m.unitPrice)} | ${money(m.quantity * m.unitPrice)} | ${MATERIAL_STATUS[m.status] ?? m.status}`
        );
      }
      if (data.materials.length > MAX_ITEMS_PER_STORE) {
        block.push(`… ve ${data.materials.length - MAX_ITEMS_PER_STORE} malzeme daha`);
      }
    }
    if (data.workPlan.length > 0) {
      block.push("İş planı (iş | başlangıç – bitiş | ilerleme | sorumlu | durum):");
      for (const w of data.workPlan.slice(0, MAX_ITEMS_PER_STORE)) {
        block.push(
          `- ${w.activityCode ? `${w.activityCode} ` : ""}${w.description} | ${w.startDate || "—"} – ${w.endDate || "—"} | %${w.percentComplete} | ${w.responsible || "—"} | ${WORK_PLAN_STATUS[w.status] ?? w.status}`
        );
      }
      if (data.workPlan.length > MAX_ITEMS_PER_STORE) {
        block.push(`… ve ${data.workPlan.length - MAX_ITEMS_PER_STORE} iş kalemi daha`);
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
  if (storesWithDetails.length === 0) lines.push("Kayıtlı malzeme veya iş planı yok.");
  if (skipped > 0) {
    lines.push(`(${skipped} mağazanın detayı boyut sınırı nedeniyle eklenmedi; soruda mağaza adını belirtin.)`);
  }

  return lines.join("\n");
}

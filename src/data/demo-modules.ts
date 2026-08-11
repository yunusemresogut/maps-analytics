/** Demo/static datasets for module tables — no backend. */

export type DemoTicket = {
  id: string;
  code: string;
  title: string;
  storeName: string;
  city: string;
  category: "mühendislik" | "şantiye" | "malzeme" | "onay" | "genel";
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "waiting" | "resolved" | "closed";
  assignee: string;
  createdBy: string;
  createdAt: string;
  dueDate: string;
};

export type DemoContract = {
  id: string;
  code: string;
  title: string;
  storeName: string;
  city: string;
  partyName: string;
  type: "yüklenici" | "alt yüklenici" | "kiralama" | "danışmanlık" | "malzeme";
  amount: number;
  currency: "TRY";
  startDate: string;
  endDate: string;
  status: "draft" | "active" | "pending_signature" | "expired" | "cancelled";
  signedBy?: string;
};

export type DemoProgressPayment = {
  id: string;
  code: string;
  title: string;
  storeName: string;
  city: string;
  contractor: string;
  periodLabel: string;
  progressPercent: number;
  amount: number;
  retentionAmount: number;
  netAmount: number;
  status: "draft" | "submitted" | "under_review" | "approved" | "paid" | "rejected";
  submittedAt: string;
};

export type DemoInvoice = {
  id: string;
  invoiceNumber: string;
  storeName: string;
  city: string;
  vendor: string;
  type: "hakediş" | "malzeme" | "hizmet" | "kira";
  amount: number;
  taxAmount: number;
  totalAmount: number;
  issuedAt: string;
  dueAt: string;
  status: "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "cancelled";
  relatedPaymentCode?: string;
};

export const DEMO_TICKETS: DemoTicket[] = [
  {
    id: "t1",
    code: "TKT-1042",
    title: "Mekanik proje revizyonu — klima santral kotu",
    storeName: "Zorlu Center",
    city: "İstanbul",
    category: "mühendislik",
    priority: "high",
    status: "in_progress",
    assignee: "Ayşe Kaya (Makine)",
    createdBy: "Proje Ofisi",
    createdAt: "2026-04-02",
    dueDate: "2026-04-12",
  },
  {
    id: "t2",
    code: "TKT-1048",
    title: "Elektrik pano bağlantı onayı bekleniyor",
    storeName: "Ankara Optimum",
    city: "Ankara",
    category: "onay",
    priority: "critical",
    status: "waiting",
    assignee: "Can Demir (Elektrik)",
    createdBy: "Şantiye Şefi",
    createdAt: "2026-04-05",
    dueDate: "2026-04-09",
  },
  {
    id: "t3",
    code: "TKT-1051",
    title: "Mimari cephe detayı güncellemesi",
    storeName: "İzmir Hilltown",
    city: "İzmir",
    category: "mühendislik",
    priority: "medium",
    status: "open",
    assignee: "Elif Yıldız (Mimar)",
    createdBy: "Bölge Müdürü",
    createdAt: "2026-04-06",
    dueDate: "2026-04-18",
  },
  {
    id: "t4",
    code: "TKT-1055",
    title: "Alçıpan malzeme sevkiyat gecikmesi",
    storeName: "Bursa Korupark",
    city: "Bursa",
    category: "malzeme",
    priority: "high",
    status: "in_progress",
    assignee: "Satınalma",
    createdBy: "Mağaza Müdürü",
    createdAt: "2026-04-07",
    dueDate: "2026-04-11",
  },
  {
    id: "t5",
    code: "TKT-1060",
    title: "İskele güvenlik denetimi notları",
    storeName: "Antalya MarkAntalya",
    city: "Antalya",
    category: "şantiye",
    priority: "medium",
    status: "resolved",
    assignee: "İSG Uzmanı",
    createdBy: "Şantiye Şefi",
    createdAt: "2026-03-28",
    dueDate: "2026-04-03",
  },
  {
    id: "t6",
    code: "TKT-1063",
    title: "Aydınlatma armatürü numune onayı",
    storeName: "Zorlu Center",
    city: "İstanbul",
    category: "onay",
    priority: "low",
    status: "closed",
    assignee: "Elif Yıldız (Mimar)",
    createdBy: "Proje Ofisi",
    createdAt: "2026-03-20",
    dueDate: "2026-03-27",
  },
  {
    id: "t7",
    code: "TKT-1068",
    title: "Saha ölçüm düzeltmesi — satış alanı m²",
    storeName: "Gaziantep Sanko Park",
    city: "Gaziantep",
    category: "genel",
    priority: "medium",
    status: "open",
    assignee: "Mehmet Akın (İnşaat)",
    createdBy: "Admin",
    createdAt: "2026-04-08",
    dueDate: "2026-04-15",
  },
];

export const DEMO_CONTRACTS: DemoContract[] = [
  {
    id: "c1",
    code: "SZL-2026-014",
    title: "Ana yüklenici taahhüt sözleşmesi",
    storeName: "Zorlu Center",
    city: "İstanbul",
    partyName: "Anadolu İnşaat A.Ş.",
    type: "yüklenici",
    amount: 18500000,
    currency: "TRY",
    startDate: "2026-01-15",
    endDate: "2026-08-30",
    status: "active",
    signedBy: "Burak Özdemir",
  },
  {
    id: "c2",
    code: "SZL-2026-018",
    title: "Mekanik taahhüt (HVAC + yangın)",
    storeName: "Ankara Optimum",
    city: "Ankara",
    partyName: "Soğuk Klima Mekanik Ltd.",
    type: "alt yüklenici",
    amount: 4200000,
    currency: "TRY",
    startDate: "2026-02-01",
    endDate: "2026-07-15",
    status: "active",
    signedBy: "Bölge Müdürü",
  },
  {
    id: "c3",
    code: "SZL-2026-021",
    title: "AVM kiralama ek protokolü",
    storeName: "İzmir Hilltown",
    city: "İzmir",
    partyName: "Hilltown AVM Yönetimi",
    type: "kiralama",
    amount: 9600000,
    currency: "TRY",
    startDate: "2026-03-01",
    endDate: "2031-02-28",
    status: "pending_signature",
  },
  {
    id: "c4",
    code: "SZL-2026-025",
    title: "Elektrik taahhüt sözleşmesi",
    storeName: "Bursa Korupark",
    city: "Bursa",
    partyName: "Volt Elektronik Taahhüt",
    type: "alt yüklenici",
    amount: 2750000,
    currency: "TRY",
    startDate: "2026-02-20",
    endDate: "2026-06-30",
    status: "active",
    signedBy: "Admin",
  },
  {
    id: "c5",
    code: "SZL-2025-092",
    title: "Mimari danışmanlık hizmeti",
    storeName: "Antalya MarkAntalya",
    city: "Antalya",
    partyName: "StudioForm Mimarlık",
    type: "danışmanlık",
    amount: 680000,
    currency: "TRY",
    startDate: "2025-11-01",
    endDate: "2026-03-31",
    status: "expired",
    signedBy: "Yönetici",
  },
  {
    id: "c6",
    code: "SZL-2026-030",
    title: "Vitrin mobilya tedarik sözleşmesi",
    storeName: "Gaziantep Sanko Park",
    city: "Gaziantep",
    partyName: "RetailFit Mobilya",
    type: "malzeme",
    amount: 1450000,
    currency: "TRY",
    startDate: "2026-04-01",
    endDate: "2026-05-30",
    status: "draft",
  },
];

export const DEMO_PROGRESS_PAYMENTS: DemoProgressPayment[] = [
  {
    id: "p1",
    code: "HKD-2026-03-01",
    title: "Mart dönemi kaba inşaat hakedişi",
    storeName: "Zorlu Center",
    city: "İstanbul",
    contractor: "Anadolu İnşaat A.Ş.",
    periodLabel: "2026 / Mart",
    progressPercent: 42,
    amount: 2450000,
    retentionAmount: 122500,
    netAmount: 2327500,
    status: "paid",
    submittedAt: "2026-04-01",
  },
  {
    id: "p2",
    code: "HKD-2026-03-02",
    title: "Mekanik montaj 2. hakediş",
    storeName: "Ankara Optimum",
    city: "Ankara",
    contractor: "Soğuk Klima Mekanik Ltd.",
    periodLabel: "2026 / Mart",
    progressPercent: 55,
    amount: 980000,
    retentionAmount: 49000,
    netAmount: 931000,
    status: "approved",
    submittedAt: "2026-04-03",
  },
  {
    id: "p3",
    code: "HKD-2026-04-01",
    title: "İnce işler hakedişi #1",
    storeName: "İzmir Hilltown",
    city: "İzmir",
    contractor: "Anadolu İnşaat A.Ş.",
    periodLabel: "2026 / Nisan",
    progressPercent: 28,
    amount: 1320000,
    retentionAmount: 66000,
    netAmount: 1254000,
    status: "under_review",
    submittedAt: "2026-04-08",
  },
  {
    id: "p4",
    code: "HKD-2026-04-02",
    title: "Elektrik kablolama & pano hakedişi",
    storeName: "Bursa Korupark",
    city: "Bursa",
    contractor: "Volt Elektronik Taahhüt",
    periodLabel: "2026 / Nisan",
    progressPercent: 35,
    amount: 640000,
    retentionAmount: 32000,
    netAmount: 608000,
    status: "submitted",
    submittedAt: "2026-04-09",
  },
  {
    id: "p5",
    code: "HKD-2026-04-03",
    title: "Şantiye hazırlık hakedişi (taslak)",
    storeName: "Gaziantep Sanko Park",
    city: "Gaziantep",
    contractor: "Anadolu İnşaat A.Ş.",
    periodLabel: "2026 / Nisan",
    progressPercent: 12,
    amount: 410000,
    retentionAmount: 20500,
    netAmount: 389500,
    status: "draft",
    submittedAt: "2026-04-10",
  },
  {
    id: "p6",
    code: "HKD-2026-02-04",
    title: "Hafriyat & betonarme hakedişi",
    storeName: "Antalya MarkAntalya",
    city: "Antalya",
    contractor: "Anadolu İnşaat A.Ş.",
    periodLabel: "2026 / Şubat",
    progressPercent: 70,
    amount: 1780000,
    retentionAmount: 89000,
    netAmount: 1691000,
    status: "rejected",
    submittedAt: "2026-03-02",
  },
];

export const DEMO_INVOICES: DemoInvoice[] = [
  {
    id: "i1",
    invoiceNumber: "FTR-2026-1140",
    storeName: "Zorlu Center",
    city: "İstanbul",
    vendor: "Anadolu İnşaat A.Ş.",
    type: "hakediş",
    amount: 2327500,
    taxAmount: 465500,
    totalAmount: 2793000,
    issuedAt: "2026-04-02",
    dueAt: "2026-04-17",
    status: "paid",
    relatedPaymentCode: "HKD-2026-03-01",
  },
  {
    id: "i2",
    invoiceNumber: "FTR-2026-1172",
    storeName: "Ankara Optimum",
    city: "Ankara",
    vendor: "Soğuk Klima Mekanik Ltd.",
    type: "hakediş",
    amount: 931000,
    taxAmount: 186200,
    totalAmount: 1117200,
    issuedAt: "2026-04-04",
    dueAt: "2026-04-19",
    status: "issued",
    relatedPaymentCode: "HKD-2026-03-02",
  },
  {
    id: "i3",
    invoiceNumber: "FTR-2026-1188",
    storeName: "Bursa Korupark",
    city: "Bursa",
    vendor: "RetailFit Mobilya",
    type: "malzeme",
    amount: 520000,
    taxAmount: 104000,
    totalAmount: 624000,
    issuedAt: "2026-04-06",
    dueAt: "2026-04-20",
    status: "partially_paid",
  },
  {
    id: "i4",
    invoiceNumber: "FTR-2026-1195",
    storeName: "İzmir Hilltown",
    city: "İzmir",
    vendor: "Hilltown AVM Yönetimi",
    type: "kira",
    amount: 280000,
    taxAmount: 56000,
    totalAmount: 336000,
    issuedAt: "2026-04-01",
    dueAt: "2026-04-10",
    status: "overdue",
  },
  {
    id: "i5",
    invoiceNumber: "FTR-2026-1201",
    storeName: "Gaziantep Sanko Park",
    city: "Gaziantep",
    vendor: "StudioForm Mimarlık",
    type: "hizmet",
    amount: 95000,
    taxAmount: 19000,
    totalAmount: 114000,
    issuedAt: "2026-04-08",
    dueAt: "2026-04-25",
    status: "draft",
  },
  {
    id: "i6",
    invoiceNumber: "FTR-2026-1102",
    storeName: "Antalya MarkAntalya",
    city: "Antalya",
    vendor: "Volt Elektronik Taahhüt",
    type: "hakediş",
    amount: 410000,
    taxAmount: 82000,
    totalAmount: 492000,
    issuedAt: "2026-03-15",
    dueAt: "2026-03-30",
    status: "cancelled",
  },
];

export function formatTry(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(amount);
}

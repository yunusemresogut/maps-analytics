import * as XLSX from "xlsx";
import { parseCurrency, parseDecimal, roundMoney, type CurrencyCode } from "@/lib/currency";
import { t } from "@/i18n/runtime";

export type ParsedMaterialRow = {
  /** Dosyada poz sütunu yoksa boş */
  pozNo?: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  /** Dosyada para birimi sütunu yoksa boş; içe aktarırken firmanın varsayılanı kullanılır */
  currency?: CurrencyCode;
  status?: string;
};

export type ExcelParseResult = {
  materials: ParsedMaterialRow[];
  errors: string[];
  matchedColumns: {
    pozNo?: string;
    description?: string;
    quantity?: string;
    unit?: string;
    unitPrice?: string;
    currency?: string;
    status?: string;
  };
};

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .trim();
}

function findColumn(
  headers: string[],
  matcher: (normalized: string) => boolean
): string | undefined {
  return headers.find((h) => matcher(normalizeHeader(h)));
}

/** Sayı hücresi olduğu gibi; metin hücresi "1.250,75" ya da "1,250.75" yazımıyla okunur */
function parseNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  return parseDecimal(String(value ?? "")) ?? 0;
}

export async function parseMaterialsFromExcel(
  file: File
): Promise<ExcelParseResult> {
  const errors: string[] = [];
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return { materials: [], errors: [t("site.excel.noSheet")], matchedColumns: {} };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    // Sayı hücreleri biçimlenmeden gelsin; biçimli metin ondalığı kaybettirebilir
    raw: true,
  });

  if (rows.length === 0) {
    return { materials: [], errors: [t("site.excel.noRows")], matchedColumns: {} };
  }

  const headers = Object.keys(rows[0]);

  // Türkçe başlıklar ve İngilizce şablonun başlıkları birlikte tanınır
  const pozCol = findColumn(headers, (h) => h.includes("poz") || h.includes("item code") || h === "code");
  const descriptionCol = findColumn(
    headers,
    (h) =>
      !h.includes("poz") &&
      !h.includes("code") &&
      (h.includes("aciklama") ||
        h.includes("ad") ||
        h.includes("isim") ||
        h.includes("tanim") ||
        h.includes("description") ||
        h.includes("name"))
  );
  const quantityCol = findColumn(headers, (h) => h.includes("miktar") || h.includes("quantity") || h === "qty");
  const currencyCol = findColumn(
    headers,
    (h) => h.includes("para birimi") || h.includes("doviz") || h.includes("currency")
  );
  const unitCol = findColumn(
    headers,
    (h) =>
      (h.includes("birim") && !h.includes("fiyat") && !h.includes("para")) ||
      (h.includes("unit") && !h.includes("price"))
  );
  const unitPriceCol = findColumn(
    headers,
    (h) => (h.includes("birim") && h.includes("fiyat")) || (h.includes("unit") && h.includes("price"))
  );
  const statusCol = findColumn(headers, (h) => h.includes("durum") || h.includes("stat"));

  const matchedColumns = {
    pozNo: pozCol,
    description: descriptionCol,
    quantity: quantityCol,
    unit: unitCol,
    unitPrice: unitPriceCol,
    currency: currencyCol,
    status: statusCol,
  };

  if (!descriptionCol) errors.push(t("site.excel.materials.missingDescription"));
  if (!quantityCol) errors.push(t("site.excel.materials.missingQuantity"));
  if (!unitPriceCol) errors.push(t("site.excel.materials.missingUnitPrice"));

  if (!descriptionCol || !quantityCol || !unitPriceCol) {
    return { materials: [], errors, matchedColumns };
  }

  const materials: ParsedMaterialRow[] = [];

  for (const row of rows) {
    const name = String(row[descriptionCol] ?? "").trim();
    if (!name) continue;

    const pozNo = pozCol ? String(row[pozCol] ?? "").trim() : "";
    const quantity = parseNumber(row[quantityCol]);
    const unit = unitCol
      ? String(row[unitCol] ?? "").trim()
      : "";
    const unitPrice = roundMoney(parseNumber(row[unitPriceCol]));
    const currency = currencyCol ? parseCurrency(String(row[currencyCol] ?? "")) ?? undefined : undefined;
    const rawStatus = statusCol ? String(row[statusCol] ?? "").trim().toLowerCase() : "bekleniyor";
    // İngilizce şablondaki "delivered" / "dispatched" değerleri de tanınır
    const status =
      rawStatus.includes("geld") || rawStatus === "geldi" || rawStatus.includes("deliver") || rawStatus.includes("arriv")
      ? "geldi"
      : rawStatus.includes("git") || rawStatus === "gitti" || rawStatus.includes("dispatch") || rawStatus === "sent"
        ? "gitti"
        : "bekleniyor";

    materials.push({ pozNo, name, quantity, unit, unitPrice, currency, status });
  }

  if (materials.length === 0) {
    errors.push(t("site.excel.materials.noValidRows"));
  }

  return { materials, errors, matchedColumns };
}

export function downloadMaterialsTemplate() {
  const headers = [
    [
      t("site.excel.materials.headers.pozNo"),
      t("site.excel.materials.headers.name"),
      t("site.excel.materials.headers.quantity"),
      t("site.excel.materials.headers.unit"),
      t("site.excel.materials.headers.unitPrice"),
      t("site.excel.materials.headers.currency"),
      t("site.excel.materials.headers.status"),
    ],
  ];
  const sampleData = [
    ["10.130.1005", t("site.excel.materials.sample.cement"), 150, t("site.excel.materials.sample.bag"), 320.5, "TRY", t("site.excel.materials.sample.pending")],
    ["10.140.1002", t("site.excel.materials.sample.steel"), 12, t("site.excel.materials.sample.ton"), 28000, "TRY", t("site.excel.materials.sample.arrived")],
    ["", t("site.excel.materials.sample.copper"), 45, t("site.excel.materials.sample.metre"), 4.75, "USD", t("site.excel.materials.sample.sent")],
  ];

  const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleData]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, t("site.excel.materials.sheetName"));

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = t("site.excel.materials.fileName");
  link.click();
}

import * as XLSX from "xlsx";
import { parseCurrency, parseDecimal, roundMoney, type CurrencyCode } from "@/lib/currency";

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
    return { materials: [], errors: ["Excel dosyasında sayfa bulunamadı"], matchedColumns: {} };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    // Sayı hücreleri biçimlenmeden gelsin; biçimli metin ondalığı kaybettirebilir
    raw: true,
  });

  if (rows.length === 0) {
    return { materials: [], errors: ["Dosyada veri satırı yok"], matchedColumns: {} };
  }

  const headers = Object.keys(rows[0]);

  const pozCol = findColumn(headers, (h) => h.includes("poz"));
  const descriptionCol = findColumn(
    headers,
    (h) => !h.includes("poz") && (h.includes("aciklama") || h.includes("ad") || h.includes("isim") || h.includes("tanim"))
  );
  const quantityCol = findColumn(headers, (h) => h.includes("miktar"));
  const currencyCol = findColumn(
    headers,
    (h) => h.includes("para birimi") || h.includes("doviz") || h.includes("currency")
  );
  const unitCol = findColumn(
    headers,
    (h) => h.includes("birim") && !h.includes("fiyat") && !h.includes("para")
  );
  const unitPriceCol = findColumn(
    headers,
    (h) => h.includes("birim") && h.includes("fiyat")
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

  if (!descriptionCol) errors.push('"Açıklama" veya "Kalem Adı" sütunu bulunamadı');
  if (!quantityCol) errors.push('"Miktar" sütunu bulunamadı');
  if (!unitPriceCol) errors.push('"Birim Fiyat" sütunu bulunamadı');

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
    const status = rawStatus.includes("geld") || rawStatus === "geldi"
      ? "geldi"
      : rawStatus.includes("git") || rawStatus === "gitti"
        ? "gitti"
        : "bekleniyor";

    materials.push({ pozNo, name, quantity, unit, unitPrice, currency, status });
  }

  if (materials.length === 0) {
    errors.push("Geçerli keşif satırı bulunamadı");
  }

  return { materials, errors, matchedColumns };
}

export function downloadMaterialsTemplate() {
  const headers = [["Poz No", "Kalem Adı", "Miktar", "Birim", "Birim Fiyat", "Para Birimi", "Durum"]];
  const sampleData = [
    ["10.130.1005", "Cement / Çimento", 150, "torba", 320.5, "TRY", "bekleniyor"],
    ["10.140.1002", "Steel Bars / İnşaat Demiri", 12, "ton", 28000, "TRY", "geldi"],
    ["", "Copper Pipe / Bakır Boru", 45, "metre", 4.75, "USD", "gitti"],
  ];

  const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleData]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Keşif");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "kesif_sablonu.xlsx";
  link.click();
}

import * as XLSX from "xlsx";

export type ParsedMaterialRow = {
  name: string;
  quantity: number;
  unitPrice: number;
};

export type ExcelParseResult = {
  materials: ParsedMaterialRow[];
  errors: string[];
  matchedColumns: {
    description?: string;
    quantity?: string;
    unitPrice?: string;
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

function parseNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const str = String(value ?? "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const num = parseFloat(str);
  return Number.isFinite(num) ? num : 0;
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
    raw: false,
  });

  if (rows.length === 0) {
    return { materials: [], errors: ["Dosyada veri satırı yok"], matchedColumns: {} };
  }

  const headers = Object.keys(rows[0]);

  const descriptionCol = findColumn(headers, (h) => h.includes("aciklama"));
  const quantityCol = findColumn(headers, (h) => h.includes("miktar"));
  const unitPriceCol = findColumn(
    headers,
    (h) => h.includes("birim") && h.includes("fiyat")
  );

  const matchedColumns = {
    description: descriptionCol,
    quantity: quantityCol,
    unitPrice: unitPriceCol,
  };

  if (!descriptionCol) errors.push('"Açıklama" sütunu bulunamadı');
  if (!quantityCol) errors.push('"Miktar" sütunu bulunamadı');
  if (!unitPriceCol) errors.push('"Birim Fiyat" sütunu bulunamadı');

  if (!descriptionCol || !quantityCol || !unitPriceCol) {
    return { materials: [], errors, matchedColumns };
  }

  const materials: ParsedMaterialRow[] = [];

  for (const row of rows) {
    const name = String(row[descriptionCol] ?? "").trim();
    if (!name) continue;

    const quantity = parseNumber(row[quantityCol]);
    const unitPrice = parseNumber(row[unitPriceCol]);

    materials.push({ name, quantity, unitPrice });
  }

  if (materials.length === 0) {
    errors.push("Geçerli malzeme satırı bulunamadı");
  }

  return { materials, errors, matchedColumns };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(value);
}

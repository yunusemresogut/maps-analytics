import * as XLSX from "xlsx";

export type ParsedMaterialRow = {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  status?: string;
};

export type ExcelParseResult = {
  materials: ParsedMaterialRow[];
  errors: string[];
  matchedColumns: {
    description?: string;
    quantity?: string;
    unit?: string;
    unitPrice?: string;
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

  const descriptionCol = findColumn(headers, (h) => h.includes("aciklama") || h.includes("ad") || h.includes("isim") || h.includes("tanim"));
  const quantityCol = findColumn(headers, (h) => h.includes("miktar"));
  const unitCol = findColumn(
    headers,
    (h) => h.includes("birim") && !h.includes("fiyat")
  );
  const unitPriceCol = findColumn(
    headers,
    (h) => h.includes("birim") && h.includes("fiyat")
  );
  const statusCol = findColumn(headers, (h) => h.includes("durum") || h.includes("stat"));

  const matchedColumns = {
    description: descriptionCol,
    quantity: quantityCol,
    unit: unitCol,
    unitPrice: unitPriceCol,
    status: statusCol,
  };

  if (!descriptionCol) errors.push('"Açıklama" veya "Malzeme Adı" sütunu bulunamadı');
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
    const unit = unitCol
      ? String(row[unitCol] ?? "").trim()
      : "";
    const unitPrice = parseNumber(row[unitPriceCol]);
    const rawStatus = statusCol ? String(row[statusCol] ?? "").trim().toLowerCase() : "bekleniyor";
    const status = rawStatus.includes("geld") || rawStatus === "geldi"
      ? "geldi"
      : rawStatus.includes("git") || rawStatus === "gitti"
        ? "gitti"
        : "bekleniyor";

    materials.push({ name, quantity, unit, unitPrice, status });
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

export function downloadMaterialsTemplate() {
  const headers = [["Malzeme Adı", "Miktar", "Birim", "Birim Fiyat", "Durum"]];
  const sampleData = [
    ["Cement / Çimento", 150, "torba", 320, "bekleniyor"],
    ["Steel Bars / İnşaat Demiri", 12, "ton", 28000, "geldi"],
    ["Copper Pipe / Bakır Boru", 45, "metre", 150, "gitti"],
  ];

  const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleData]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Malzemeler");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "malzeme_sablonu.xlsx";
  link.click();
}

import * as XLSX from "xlsx";

export type ParsedWorkPlanRow = {
  description: string;
  startDate: string;
  endDate: string;
  responsible: string;
  status: string;
};

export type WorkPlanParseResult = {
  items: ParsedWorkPlanRow[];
  errors: string[];
  matchedColumns: {
    description?: string;
    startDate?: string;
    endDate?: string;
    responsible?: string;
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

function parseCell(value: unknown): string {
  return String(value ?? "").trim();
}

export async function parseWorkPlanFromExcel(
  file: File
): Promise<WorkPlanParseResult> {
  const errors: string[] = [];
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return { items: [], errors: ["Excel dosyasında sayfa bulunamadı"], matchedColumns: {} };
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (rows.length === 0) {
    return { items: [], errors: ["Dosyada veri satırı yok"], matchedColumns: {} };
  }

  const headers = Object.keys(rows[0]);

  const descriptionCol = findColumn(
    headers,
    (h) =>
      h.includes("aciklama") ||
      h.includes("is tanim") ||
      h.includes("is adi") ||
      h === "is"
  );
  const startDateCol = findColumn(
    headers,
    (h) => h.includes("baslangic") || h.includes("baslama")
  );
  const endDateCol = findColumn(
    headers,
    (h) => h.includes("bitis") || h.includes("tamamlanma")
  );
  const responsibleCol = findColumn(
    headers,
    (h) => h.includes("sorumlu") || h.includes("yetkili")
  );
  const statusCol = findColumn(headers, (h) => h.includes("durum"));

  const matchedColumns = {
    description: descriptionCol,
    startDate: startDateCol,
    endDate: endDateCol,
    responsible: responsibleCol,
    status: statusCol,
  };

  if (!descriptionCol) errors.push('"Açıklama" veya "İş" sütunu bulunamadı');

  if (!descriptionCol) {
    return { items: [], errors, matchedColumns };
  }

  const items: ParsedWorkPlanRow[] = [];

  for (const row of rows) {
    const description = parseCell(row[descriptionCol]);
    if (!description) continue;

    const rawStatus = statusCol ? parseCell(row[statusCol]).toLowerCase() : "yapilacak";
    const status = rawStatus.includes("tamam") || rawStatus.includes("done") || rawStatus.includes("bit")
      ? "tamamlandi"
      : rawStatus.includes("devam") || rawStatus.includes("progress") || rawStatus.includes("sur")
        ? "devam_ediyor"
        : "yapilacak";

    items.push({
      description,
      startDate: startDateCol ? parseCell(row[startDateCol]) : "",
      endDate: endDateCol ? parseCell(row[endDateCol]) : "",
      responsible: responsibleCol ? parseCell(row[responsibleCol]) : "Belirtilmemiş",
      status,
    });
  }

  if (items.length === 0) {
    errors.push("Geçerli iş planı satırı bulunamadı");
  }

  return { items, errors, matchedColumns };
}

export function downloadWorkPlanTemplate() {
  const headers = [["Açıklama", "Başlangıç Tarihi", "Bitiş Tarihi", "Sorumlu", "Durum"]];
  const sampleData = [
    ["Kaba İnşaat Başlangıcı", "2026-07-10", "2026-07-25", "Ahmet Yılmaz", "devam_ediyor"],
    ["Elektrik Kablolama", "2026-07-26", "2026-08-05", "Mehmet Kaya", "yapilacak"],
    ["İç Cephe Boyası", "2026-08-06", "2026-08-12", "Canan Demir", "yapilacak"],
  ];

  const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleData]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "İş Planı");

  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "is_plani_sablonu.xlsx";
  link.click();
}

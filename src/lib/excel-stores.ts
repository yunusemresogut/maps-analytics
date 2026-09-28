import * as XLSX from "xlsx";
import type { StoreInput } from "@/types";

/** Tek seferde en fazla içe aktarılacak mağaza sayısı */
export const MAX_BULK_STORE_IMPORT = 50;

export type ParsedStoreRow = {
  name: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  projectStatus?: StoreInput["projectStatus"];
  openingDate?: string;
};

export type StoreImportRowInput = {
  row: number;
  name: string;
  city: string;
  address: string;
  projectStatus?: StoreInput["projectStatus"];
  openingDate?: string;
};

export type StoreImportFieldError = {
  row: number;
  field: string;
  message: string;
};

export type StoreImportParseResult =
  | { ok: true; rows: StoreImportRowInput[] }
  | { ok: false; errors: StoreImportFieldError[] };

const HEADER_MAP: Record<string, keyof StoreImportRowInput> = {
  ad: "name",
  name: "name",
  mağaza: "name",
  magaza: "name",
  şehir: "city",
  sehir: "city",
  city: "city",
  adres: "address",
  address: "address",
  durum: "projectStatus",
  status: "projectStatus",
  "açılış tarihi": "openingDate",
  acilis: "openingDate",
  openingdate: "openingDate",
};

function normalizeHeader(h: string): string {
  return h.trim().toLocaleLowerCase("tr");
}

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    name: "Ad",
    city: "Şehir",
    address: "Adres",
    projectStatus: "Durum",
    openingDate: "Açılış tarihi",
    geocode: "Adres (konum)",
  };
  return labels[field] ?? field;
}

export function parseStoresExcel(buffer: ArrayBuffer): StoreImportParseResult {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) {
    return {
      ok: false,
      errors: [{ row: 0, field: "dosya", message: "Excel sayfası bulunamadı" }],
    };
  }

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  if (raw.length === 0) {
    return {
      ok: false,
      errors: [{ row: 0, field: "dosya", message: "Dosyada satır yok" }],
    };
  }
  if (raw.length > MAX_BULK_STORE_IMPORT) {
    return {
      ok: false,
      errors: [
        {
          row: 0,
          field: "dosya",
          message: `En fazla ${MAX_BULK_STORE_IMPORT} mağaza yüklenebilir`,
        },
      ],
    };
  }

  const firstKeys = Object.keys(raw[0]);
  const colMap = new Map<number, keyof StoreImportRowInput>();
  firstKeys.forEach((key, idx) => {
    const mapped = HEADER_MAP[normalizeHeader(key)];
    if (mapped && mapped !== "row") colMap.set(idx, mapped);
  });

  const hasNameCol = [...colMap.values()].includes("name");
  const hasCityCol = [...colMap.values()].includes("city");
  const hasAddressCol = [...colMap.values()].includes("address");
  if (!hasNameCol || !hasCityCol || !hasAddressCol) {
    return {
      ok: false,
      errors: [
        {
          row: 1,
          field: "dosya",
          message: "Zorunlu sütunlar eksik: Ad, Şehir, Adres",
        },
      ],
    };
  }

  const errors: StoreImportFieldError[] = [];
  const rows: StoreImportRowInput[] = [];

  for (let i = 0; i < raw.length; i++) {
    const rowNum = i + 2;
    const row = raw[i];
    const parsed: Partial<StoreImportRowInput> = { row: rowNum };

    firstKeys.forEach((key, idx) => {
      const field = colMap.get(idx);
      if (!field || field === "row") return;
      const val = String(row[key] ?? "").trim();
      if (field === "projectStatus") {
        parsed.projectStatus = val as StoreImportRowInput["projectStatus"];
      } else if (field === "openingDate") {
        parsed.openingDate = val;
      } else {
        (parsed as Record<string, string>)[field] = val;
      }
    });

    if (!parsed.name) {
      errors.push({
        row: rowNum,
        field: "name",
        message: `${fieldLabel("name")} boş olamaz`,
      });
    }
    if (!parsed.city) {
      errors.push({
        row: rowNum,
        field: "city",
        message: `${fieldLabel("city")} boş olamaz`,
      });
    }
    if (!parsed.address) {
      errors.push({
        row: rowNum,
        field: "address",
        message: `${fieldLabel("address")} boş olamaz`,
      });
    }

    if (parsed.name && parsed.city && parsed.address) {
      rows.push(parsed as StoreImportRowInput);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, rows };
}

type GeocodeApiResult = {
  results?: Array<{
    label: string;
    address: string;
    city: string;
    latitude: number;
    longitude: number;
  }>;
};

/** Her satır için adres araması yapar; bulunamayan satırları listeler */
export async function geocodeStoreImportRows(
  rows: StoreImportRowInput[]
): Promise<
  | { ok: true; rows: ParsedStoreRow[] }
  | { ok: false; errors: StoreImportFieldError[] }
> {
  const errors: StoreImportFieldError[] = [];
  const resolved: ParsedStoreRow[] = [];

  for (const row of rows) {
    const q = `${row.address}, ${row.city}, Türkiye`;
    try {
      const res = await fetch(
        `/api/geocode/search?q=${encodeURIComponent(q)}`
      );
      const data = (await res.json()) as GeocodeApiResult;
      const hit = data.results?.[0];
      if (!hit) {
        errors.push({
          row: row.row,
          field: "geocode",
          message: `Adres bulunamadı: "${row.address}, ${row.city}"`,
        });
        continue;
      }
      resolved.push({
        name: row.name,
        city: hit.city || row.city,
        address: hit.address || row.address,
        latitude: hit.latitude,
        longitude: hit.longitude,
        projectStatus: row.projectStatus,
        openingDate: row.openingDate,
      });
    } catch {
      errors.push({
        row: row.row,
        field: "geocode",
        message: "Adres araması başarısız",
      });
    }
    // Nominatim rate limit
    await new Promise((r) => setTimeout(r, 350));
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, rows: resolved };
}

export const STORE_IMPORT_TEMPLATE_HEADERS = ["Ad", "Şehir", "Adres"] as const;

export function downloadStoreImportTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    [...STORE_IMPORT_TEMPLATE_HEADERS],
    ["Örnek Mağaza", "İstanbul", "Kadıköy Moda Caddesi No:1"],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Mağazalar");
  XLSX.writeFile(wb, "magaza-import-sablonu.xlsx");
}

export function formatImportErrors(errors: StoreImportFieldError[]): string {
  return errors
    .map((e) =>
      e.row > 0
        ? `Satır ${e.row} · ${fieldLabel(e.field)}: ${e.message}`
        : e.message
    )
    .join("\n");
}

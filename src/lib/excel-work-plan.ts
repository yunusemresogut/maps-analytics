import * as XLSX from "xlsx";
import type { WorkPlanDependencyType } from "@/types";

export type ParsedWorkPlanPredecessor = {
  sourceTaskId: string;
  type: WorkPlanDependencyType;
  lagHours: number;
};

export type ParsedWorkPlanRow = {
  description: string;
  startDate: string;
  endDate: string;
  responsible: string;
  status: string;
  sourceTaskId?: string;
  activityCode?: string;
  wbsCode?: string;
  percentComplete?: number;
  predecessorSourceIds?: ParsedWorkPlanPredecessor[];
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
    activityCode?: string;
    wbsCode?: string;
    predecessorSourceIds?: string;
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

function splitXerRecord(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (character === "\t" && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += character;
    }
  }
  fields.push(field);
  return fields;
}

function xerDate(value: string | undefined): string {
  if (!value) return "";
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? "";
}

export async function parseWorkPlanFromXer(file: File): Promise<WorkPlanParseResult> {
  const lines = (await file.text()).replace(/^\uFEFF/, "").split(/\r?\n/);
  const tasks: Record<string, string>[] = [];
  const taskPredecessors: Record<string, string>[] = [];
  const wbsRecords: Record<string, string>[] = [];
  let tableName = "";
  let fields: string[] = [];

  for (const line of lines) {
    if (!line) continue;
    const [recordType, ...record] = splitXerRecord(line);
    if (recordType === "%T") {
      tableName = record[0]?.toUpperCase() ?? "";
      fields = [];
      continue;
    }
    if (recordType === "%F") {
      fields = record.map((field) => field.trim().toLowerCase());
      continue;
    }
    if (recordType !== "%R" || fields.length === 0) continue;

    const values = Object.fromEntries(
      fields.map((field, index) => [field, record[index] ?? ""])
    );
    if (tableName === "TASK") tasks.push(values);
    if (tableName === "TASKPRED") taskPredecessors.push(values);
    if (tableName === "WBS") wbsRecords.push(values);
  }

  const wbsById = new Map(
    wbsRecords.map((row) => [
      row.wbs_id,
      row.wbs_short_name || row.wbs_code || row.wbs_name || "",
    ])
  );
  const predecessorsByTaskId = new Map<string, ParsedWorkPlanPredecessor[]>();
  for (const row of taskPredecessors) {
    const successorId = row.task_id;
    const predecessorId = row.pred_task_id;
    if (!successorId || !predecessorId) continue;
    const rawType = (row.pred_type || "PR_FS").toUpperCase();
    const typeMatch = rawType.match(/(FS|SS|FF|SF)$/)?.[1] ?? "FS";
    const dependency: ParsedWorkPlanPredecessor = {
      sourceTaskId: predecessorId,
      type: typeMatch as WorkPlanDependencyType,
      lagHours: Number(row.lag_hr_cnt || 0) || 0,
    };
    predecessorsByTaskId.set(successorId, [
      ...(predecessorsByTaskId.get(successorId) ?? []),
      dependency,
    ]);
  }

  const items: ParsedWorkPlanRow[] = [];
  for (const values of tasks) {
    const description =
      values.task_name?.trim() || values.task_code?.trim() || "";
    if (!description) continue;

    const actualStart = xerDate(values.act_start_date);
    const actualEnd = xerDate(values.act_end_date);
    const startDate =
      actualStart ||
      xerDate(values.target_start_date) ||
      xerDate(values.early_start_date);
    const endDate =
      actualEnd ||
      xerDate(values.target_end_date) ||
      xerDate(values.early_end_date);
    const percentText = (values.phys_complete_pct || values.complete_pct || "")
      .replace("%", "")
      .trim();
    const percent = percentText ? Number(percentText) : null;
    const rawStatus = (values.status_code || "").toLowerCase();
    const status = percent !== null && Number.isFinite(percent)
      ? percent >= 100
        ? "tamamlandi"
        : percent > 0
          ? "devam_ediyor"
          : "yapilacak"
      : rawStatus.includes("complete")
        ? "tamamlandi"
        : rawStatus.includes("progress")
          ? "devam_ediyor"
          : "yapilacak";

    items.push({
      description,
      startDate,
      endDate,
      responsible: "Belirtilmemiş",
      status,
      sourceTaskId: values.task_id || undefined,
      activityCode: values.task_code || undefined,
      wbsCode: wbsById.get(values.wbs_id) || undefined,
      percentComplete:
        percent !== null && Number.isFinite(percent)
          ? Math.min(100, Math.max(0, percent))
          : status === "tamamlandi"
            ? 100
            : status === "devam_ediyor"
              ? 50
              : 0,
      predecessorSourceIds: predecessorsByTaskId.get(values.task_id) ?? [],
    });
  }

  const errors =
    items.length === 0
      ? ["XER dosyasında içe aktarılabilir TASK aktivitesi bulunamadı"]
      : [];
  return {
    items,
    errors,
    matchedColumns: {
      description: "TASK.task_name / task_code",
      startDate: "act/target/early_start_date",
      endDate: "act/target/early_end_date",
      status: "phys_complete_pct / status_code",
      activityCode: "TASK.task_code",
      wbsCode: "WBS.wbs_short_name / wbs_name",
      predecessorSourceIds: "TASKPRED.task_id / pred_task_id",
    },
  };
}

export function parseWorkPlanFile(file: File): Promise<WorkPlanParseResult> {
  return file.name.toLowerCase().endsWith(".xer")
    ? parseWorkPlanFromXer(file)
    : parseWorkPlanFromExcel(file);
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

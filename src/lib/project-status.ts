import type { ProjectStatus } from "@/types";

export const projectStatusConfig: Record<
  ProjectStatus,
  { label: string; color: string; marker: string }
> = {
  proje: {
    label: "Proje",
    color: "text-cyan-400",
    marker: "#22d3ee",
  },
  ihale: {
    label: "İhale",
    color: "text-violet-400",
    marker: "#a78bfa",
  },
  santiye: {
    label: "Şantiye",
    color: "text-amber-400",
    marker: "#fbbf24",
  },
  acilis: {
    label: "Açılış",
    color: "text-emerald-400",
    marker: "#34d399",
  },
  hakedis: {
    label: "Hakediş",
    color: "text-orange-400",
    marker: "#fb923c",
  },
  fatura: {
    label: "Fatura",
    color: "text-pink-400",
    marker: "#f472b6",
  },
  yakinda_aciliyor: {
    label: "Yakında Açılıyor",
    color: "text-red-400",
    marker: "#f87171",
  },
};

export const projectStatusOptions = (
  Object.keys(projectStatusConfig) as ProjectStatus[]
).map((value) => ({
  value,
  label: projectStatusConfig[value].label,
}));

/** İhale ve Proje durumlarında Excel import desteklenir */
export const EXCEL_IMPORT_STATUSES: ProjectStatus[] = ["proje", "ihale"];

export function supportsExcelImport(status: ProjectStatus): boolean {
  return EXCEL_IMPORT_STATUSES.includes(status);
}

export function supportsOrderReminder(status: ProjectStatus): boolean {
  return status === "ihale";
}

/** Eski durum değerlerini yeniye map et */
const LEGACY_STATUS_MAP: Record<string, ProjectStatus> = {
  tamamlandi: "acilis",
  beklemede: "proje",
  santiye: "santiye",
  proje: "proje",
};

export function migrateProjectStatus(status: string): ProjectStatus {
  if (status in projectStatusConfig) return status as ProjectStatus;
  return LEGACY_STATUS_MAP[status] ?? "proje";
}

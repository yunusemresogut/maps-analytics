import type { TranslationKey } from "@/i18n";
import type { ProjectStatus } from "@/types";

export const projectStatusConfig: Record<
  ProjectStatus,
  { labelKey: TranslationKey; color: string; marker: string }
> = {
  proje: {
    labelKey: "status.proje",
    color: "text-cyan-400",
    marker: "#22d3ee",
  },
  ihale: {
    labelKey: "status.ihale",
    color: "text-violet-400",
    marker: "#a78bfa",
  },
  santiye: {
    labelKey: "status.santiye",
    color: "text-amber-400",
    marker: "#fbbf24",
  },
  acilis: {
    labelKey: "status.acilis",
    color: "text-emerald-400",
    marker: "#34d399",
  },
  hakedis: {
    labelKey: "status.hakedis",
    color: "text-orange-400",
    marker: "#fb923c",
  },
  fatura: {
    labelKey: "status.fatura",
    color: "text-pink-400",
    marker: "#f472b6",
  },
  yakinda_aciliyor: {
    labelKey: "status.yakinda_aciliyor",
    color: "text-red-400",
    marker: "#f87171",
  },
};

type TranslateFn = (key: TranslationKey) => string;

export function getProjectStatusLabel(
  status: ProjectStatus,
  t: TranslateFn
): string {
  return t(projectStatusConfig[status].labelKey);
}

export function getProjectStatusOptions(t: TranslateFn) {
  return (Object.keys(projectStatusConfig) as ProjectStatus[])
    .filter((value) => value !== "yakinda_aciliyor")
    .map((value) => ({
      value,
      label: getProjectStatusLabel(value, t),
    }));
}

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

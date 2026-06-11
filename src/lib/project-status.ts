import type { ProjectStatus } from "@/types";

export const projectStatusConfig: Record<
  ProjectStatus,
  { label: string; color: string; marker: string }
> = {
  tamamlandi: {
    label: "Tamamlandı",
    color: "text-emerald-400",
    marker: "#34d399",
  },
  santiye: {
    label: "Şantiye",
    color: "text-amber-400",
    marker: "#fbbf24",
  },
  proje: {
    label: "Proje",
    color: "text-cyan-400",
    marker: "#22d3ee",
  },
  beklemede: {
    label: "Beklemede",
    color: "text-zinc-400",
    marker: "#a1a1aa",
  },
};

export const projectStatusOptions = (
  Object.keys(projectStatusConfig) as ProjectStatus[]
).map((value) => ({
  value,
  label: projectStatusConfig[value].label,
}));

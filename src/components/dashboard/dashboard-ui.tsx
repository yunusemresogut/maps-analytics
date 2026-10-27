"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { useT } from "@/contexts/i18n-context";
import { cn } from "@/lib/utils";

/** Pano bölüm kartı: başlık, ne gösterdiğini anlatan kısa açıklama, isteğe bağlı bağlantı */
export function Panel({
  title,
  description,
  icon: Icon,
  href,
  hrefLabel,
  className,
  children,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  href?: string;
  hrefLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <section className={cn("flex min-w-0 flex-col rounded-xl border border-zinc-800 bg-zinc-900/50", className)}>
      <header className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            {Icon && <Icon className="h-4 w-4 shrink-0 text-zinc-500" />}
            {title}
          </h2>
          {description && <p className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>}
        </div>
        {href && (
          <Link
            href={href}
            className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-cyan-400 transition-colors hover:bg-cyan-500/10"
          >
            {hrefLabel ?? t("common.all")}
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </header>
      <div className="flex-1 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">{children}</div>
    </section>
  );
}

export type Tone = "default" | "good" | "warning" | "critical";

const TONE_TEXT: Record<Tone, string> = {
  default: "text-zinc-100",
  good: "text-emerald-400",
  warning: "text-amber-400",
  critical: "text-red-400",
};

/** Tek sayı göstergesi; `hint` sayının nasıl hesaplandığını ya da bağlamını söyler */
export function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-zinc-500">{label}</p>
        <Icon className="h-4 w-4 shrink-0 text-zinc-600" />
      </div>
      <p className={cn("mt-2 truncate text-2xl font-semibold tabular-nums", TONE_TEXT[tone])}>{value}</p>
      {hint && <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{hint}</p>}
    </>
  );
  const className = "block min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4";
  return href ? (
    <Link href={href} className={cn(className, "transition-colors hover:border-zinc-700 hover:bg-zinc-900")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** Etiketli yatay çubuk; renk yalnızca kimlik taşır, değer metinle yazılır */
export function BarRow({
  label,
  value,
  max,
  display,
  color,
  barClassName,
  marker,
  href,
  title,
}: {
  label: ReactNode;
  value: number;
  max: number;
  display?: ReactNode;
  /** Satır başındaki kimlik rengi (ör. durum rengi) */
  color?: string;
  /** Çubuk rengi; verilmezse `color`, o da yoksa marka rengi */
  barClassName?: string;
  /** Çubuğun üzerinde ince işaret çizgisi (%; ör. bütçe sınırı) */
  marker?: number;
  href?: string;
  title?: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const content = (
    <>
      <span className="flex w-28 shrink-0 items-center gap-2 truncate text-xs text-zinc-400 sm:w-32">
        {color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
        <span className="truncate">{label}</span>
      </span>
      <span className="relative h-2 flex-1 rounded-full bg-zinc-800">
        <span
          className={cn("absolute inset-y-0 left-0 rounded-full", barClassName ?? (color ? undefined : "bg-cyan-500"))}
          style={{ width: `${pct}%`, ...(color && !barClassName ? { backgroundColor: color } : {}) }}
        />
        {marker !== undefined && (
          <span className="absolute -inset-y-1 w-0.5 rounded-full bg-zinc-400" style={{ left: `${Math.min(100, marker)}%` }} />
        )}
      </span>
      <span className="w-20 shrink-0 text-right text-xs tabular-nums text-zinc-300">{display ?? value}</span>
    </>
  );
  const className = "flex items-center gap-3";
  return href ? (
    <Link href={href} title={title} className={cn(className, "-mx-2 rounded-md px-2 py-0.5 hover:bg-zinc-800/50")}>
      {content}
    </Link>
  ) : (
    <div title={title} className={className}>
      {content}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-zinc-800 px-3 py-6 text-center text-sm text-zinc-500">{children}</p>;
}

/** Bölüm başlığı: ilgili panelleri gruplar */
export function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-3 mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>
      {description && <p className="text-xs text-zinc-600">{description}</p>}
    </div>
  );
}

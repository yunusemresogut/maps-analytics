import { cn } from "@/lib/utils";

export function Select({
  className,
  children,
  "aria-invalid": ariaInvalid,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      aria-invalid={ariaInvalid}
      className={cn(
        "flex h-10 w-full rounded-lg border bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-1",
        ariaInvalid
          ? "border-red-500/60 focus:border-red-400/70 focus:ring-red-500/30"
          : "border-zinc-700/80 focus:border-cyan-500/50 focus:ring-cyan-500/30",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

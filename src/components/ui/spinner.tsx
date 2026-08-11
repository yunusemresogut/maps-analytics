import { cn } from "@/lib/utils";

export function Spinner({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dim =
    size === "sm" ? "h-3.5 w-3.5 border" : size === "lg" ? "h-8 w-8 border-2" : "h-5 w-5 border-2";

  return (
    <span
      aria-hidden
      className={cn(
        "inline-block animate-spin rounded-full border-cyan-500/30 border-t-cyan-400",
        dim,
        className
      )}
    />
  );
}

export function PageLoader({ label = "Yükleniyor..." }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[12rem] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-zinc-500">{label}</p>
      </div>
    </div>
  );
}

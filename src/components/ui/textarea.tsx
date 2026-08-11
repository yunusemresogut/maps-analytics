import { cn } from "@/lib/utils";

export function Textarea({
  className,
  "aria-invalid": ariaInvalid,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      aria-invalid={ariaInvalid}
      className={cn(
        "flex min-h-[80px] w-full resize-none rounded-lg border bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1",
        ariaInvalid
          ? "border-red-500/60 focus:border-red-400/70 focus:ring-red-500/30"
          : "border-zinc-700/80 focus:border-cyan-500/50 focus:ring-cyan-500/30",
        className
      )}
      {...props}
    />
  );
}

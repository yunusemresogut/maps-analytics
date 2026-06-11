import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30",
        className
      )}
      {...props}
    />
  );
}

import { cn } from "@/lib/utils";

const NATIVE_PICKER_TYPES = new Set([
  "date",
  "datetime-local",
  "time",
  "month",
  "week",
]);

export function Input({
  className,
  type,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  if (type && NATIVE_PICKER_TYPES.has(type)) {
    return (
      <input
        type={type}
        className={cn("block w-full min-w-0", className)}
        {...props}
      />
    );
  }

  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30",
        className
      )}
      {...props}
    />
  );
}


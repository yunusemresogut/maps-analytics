import { cn } from "@/lib/utils";

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 resize-none",
        className
      )}
      {...props}
    />
  );
}

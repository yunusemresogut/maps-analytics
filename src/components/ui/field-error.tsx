import { cn } from "@/lib/utils";

export function FieldError({
  message,
  className,
}: {
  message?: string;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p className={cn("mt-1 text-xs text-red-400", className)} role="alert">
      {message}
    </p>
  );
}

export function FormError({
  message,
  className,
}: {
  message?: string;
  className?: string;
}) {
  if (!message) return null;
  return (
    <div
      className={cn(
        "rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300",
        className
      )}
      role="alert"
    >
      {message}
    </div>
  );
}

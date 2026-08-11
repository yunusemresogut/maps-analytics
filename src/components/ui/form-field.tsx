import { cn } from "@/lib/utils";
import { FieldError } from "@/components/ui/field-error";

type FormFieldProps = {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
};

export function FormField({
  label,
  required,
  error,
  hint,
  htmlFor,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-1 text-sm text-zinc-400"
      >
        <span>{label}</span>
        {required && (
          <span className="text-red-400" aria-hidden title="Zorunlu alan">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <FieldError message={error} />
      ) : hint ? (
        <p className="text-xs text-zinc-600">{hint}</p>
      ) : null}
    </div>
  );
}

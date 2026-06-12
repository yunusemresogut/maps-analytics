import { cn } from "@/lib/utils";

type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
};

export function Switch({ checked, onChange, disabled, label }: SwitchProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2",
        disabled && "opacity-50"
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-cyan-500/80" : "bg-zinc-700",
          disabled ? "cursor-not-allowed" : "cursor-pointer"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-4"
          )}
        />
      </button>
      {label && <span className="text-xs text-zinc-400">{label}</span>}
    </div>
  );
}

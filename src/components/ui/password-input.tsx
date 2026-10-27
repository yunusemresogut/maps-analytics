"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useT } from "@/contexts/i18n-context";
import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  showPasswordLabel?: string;
  hidePasswordLabel?: string;
};

export function PasswordInput({
  className,
  showPasswordLabel: showLabel,
  hidePasswordLabel: hideLabel,
  ...props
}: PasswordInputProps) {
  const t = useT();
  const showPasswordLabel = showLabel ?? t("auth.showPassword");
  const hidePasswordLabel = hideLabel ?? t("auth.hidePassword");
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn("pr-10", className)}
      />
      {/* Tab ile alanlar arasında geçerken atlanır; tıklamada odak input'ta kalır */}
      <button
        type="button"
        tabIndex={-1}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-zinc-500 transition-colors hover:text-zinc-300"
        aria-label={visible ? hidePasswordLabel : showPasswordLabel}
        aria-pressed={visible}
        title={visible ? hidePasswordLabel : showPasswordLabel}
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden />
        ) : (
          <Eye className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
}

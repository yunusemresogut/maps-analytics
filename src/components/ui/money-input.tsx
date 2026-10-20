"use client";

import { useState } from "react";
import {
  DollarSign,
  Euro,
  PoundSterling,
  SwissFranc,
  TurkishLira,
  type LucideIcon,
} from "lucide-react";
import { Select } from "@/components/ui/select";
import {
  CURRENCIES,
  CURRENCY_CODES,
  formatMoneyInput,
  parseMoney,
  type CurrencyCode,
} from "@/lib/currency";
import { cn } from "@/lib/utils";

export const CURRENCY_ICONS: Record<CurrencyCode, LucideIcon> = {
  TRY: TurkishLira,
  USD: DollarSign,
  EUR: Euro,
  GBP: PoundSterling,
  CHF: SwissFranc,
};

export function CurrencyIcon({ currency, className }: { currency: CurrencyCode; className?: string }) {
  const Icon = CURRENCY_ICONS[currency];
  return <Icon className={className} aria-hidden />;
}

type CurrencySelectProps = {
  value: CurrencyCode;
  onChange: (currency: CurrencyCode) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** Seçeneklerde birim adı da yazsın (tek başına kullanılan seçim kutusu için) */
  withLabel?: boolean;
};

export function CurrencySelect({ value, onChange, disabled, className, id, withLabel }: CurrencySelectProps) {
  return (
    <Select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as CurrencyCode)}
      disabled={disabled}
      className={className}
      aria-label="Para birimi"
    >
      {CURRENCY_CODES.map((code) => (
        <option key={code} value={code}>
          {withLabel ? `${code} · ${CURRENCIES[code].label}` : code}
        </option>
      ))}
    </Select>
  );
}

type MoneyInputProps = {
  /** Kuruşa yuvarlanmış tutar; boş alan null */
  value: number | null;
  onValueChange: (value: number | null) => void;
  currency: CurrencyCode;
  /** Verilmezse birim gösterilir ama değiştirilemez (ör. bağlı kayıttan gelir) */
  onCurrencyChange?: (currency: CurrencyCode) => void;
  size?: "sm" | "md";
  id?: string;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  "aria-invalid"?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
};

/**
 * Tutar alanı: kuruşla yazılır (1.250,75 ya da 1,250.75; ikisi de okunur),
 * odaktan çıkınca seçili birimin yazımıyla biçimlenir. Soldaki simge ve
 * sağdaki birim seçimi para birimine göre değişir.
 */
export function MoneyInput({
  value,
  onValueChange,
  currency,
  onCurrencyChange,
  size = "md",
  id,
  disabled,
  placeholder,
  autoFocus,
  className,
  onKeyDown,
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
}: MoneyInputProps) {
  // Yazarken kullanıcının metni korunur; odak dışında değer biçimli gösterilir
  const [draft, setDraft] = useState<string | null>(null);
  const formatted = value === null ? "" : formatMoneyInput(value, currency);
  const small = size === "sm";

  return (
    <div
      className={cn(
        "flex w-full items-center rounded-lg border bg-zinc-900/80 text-zinc-100 focus-within:ring-1",
        small ? "h-7 text-xs" : "h-10 text-sm",
        ariaInvalid
          ? "border-red-500/60 focus-within:border-red-400/70 focus-within:ring-red-500/30"
          : "border-zinc-700/80 focus-within:border-cyan-500/50 focus-within:ring-cyan-500/30",
        disabled && "opacity-60",
        className
      )}
    >
      <CurrencyIcon
        currency={currency}
        className={cn("shrink-0 text-zinc-500", small ? "ml-2 h-3.5 w-3.5" : "ml-3 h-4 w-4")}
      />
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={draft ?? formatted}
        placeholder={placeholder ?? formatMoneyInput(0, currency)}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-invalid={ariaInvalid}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        onFocus={() => setDraft(formatted)}
        onBlur={() => setDraft(null)}
        onChange={(e) => {
          setDraft(e.target.value);
          onValueChange(parseMoney(e.target.value));
        }}
        onKeyDown={onKeyDown}
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent tabular-nums placeholder:text-zinc-600 focus:outline-none disabled:cursor-not-allowed",
          small ? "px-1.5" : "px-2"
        )}
      />
      {onCurrencyChange ? (
        <CurrencySelect
          value={currency}
          onChange={onCurrencyChange}
          disabled={disabled}
          className={cn(
            "h-full shrink-0 rounded-l-none border-0 border-l border-zinc-700/80 bg-transparent ring-0 focus-visible:ring-0",
            small ? "w-[64px] gap-1 px-1.5 text-xs" : "w-[78px] px-2.5"
          )}
        />
      ) : (
        <span
          className={cn("shrink-0 border-l border-zinc-800 text-zinc-500", small ? "px-1.5" : "px-3")}
          title="Para birimi"
        >
          {currency}
        </span>
      )}
    </div>
  );
}

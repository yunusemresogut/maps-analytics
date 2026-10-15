"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  addDays,
  addMonths,
  addYears,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  isValid,
  parseISO,
  setMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useI18n } from "@/contexts/i18n-context";
import { cn } from "@/lib/utils";

const ISO = "yyyy-MM-dd";
const POPOVER_WIDTH = 296;
const GAP = 6;

type DatePickerProps = {
  /** yyyy-MM-dd ya da boş string */
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const date = parseISO(value);
  return isValid(date) ? date : null;
}

/**
 * Temaya uyumlu tarih seçici. Değeri yerel input[type=date] ile aynı
 * biçimde (yyyy-MM-dd) alır ve döndürür.
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "Tarih seçin",
  disabled,
  readOnly,
  required,
  id,
  className,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: DatePickerProps) {
  const { dateLocale } = useI18n();
  const weekStartsOn = dateLocale.options?.weekStartsOn ?? 1;
  const selected = parseDate(value);
  const minDate = parseDate(min);
  const maxDate = parseDate(max);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"days" | "months">("days");
  const [focused, setFocused] = useState<Date>(() => selected ?? new Date());
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const isDisabledDate = useCallback(
    (date: Date) =>
      (minDate !== null && date < startOfDay(minDate)) ||
      (maxDate !== null && date > startOfDay(maxDate)),
    [minDate, maxDate]
  );

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    setPosition(null);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const openPicker = () => {
    if (disabled || readOnly) return;
    setFocused(selected ?? clampDate(new Date(), minDate, maxDate));
    setView("days");
    setOpen(true);
  };

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const popover = popoverRef.current;
    if (!trigger || !popover) return;
    const rect = trigger.getBoundingClientRect();
    const height = popover.offsetHeight;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow < height + GAP && rect.top > height + GAP
        ? rect.top - height - GAP
        : rect.bottom + GAP;
    const left = Math.min(
      Math.max(8, rect.left),
      window.innerWidth - POPOVER_WIDTH - 8
    );
    setPosition({ top, left });
  }, []);

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, view, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        close(false);
      }
    };
    document.addEventListener("pointerdown", handlePointer);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, close, updatePosition]);

  // Klavye ile gezinirken odaklanan günü görünür ve odaklı tut
  useEffect(() => {
    if (!open || view !== "days" || !position) return;
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-date="${format(focused, ISO)}"]`)
      ?.focus();
  }, [open, view, focused, position]);

  const selectDate = (date: Date) => {
    if (isDisabledDate(date)) return;
    onChange(format(date, ISO));
    close();
  };

  const handleGridKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      PageUp: () => addMonths(focused, event.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focused, event.shiftKey ? 12 : 1),
      Home: () => startOfWeek(focused, { weekStartsOn }),
      End: () => endOfWeek(focused, { weekStartsOn }),
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      setFocused(move());
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectDate(focused);
    }
  };

  const monthStart = startOfMonth(focused);
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn }),
    end: endOfWeek(endOfMonth(focused), { weekStartsOn }),
  });
  const weekdayLabels = days
    .slice(0, 7)
    .map((day) => format(day, "EEEEEE", { locale: dateLocale }));
  const today = new Date();
  const canClear = Boolean(value) && !required && !disabled && !readOnly;

  return (
    <div className={cn("relative w-full min-w-0", className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : openPicker())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            openPicker();
          }
        }}
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-lg border bg-zinc-900/80 px-3 text-left text-sm transition-colors focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50",
          canClear && "pr-9",
          ariaInvalid && ariaInvalid !== "false"
            ? "border-red-500/60 focus:border-red-400/70 focus:ring-red-500/30"
            : open
              ? "border-cyan-500/50 ring-1 ring-cyan-500/30"
              : "border-zinc-700/80 hover:border-zinc-600 focus:border-cyan-500/50 focus:ring-cyan-500/30",
          readOnly && "cursor-default hover:border-zinc-700/80"
        )}
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-zinc-500" />
        <span className={cn("truncate", selected ? "text-zinc-100" : "text-zinc-500")}>
          {selected ? format(selected, "d MMMM yyyy", { locale: dateLocale }) : placeholder}
        </span>
      </button>
      {canClear && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-800/60 hover:text-zinc-300"
          aria-label="Tarihi temizle"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Tarih seç"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                close();
              }
            }}
            style={{
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
              width: POPOVER_WIDTH,
            }}
            className="fixed z-[120] rounded-xl border border-zinc-800 bg-zinc-950 p-3 shadow-(--panel-shadow)"
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  setFocused((date) => (view === "days" ? addMonths(date, -1) : addYears(date, -1)))
                }
                className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-zinc-200"
                aria-label={view === "days" ? "Önceki ay" : "Önceki yıl"}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setView((current) => (current === "days" ? "months" : "days"))}
                className="rounded-md px-2 py-1 text-sm font-medium capitalize text-zinc-100 transition-colors hover:bg-zinc-800/60"
                aria-label="Ay ve yıl seç"
              >
                {view === "days"
                  ? format(focused, "LLLL yyyy", { locale: dateLocale })
                  : format(focused, "yyyy")}
              </button>
              <button
                type="button"
                onClick={() =>
                  setFocused((date) => (view === "days" ? addMonths(date, 1) : addYears(date, 1)))
                }
                className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-zinc-200"
                aria-label={view === "days" ? "Sonraki ay" : "Sonraki yıl"}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {view === "days" ? (
              <>
                <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium uppercase text-zinc-500">
                  {weekdayLabels.map((label) => (
                    <span key={label} className="py-1">
                      {label}
                    </span>
                  ))}
                </div>
                <div
                  ref={gridRef}
                  role="grid"
                  onKeyDown={handleGridKey}
                  className="grid grid-cols-7 gap-0.5"
                >
                  {days.map((day) => {
                    const isSelected = selected !== null && isSameDay(day, selected);
                    const isFocused = isSameDay(day, focused);
                    const outside = !isSameMonth(day, focused);
                    const dayDisabled = isDisabledDate(day);
                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        role="gridcell"
                        data-date={format(day, ISO)}
                        tabIndex={isFocused ? 0 : -1}
                        disabled={dayDisabled}
                        aria-selected={isSelected}
                        aria-label={format(day, "d MMMM yyyy, EEEE", { locale: dateLocale })}
                        onClick={() => selectDate(day)}
                        className={cn(
                          "flex h-9 items-center justify-center rounded-lg text-sm tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50",
                          isSelected
                            ? "bg-cyan-500 font-semibold text-white"
                            : isToday(day)
                              ? "font-semibold text-cyan-400 ring-1 ring-inset ring-cyan-500/40 hover:bg-cyan-500/10"
                              : outside
                                ? "text-zinc-600 hover:bg-zinc-800/50"
                                : "text-zinc-200 hover:bg-zinc-800/60",
                          dayDisabled && "cursor-not-allowed opacity-30 hover:bg-transparent"
                        )}
                      >
                        {format(day, "d")}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {Array.from({ length: 12 }, (_, month) => {
                  const date = setMonth(focused, month);
                  const isCurrent = month === focused.getMonth();
                  return (
                    <button
                      key={month}
                      type="button"
                      onClick={() => {
                        setFocused(date);
                        setView("days");
                      }}
                      className={cn(
                        "rounded-lg py-2.5 text-sm capitalize transition-colors",
                        isCurrent
                          ? "bg-cyan-500/15 font-medium text-cyan-300"
                          : "text-zinc-300 hover:bg-zinc-800/60"
                      )}
                    >
                      {format(date, "LLL", { locale: dateLocale })}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-2.5">
              <button
                type="button"
                onClick={() => selectDate(today)}
                disabled={isDisabledDate(today)}
                className="rounded-md px-2 py-1 text-xs font-medium text-cyan-400 transition-colors hover:bg-cyan-500/10 disabled:opacity-40"
              >
                Bugün
              </button>
              {!required && (
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    close();
                  }}
                  className="rounded-md px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-800/60 hover:text-zinc-300"
                >
                  Temizle
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function clampDate(date: Date, min: Date | null, max: Date | null): Date {
  if (min && date < min) return min;
  if (max && date > max) return max;
  return date;
}

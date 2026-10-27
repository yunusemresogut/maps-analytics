"use client";

import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { useT } from "@/contexts/i18n-context";
import { cn } from "@/lib/utils";

/**
 * Temaya uygun açılır liste. Tarayıcının <select>'i ile aynı API'yi kullanır:
 *   <Select value={v} onChange={(e) => setV(e.target.value)}>
 *     <option value="a">A</option>
 *   </Select>
 * Böylece mevcut kullanımlar değişmeden çalışır. e.target.value her zaman string'dir.
 *
 * Erişilebilirlik: tetikleyici role="combobox", liste role="listbox"; odak
 * tetikleyicide kalır, etkin seçenek aria-activedescendant ile bildirilir.
 * Klavye: ↑/↓, Home/End, Enter/Boşluk, Esc, Tab ve harfle arama.
 */

type SelectOption = {
  value: string;
  label: ReactNode;
  /** Harfle arama için düz metin */
  text: string;
  disabled: boolean;
};

type SelectProps = {
  value?: string | number;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  children?: ReactNode;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  /** Değer seçeneklerle eşleşmezse gösterilir */
  placeholder?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
};

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

/** <option> çocuklarını (fragment ve dizilerle birlikte) düz listeye çevirir */
function collectOptions(children: ReactNode, out: SelectOption[] = []): SelectOption[] {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const element = child as ReactElement<{
      value?: string | number;
      children?: ReactNode;
      disabled?: boolean;
    }>;
    if (element.type === Fragment) {
      collectOptions(element.props.children, out);
      return;
    }
    if (element.type === "option") {
      const text = textOf(element.props.children);
      out.push({
        value: element.props.value !== undefined ? String(element.props.value) : text,
        label: element.props.children,
        text,
        disabled: !!element.props.disabled,
      });
    }
  });
  return out;
}

const MENU_GAP = 6;
const MENU_MAX_HEIGHT = 288;
const VIEWPORT_MARGIN = 8;

type MenuPosition = { left: number; width: number; maxHeight: number } & (
  | { top: number; bottom?: undefined }
  | { bottom: number; top?: undefined }
);

function computePosition(trigger: HTMLElement): MenuPosition {
  const rect = trigger.getBoundingClientRect();
  const width = Math.max(rect.width, 160);
  const left = Math.min(Math.max(VIEWPORT_MARGIN, rect.left), window.innerWidth - width - VIEWPORT_MARGIN);
  const below = window.innerHeight - rect.bottom - MENU_GAP - VIEWPORT_MARGIN;
  const above = rect.top - MENU_GAP - VIEWPORT_MARGIN;
  // Altta yer yoksa ve üstte daha fazla varsa yukarı açılır
  if (below < Math.min(MENU_MAX_HEIGHT, 180) && above > below) {
    return { left, width, bottom: window.innerHeight - rect.top + MENU_GAP, maxHeight: Math.min(MENU_MAX_HEIGHT, above) };
  }
  return { left, width, top: rect.bottom + MENU_GAP, maxHeight: Math.min(MENU_MAX_HEIGHT, below) };
}

export function Select({
  value,
  onChange,
  children,
  disabled = false,
  className,
  id,
  name,
  placeholder: placeholderProp,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
}: SelectProps) {
  const t = useT();
  const placeholder = placeholderProp ?? t("shell.select.placeholder");
  const options = useMemo(() => collectOptions(children), [children]);
  const current = value === undefined || value === null ? "" : String(value);
  const selectedIndex = options.findIndex((option) => option.value === current);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ buffer: "", timer: 0 });
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optionId = (index: number) => `${baseId}-opt-${index}`;
  const invalid = ariaInvalid === true || ariaInvalid === "true";

  const enabledIndexes = useMemo(
    () => options.flatMap((option, index) => (option.disabled ? [] : [index])),
    [options]
  );

  const commit = useCallback(
    (index: number) => {
      const option = options[index];
      if (!option || option.disabled) return;
      if (option.value !== current) {
        // Tarayıcı select'inin değişim olayıyla aynı biçim: e.target.value
        const target = { value: option.value, name: name ?? "" } as HTMLSelectElement;
        onChange?.({ target, currentTarget: target } as ChangeEvent<HTMLSelectElement>);
      }
    },
    [options, current, name, onChange]
  );

  const openMenu = useCallback(
    (startIndex?: number) => {
      if (disabled || !triggerRef.current) return;
      setPosition(computePosition(triggerRef.current));
      setActiveIndex(startIndex ?? (selectedIndex >= 0 ? selectedIndex : enabledIndexes[0] ?? -1));
      setOpen(true);
    },
    [disabled, selectedIndex, enabledIndexes]
  );

  const closeMenu = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  // Açıkken: dışarı tıklama kapatır; kaydırma/yeniden boyutlandırmada konum güncellenir
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const targetNode = event.target as Node;
      if (triggerRef.current?.contains(targetNode) || listRef.current?.contains(targetNode)) return;
      setOpen(false);
    };
    const reposition = (event?: Event) => {
      // Listenin kendi kaydırması konumu değiştirmez
      if (event && listRef.current?.contains(event.target as Node)) return;
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      // Tetikleyici kaydırılıp ekrandan çıktıysa liste havada kalmasın
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        setOpen(false);
        return;
      }
      setPosition(computePosition(trigger));
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  // Etkin seçenek görünür alanda kalsın
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  useEffect(() => () => window.clearTimeout(typeahead.current.timer), []);

  const move = (delta: number) => {
    if (enabledIndexes.length === 0) return;
    const at = enabledIndexes.indexOf(activeIndex);
    const next =
      at === -1
        ? delta > 0
          ? enabledIndexes[0]
          : enabledIndexes[enabledIndexes.length - 1]
        : enabledIndexes[Math.min(enabledIndexes.length - 1, Math.max(0, at + delta))];
    setActiveIndex(next);
  };

  /** Harfle arama: yazılan metinle başlayan ilk seçeneğe gider (Türkçe büyük/küçük harf) */
  const findByTypeahead = (key: string): number => {
    const state = typeahead.current;
    window.clearTimeout(state.timer);
    state.buffer += key.toLocaleLowerCase("tr-TR");
    state.timer = window.setTimeout(() => {
      state.buffer = "";
    }, 600);
    const from = open ? activeIndex : selectedIndex;
    const ordered = [...enabledIndexes.filter((i) => i > from), ...enabledIndexes.filter((i) => i <= from)];
    const matches = (i: number) => options[i].text.toLocaleLowerCase("tr-TR").startsWith(state.buffer);
    // Aynı harfe tekrar basmak sıradaki eşleşmeye geçer
    return ordered.find(matches) ?? enabledIndexes.find(matches) ?? -1;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const { key } = event;

    if (!open) {
      if (key === "ArrowDown" || key === "ArrowUp" || key === "Enter" || key === " ") {
        event.preventDefault();
        openMenu();
        return;
      }
      if (key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        // Kapalıyken harfle arama doğrudan seçer (tarayıcı select'i gibi)
        const index = findByTypeahead(key);
        if (index >= 0) commit(index);
      }
      return;
    }

    switch (key) {
      case "ArrowDown":
        event.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(enabledIndexes[0] ?? -1);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(enabledIndexes[enabledIndexes.length - 1] ?? -1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (key === " " && typeahead.current.buffer) {
          setActiveIndex(findByTypeahead(" "));
          break;
        }
        commit(activeIndex);
        closeMenu();
        break;
      case "Escape":
        // Modal içindeyse yalnızca liste kapansın
        event.preventDefault();
        event.stopPropagation();
        closeMenu();
        break;
      case "Tab":
        closeMenu(false);
        break;
      default:
        if (key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
          const index = findByTypeahead(key);
          if (index >= 0) setActiveIndex(index);
        }
    }
  };

  const menu =
    open && position && typeof document !== "undefined"
      ? createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            tabIndex={-1}
            style={{
              position: "fixed",
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
              ...(position.top !== undefined ? { top: position.top } : { bottom: position.bottom }),
            }}
            className="select-menu scrollbar-themed z-[200] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-1 shadow-(--panel-shadow)"
            // Tıklama tetikleyiciden odağı almasın
            onMouseDown={(event) => event.preventDefault()}
          >
            {options.length === 0 && <li className="px-2.5 py-2 text-sm text-zinc-500">{t("shell.select.noOptions")}</li>}
            {options.map((option, index) => {
              const isSelected = index === selectedIndex;
              const isActive = index === activeIndex;
              return (
                <li
                  key={`${option.value}-${index}`}
                  id={optionId(index)}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled || undefined}
                  onPointerEnter={() => !option.disabled && setActiveIndex(index)}
                  onClick={() => {
                    if (option.disabled) return;
                    commit(index);
                    closeMenu();
                  }}
                  className={cn(
                    "flex cursor-pointer select-none items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
                    isActive && !option.disabled ? "bg-zinc-800/70 text-zinc-100" : "text-zinc-300",
                    isSelected && "font-medium text-cyan-300",
                    option.disabled && "cursor-not-allowed opacity-40"
                  )}
                >
                  <span className="min-w-0 truncate">{option.label}</span>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-cyan-400" aria-hidden />}
                </li>
              );
            })}
          </ul>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-invalid={invalid || undefined}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={onKeyDown}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-zinc-900/80 px-3 text-left text-sm text-zinc-100 transition-colors",
          "focus:outline-none focus-visible:ring-1",
          invalid
            ? "border-red-500/60 focus-visible:border-red-400/70 focus-visible:ring-red-500/30"
            : open
              ? "border-cyan-500/50 ring-1 ring-cyan-500/30"
              : "border-zinc-700/80 hover:border-zinc-600 focus-visible:border-cyan-500/50 focus-visible:ring-cyan-500/30",
          disabled && "cursor-not-allowed opacity-60 hover:border-zinc-700/80",
          className
        )}
      >
        <span className={cn("min-w-0 truncate", !selected && "text-zinc-500")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-150", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {name && <input type="hidden" name={name} value={current} />}
      {menu}
    </>
  );
}

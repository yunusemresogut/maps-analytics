"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useT } from "@/contexts/i18n-context";
import { searchAddresses, type GeocodeResult } from "@/lib/geocode";

/** Adres/yer arama kutusu; seçilen sonuç konum, il ve adresi birlikte verir */
export function AddressSearch({
  onSelect,
  placeholder,
}: {
  onSelect: (result: GeocodeResult) => void;
  placeholder?: string;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const term = query.trim();
  const canSearch = open && term.length >= 3;

  useEffect(() => {
    if (!canSearch) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        setResults(await searchAddresses(term, controller.signal));
        setError("");
      } catch {
        if (controller.signal.aborted) return;
        setResults([]);
        setError(t("geocode.searchFailed"));
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [canSearch, term, t]);

  const visible = canSearch ? results : [];

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setError("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter") e.preventDefault();
        }}
        placeholder={placeholder ?? t("geocode.searchPlaceholder")}
        aria-label="Adres ara"
        className="pl-9"
      />
      {canSearch && (
        <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-950 shadow-(--panel-shadow)">
          {searching && <li className="px-3 py-2 text-xs text-zinc-500">{t("geocode.searching")}</li>}
          {!searching && error && (
            <li className="px-3 py-2 text-xs text-red-400" role="alert">
              {error}
            </li>
          )}
          {!searching && !error && visible.length === 0 && (
            <li className="px-3 py-2 text-xs text-zinc-500">{t("geocode.noResults")}</li>
          )}
          {!searching &&
            visible.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(item);
                    setQuery("");
                    setResults([]);
                    setOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-zinc-900"
                >
                  <span className="block text-xs text-zinc-200">{item.address}</span>
                  <span className="block truncate text-[11px] text-zinc-500">{item.label}</span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

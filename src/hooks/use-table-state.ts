"use client";

import { useCallback, useMemo, useState } from "react";
import { useSettings } from "@/contexts/settings-context";
import { usePersistentState } from "@/hooks/use-persistent-state";

export type SortDirection = "asc" | "desc";

export type SortState<K extends string = string> = {
  key: K;
  direction: SortDirection;
};

type SortValue = string | number | boolean | null | undefined | Date;

function compareValues(a: SortValue, b: SortValue, direction: SortDirection) {
  const mul = direction === "asc" ? 1 : -1;

  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  if (typeof a === "number" && typeof b === "number") {
    return (a - b) * mul;
  }

  if (typeof a === "boolean" && typeof b === "boolean") {
    return (Number(a) - Number(b)) * mul;
  }

  const aStr = a instanceof Date ? a.toISOString() : String(a);
  const bStr = b instanceof Date ? b.toISOString() : String(b);
  return (
    aStr.localeCompare(bStr, "tr", { numeric: true, sensitivity: "base" }) * mul
  );
}

/**
 * Başlık tıklamasında sıradaki sıralama durumu; null = varsayılan (initialSort).
 * Döngü: varsayılan → artan → azalan → varsayılan
 */
export function nextSortState<K extends string>(
  prev: SortState<K> | null,
  key: K,
  initialSort: SortState<K>
): SortState<K> | null {
  let next: SortState<K> | null;
  if (prev?.key === key) {
    next = prev.direction === "asc" ? { key, direction: "desc" } : null;
  } else if (key === initialSort.key) {
    // Varsayılan kolonda ilk tık görünür bir değişiklik yapsın
    next = {
      key,
      direction: initialSort.direction === "asc" ? "desc" : "asc",
    };
  } else {
    next = { key, direction: "asc" };
  }
  // Varsayılanla aynı duruma gelindiyse varsayılana dön
  if (
    next &&
    next.key === initialSort.key &&
    next.direction === initialSort.direction
  ) {
    return null;
  }
  return next;
}

export function useTableState<T, K extends string>(options: {
  items: T[];
  initialSort: SortState<K>;
  getSortValue: (item: T, key: K) => SortValue;
  initialPageSize?: number;
  /** When this string changes, page resets to 1 (e.g. filter signature) */
  resetKey?: string;
  /** Verilirse sıralama ve sayfa, tablo hafızası açıkken hatırlanır */
  memoryKey?: string;
}) {
  const { prefs } = useSettings();
  // null = varsayılan sıralama (initialSort)
  const [userSort, setUserSort] = usePersistentState<SortState<K> | null>(options.memoryKey, "sort", null);
  const initialSort = options.initialSort;
  const sort = userSort ?? initialSort;
  const [page, setPage] = usePersistentState(options.memoryKey, "page", 1);
  const [pageSize, setPageSizeState] = usePersistentState(
    options.memoryKey,
    "pageSize",
    options.initialPageSize ?? prefs.pageSize
  );
  const [prevResetKey, setPrevResetKey] = useState(options.resetKey ?? "");

  if ((options.resetKey ?? "") !== prevResetKey) {
    setPrevResetKey(options.resetKey ?? "");
    if (page !== 1) setPage(1);
  }

  const getSortValue = options.getSortValue;

  const sorted = useMemo(() => {
    const next = [...options.items];
    next.sort((a, b) =>
      compareValues(
        getSortValue(a, sort.key),
        getSortValue(b, sort.key),
        sort.direction
      )
    );
    return next;
  }, [options.items, getSortValue, sort.key, sort.direction]);

  const totalItems = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1);
  const currentPage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  const { key: initialKey, direction: initialDirection } = initialSort;
  const toggleSort = useCallback(
    (key: K) => {
      setUserSort((prev) =>
        nextSortState(prev, key, { key: initialKey, direction: initialDirection })
      );
      setPage(1);
    },
    [initialKey, initialDirection, setUserSort, setPage]
  );

  /** Açılır menü gibi tek seçimli kontroller için: kolonu varsayılan yönüyle seçer */
  const setSortKey = useCallback(
    (key: K) => {
      setUserSort(key === initialSort.key ? null : { key, direction: "asc" });
      setPage(1);
    },
    [initialSort.key, setUserSort, setPage]
  );

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1);
  }, [setPageSizeState, setPage]);

  const rangeStart = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, totalItems);

  return {
    sort,
    toggleSort,
    setSortKey,
    page: currentPage,
    setPage,
    pageSize,
    setPageSize,
    pageItems,
    totalItems,
    totalPages,
    rangeStart,
    rangeEnd,
  };
}

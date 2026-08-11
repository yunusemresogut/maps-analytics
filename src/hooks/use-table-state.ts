"use client";

import { useCallback, useMemo, useState } from "react";

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

export function useTableState<T, K extends string>(options: {
  items: T[];
  initialSort: SortState<K>;
  getSortValue: (item: T, key: K) => SortValue;
  initialPageSize?: number;
  /** When this string changes, page resets to 1 (e.g. filter signature) */
  resetKey?: string;
}) {
  const [sort, setSort] = useState<SortState<K>>(options.initialSort);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(options.initialPageSize ?? 10);
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

  const toggleSort = useCallback((key: K) => {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" }
    );
    setPage(1);
  }, []);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1);
  }, []);

  const rangeStart = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, totalItems);

  return {
    sort,
    toggleSort,
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

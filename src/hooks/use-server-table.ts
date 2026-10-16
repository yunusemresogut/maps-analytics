"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { applyListFilters, type ListFilterValue } from "@/lib/supabase-query";
import {
  nextSortState,
  type SortState,
} from "@/hooks/use-table-state";

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Arama, filtre, sıralama ve sayfalamayı Supabase'de yapan tablo durumu.
 * Yalnızca görünen sayfanın satırları çekilir; dönen değerler
 * useTableState ile aynı şekildedir.
 */
export function useServerTable<Row, K extends string>(options: {
  /** Sorgulanacak tablo veya view */
  source: string;
  mapRow: (row: Record<string, unknown>) => Row;
  /** ilike ile aranacak kolonlar */
  searchColumns: string[];
  search: string;
  /** Eşitlik filtreleri; undefined, null veya "all" uygulanmaz */
  filters?: Record<string, ListFilterValue>;
  /** Sıralama anahtarı → veritabanı kolonu; listede olmayan anahtar sıralanmaz */
  sortColumns: Partial<Record<K, string>>;
  initialSort: SortState<K>;
  initialPageSize?: number;
  /** Değiştiğinde mevcut sayfa yeniden çekilir (örn. kayıt eklendi/silindi) */
  refreshKey?: unknown;
}) {
  const {
    source,
    mapRow,
    searchColumns,
    search,
    filters,
    sortColumns,
    initialSort,
    initialPageSize,
    refreshKey,
  } = options;

  const [userSort, setUserSort] = useState<SortState<K> | null>(null);
  const sort = userSort ?? initialSort;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize ?? 10);
  const [rows, setRows] = useState<Row[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Her tuşta istek atmamak için aramayı geciktir
  const term = search.trim();
  const [debouncedTerm, setDebouncedTerm] = useState(term);
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedTerm(term), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [term]);

  const filterSignature = JSON.stringify(filters ?? {});
  const searchSignature = searchColumns.join(",");
  const sortColumn = sortColumns[sort.key];

  // Arama veya filtre değişince ilk sayfaya dön
  const resetSignature = `${debouncedTerm}|${filterSignature}`;
  const [prevResetSignature, setPrevResetSignature] = useState(resetSignature);
  if (resetSignature !== prevResetSignature) {
    setPrevResetSignature(resetSignature);
    if (page !== 1) setPage(1);
  }

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      const from = (page - 1) * pageSize;
      let query = applyListFilters(
        supabase
          .from(source)
          .select("*", { count: "exact" })
          .range(from, from + pageSize - 1),
        JSON.parse(filterSignature) as Record<string, ListFilterValue>,
        searchSignature ? searchSignature.split(",") : [],
        debouncedTerm
      );

      if (sortColumn) {
        query = query.order(sortColumn, {
          ascending: sort.direction === "asc",
          nullsFirst: false,
        });
      }
      // Eşit değerlerde sayfalar arası kayma olmasın
      query = query.order("id", { ascending: true });

      const { data, count, error: queryError } = await query;
      if (cancelled) return;

      if (queryError) {
        console.error(`${source} listesi yüklenemedi:`, queryError);
        setError(queryError.message);
        setRows([]);
        setTotalItems(0);
      } else {
        const total = count ?? 0;
        const lastPage = Math.max(1, Math.ceil(total / pageSize));
        // Silme sonrası boş kalan son sayfadan bir öncekine geç
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }
        setError(null);
        setRows((data ?? []).map((row) => mapRow(row as Record<string, unknown>)));
        setTotalItems(total);
      }
      setIsLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
    // mapRow kasıtlı olarak bağımlılık dışı: satır dönüşümü sorguyu değiştirmez
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    source,
    page,
    pageSize,
    debouncedTerm,
    filterSignature,
    searchSignature,
    sortColumn,
    sort.direction,
    refreshKey,
  ]);

  const { key: initialKey, direction: initialDirection } = initialSort;
  const toggleSort = useCallback(
    (key: K) => {
      setUserSort((prev) =>
        nextSortState(prev, key, { key: initialKey, direction: initialDirection })
      );
      setPage(1);
    },
    [initialKey, initialDirection]
  );

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1);
  }, []);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rangeStart = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, totalItems);

  return {
    sort,
    toggleSort,
    page: currentPage,
    setPage,
    pageSize,
    setPageSize,
    pageItems: rows,
    totalItems,
    totalPages,
    rangeStart,
    rangeEnd,
    isLoading,
    error,
    /** Sonuçların ait olduğu (gecikmeli) arama metni; toplu işlemler bunu kullanır */
    appliedSearch: debouncedTerm,
  };
}

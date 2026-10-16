"use client";

import { useCallback, useState } from "react";

/**
 * Sunucu tarafında sayfalanan tablolar için satır seçimi.
 * Elle seçilen satırlar id olarak tutulur (sayfalar arası korunur).
 * "Tümünü seç" ise id listesi değil bir kip olarak tutulur: o anki arama/filtreye
 * uyan, görünmeyen sayfalardakiler dahil tüm satırları kapsar; toplu işlem
 * sırasında bu satırlar sunucudan bulunur.
 */
export function useRowSelection(options: {
  /** Açık sayfadaki satırlar */
  pageIds: string[];
  /** Arama/filtreye uyan toplam satır sayısı */
  totalCount: number;
  /** Değiştiğinde seçim sıfırlanır (örn. arama metni): gizlenen satır seçili kalmasın */
  resetKey: string;
}) {
  const { pageIds, totalCount, resetKey } = options;
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [prevResetKey, setPrevResetKey] = useState(resetKey);

  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    if (selected.size > 0) setSelected(new Set());
    if (allMatching) setAllMatching(false);
  }

  const isSelected = (id: string) => allMatching || selected.has(id);
  const pageSelectedCount = pageIds.filter(isSelected).length;
  const isPageSelected = pageIds.length > 0 && pageSelectedCount === pageIds.length;

  const toggle = useCallback(
    (id: string) => {
      if (allMatching) {
        // "Tümü" kipinden çıkıp bu sayfanın geri kalanını seçili bırak
        setAllMatching(false);
        setSelected(new Set(pageIds.filter((pageId) => pageId !== id)));
        return;
      }
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [allMatching, pageIds]
  );

  const togglePage = useCallback(() => {
    if (allMatching) {
      setAllMatching(false);
      setSelected(new Set());
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      const allOnPage = pageIds.length > 0 && pageIds.every((id) => next.has(id));
      for (const id of pageIds) {
        if (allOnPage) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }, [allMatching, pageIds]);

  const selectAll = useCallback(() => setAllMatching(true), []);

  const clear = useCallback(() => {
    setAllMatching(false);
    setSelected(new Set());
  }, []);

  return {
    /** Elle seçilen id'ler; allMatching iken anlamsızdır */
    selected,
    /** Arama/filtreye uyan tüm satırlar seçili */
    allMatching,
    selectedCount: allMatching ? totalCount : selected.size,
    isSelected,
    isPageSelected,
    isPagePartiallySelected: pageSelectedCount > 0 && !isPageSelected,
    isAllSelected: allMatching || (totalCount > 0 && selected.size === totalCount),
    toggle,
    togglePage,
    selectAll,
    clear,
  };
}

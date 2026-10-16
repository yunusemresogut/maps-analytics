import type { PostgrestError } from "@supabase/supabase-js";

/** PostgREST tek yanıtta varsayılan olarak en fazla 1000 satır döndürür */
const CHUNK_SIZE = 1000;

type ChunkResult<T> = PromiseLike<{ data: T[] | null; error: PostgrestError | null }>;

/**
 * Bir sorgunun tüm satırlarını parça parça çeker; satır sınırına takılmaz.
 * `build` her parça için verilen aralıkla sorguyu kurar ve kararlı bir sıralama
 * (örn. sonda `.order("id")`) içermelidir, yoksa parçalar arasında kayma olur.
 * Sunucunun satır sınırı 1000'den düşük ayarlanmış olsa da çalışır: boş parça
 * gelene kadar devam eder.
 */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => ChunkResult<T>
): Promise<{ data: T[]; error: PostgrestError | null }> {
  const rows: T[] = [];
  for (let from = 0; ; ) {
    const { data, error } = await build(from, from + CHUNK_SIZE - 1);
    if (error) return { data: rows, error };
    const batch = data ?? [];
    if (batch.length === 0) break;
    rows.push(...batch);
    from += batch.length;
  }
  return { data: rows, error: null };
}

/**
 * PostgREST `or` filtresi için güvenli ilike değeri.
 * LIKE jokerleri (% _ \) kaçışlanır, sonra değer çift tırnağa alınır ki
 * virgül/parantez gibi ayraçlar filtre sözdizimini bozmasın.
 */
function ilikeValue(term: string): string {
  const like = term.replace(/\*/g, "").replace(/[\\%_]/g, "\\$&");
  const quoted = `%${like}%`.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${quoted}"`;
}

/** Verilen kolonlardan herhangi birinde geçen metin için `or` filtresi */
export function searchFilter(columns: string[], term: string): string | null {
  const trimmed = term.trim();
  if (!trimmed || columns.length === 0) return null;
  const value = ilikeValue(trimmed);
  return columns.map((column) => `${column}.ilike.${value}`).join(",");
}

/** Uzun id listelerini URL sınırına takılmayacak parçalara böler */
export function chunk<T>(items: T[], size = 200): T[][] {
  const parts: T[][] = [];
  for (let i = 0; i < items.length; i += size) parts.push(items.slice(i, i + size));
  return parts;
}

export type ListFilterValue = string | number | boolean | null | undefined;

/** Uygulanacak eşitlik filtreleri: undefined, null ve "all" atlanır */
export function activeFilters(
  filters: Record<string, ListFilterValue>
): [string, NonNullable<ListFilterValue>][] {
  return Object.entries(filters).flatMap(([column, value]) =>
    value === undefined || value === null || value === "all" ? [] : [[column, value]]
  );
}

type FilterableQuery<Q> = {
  eq(column: string, value: NonNullable<ListFilterValue>): Q;
  or(filters: string): Q;
};

/**
 * Liste filtrelerini sorguya uygular: eşitlik filtreleri (undefined, null ve
 * "all" atlanır) ve kolonlarda metin araması. Liste ile toplu işlemler aynı
 * kümeyi hedeflesin diye ikisi de bunu kullanır.
 */
export function applyListFilters<Q extends FilterableQuery<Q>>(
  query: Q,
  filters: Record<string, ListFilterValue>,
  searchColumns: string[],
  term: string
): Q {
  let next = query;
  for (const [column, value] of activeFilters(filters)) {
    next = next.eq(column, value);
  }
  const search = searchFilter(searchColumns, term);
  if (search) next = next.or(search);
  return next;
}

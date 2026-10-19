/**
 * Tablo hafızası: arama, filtre, sıralama ve sayfa bilgisi sekme oturumu
 * boyunca (sessionStorage) saklanır; sayfalar arası geçişte ve yenilemede korunur,
 * sekme kapanınca sıfırlanır. Ayarlardan kapatılabilir.
 */

const PREFIX = "maps-analytics-table:";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function fullKey(scope: string, key: string, field: string) {
  return `${PREFIX}${scope}:${key}:${field}`;
}

export function readTableMemory<T>(scope: string, key: string, field: string): T | undefined {
  try {
    const raw = storage()?.getItem(fullKey(scope, key, field));
    return raw === null || raw === undefined ? undefined : (JSON.parse(raw) as T);
  } catch {
    return undefined;
  }
}

export function writeTableMemory(scope: string, key: string, field: string, value: unknown) {
  try {
    storage()?.setItem(fullKey(scope, key, field), JSON.stringify(value));
  } catch {
    // Kota dolarsa ya da depolama engelliyse hafıza olmadan devam et
  }
}

export function clearTableMemory() {
  const store = storage();
  if (!store) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    keys.forEach((key) => store.removeItem(key));
  } catch {
    // yok say
  }
}

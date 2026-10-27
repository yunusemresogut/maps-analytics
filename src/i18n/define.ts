/** Türkçe metinle aynı biçimde, değerleri başka dilde olan sözlük */
export type Translation<T> = {
  [K in keyof T]: T[K] extends string ? string : Translation<T[K]>;
};

/**
 * Bir modülün metinleri: Türkçe kaynak ve İngilizce karşılığı yan yana.
 * İngilizce sözlükte eksik ya da fazla anahtar derleme hatası verir.
 */
export function defineMessages<T extends object>(tr: T, en: Translation<T>) {
  return { tr: tr as Translation<T>, en };
}

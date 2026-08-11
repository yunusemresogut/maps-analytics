import type { Dictionary } from "@/i18n/dictionaries/tr";

type NestedKeyOf<T, Prefix extends string = ""> = T extends string
  ? Prefix
  : {
      [K in keyof T & string]: NestedKeyOf<
        T[K],
        Prefix extends "" ? K : `${Prefix}.${K}`
      >;
    }[keyof T & string];

export type TranslationKey = NestedKeyOf<Dictionary>;

export type TranslateParams = Record<string, string | number>;

function resolvePath(dictionary: Dictionary, key: string): string | undefined {
  const parts = key.split(".");
  let current: unknown = dictionary;

  for (const part of parts) {
    if (typeof current !== "object" || current === null || !(part in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === "string" ? current : undefined;
}

export function translate(
  dictionary: Dictionary,
  key: TranslationKey,
  params?: TranslateParams
): string {
  const value = resolvePath(dictionary, key) ?? key;
  if (!params) return value;

  return value.replace(/\{(\w+)\}/g, (_, name: string) =>
    params[name] !== undefined ? String(params[name]) : `{${name}}`
  );
}

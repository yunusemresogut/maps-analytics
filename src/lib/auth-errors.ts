import type { TranslateParams, TranslationKey } from "@/i18n";

type AuthErrorLike = { message?: string; code?: string; status?: number } | null | undefined;

/**
 * Supabase Auth hatalarını kullanıcıya gösterilebilir Türkçe mesaja çevirir.
 * Auth, veritabanı tetikleyicisi hatalarında gövdesi boş ("{}") bir hata
 * döndürebilir; bu durumda asıl ayrıntı sunucu loguna yazılır.
 * Yalnızca API route'larında kullanılır; `t` isteğin çeviricisidir
 * (serverTranslator).
 */
export function authErrorMessage(
  error: AuthErrorLike,
  fallback: string,
  t: (key: TranslationKey, params?: TranslateParams) => string
): string {
  const message = error?.message?.trim() ?? "";
  if (error?.code === "email_exists" || /already (been )?registered/i.test(message)) {
    return t("shell.authErrors.emailExists");
  }
  if (error?.code === "weak_password" || /password/i.test(message)) {
    return t("shell.authErrors.weakPassword");
  }
  if (/invalid.*email|email.*invalid/i.test(message)) {
    return t("shell.authErrors.emailInvalid");
  }
  if (!message || message === "{}" || /database error/i.test(message)) {
    return fallback;
  }
  return message;
}

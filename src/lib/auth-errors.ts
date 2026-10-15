type AuthErrorLike = { message?: string; code?: string; status?: number } | null | undefined;

/**
 * Supabase Auth hatalarını kullanıcıya gösterilebilir Türkçe mesaja çevirir.
 * Auth, veritabanı tetikleyicisi hatalarında gövdesi boş ("{}") bir hata
 * döndürebilir; bu durumda asıl ayrıntı sunucu loguna yazılır.
 */
export function authErrorMessage(error: AuthErrorLike, fallback: string): string {
  const message = error?.message?.trim() ?? "";
  if (error?.code === "email_exists" || /already (been )?registered/i.test(message)) {
    return "Bu e-posta adresi zaten kayıtlı.";
  }
  if (error?.code === "weak_password" || /password/i.test(message)) {
    return "Şifre yeterince güçlü değil. En az 6 karakter kullanın.";
  }
  if (/invalid.*email|email.*invalid/i.test(message)) {
    return "Geçerli bir e-posta adresi girin.";
  }
  if (!message || message === "{}" || /database error/i.test(message)) {
    return fallback;
  }
  return message;
}

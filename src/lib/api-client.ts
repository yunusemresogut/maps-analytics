import { getLocale } from "@/i18n/runtime";
import { supabase } from "@/lib/supabase";

/**
 * Uygulamanın kendi API route'larına istek: oturumdaki access token
 * Authorization başlığıyla gönderilir. Sunucu tarafı getRequestCaller ile doğrular.
 */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  // Sunucu hata mesajlarını seçili dilde döner (localeFromRequest)
  headers.set("x-locale", getLocale());
  if (init.body !== undefined && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(input, { ...init, headers });
}

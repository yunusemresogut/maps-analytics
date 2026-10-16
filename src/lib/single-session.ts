/** Aynı hesaba başka yerden girilince eski oturumu düşürmek için yardımcılar */

/** Veritabanı eski oturumdan gelen isteği reddettiğinde tetiklenen pencere olayı */
export const SESSION_REVOKED_EVENT = "maps-analytics:session-revoked";

/** Yeni girişin diğer oturumlara duyurulduğu realtime kanal ve olay adları */
export const sessionChannelName = (userId: string) => `user-session-${userId}`;
export const SESSION_REPLACED_BROADCAST = "session-replaced";

const REPLACED_FLAG_KEY = "maps-analytics-session-replaced";

/** Access token içindeki Supabase oturum kimliğini döndürür */
export function getSessionIdFromToken(accessToken: string | undefined): string | null {
  if (!accessToken) return null;
  try {
    const payload = accessToken.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const sessionId = (JSON.parse(json) as { session_id?: unknown }).session_id;
    return typeof sessionId === "string" ? sessionId : null;
  } catch {
    return null;
  }
}

/** Login ekranında "başka yerden giriş yapıldı" mesajı göstermek için işaret bırakır */
export function markSessionReplaced() {
  try {
    sessionStorage.setItem(REPLACED_FLAG_KEY, "1");
  } catch {
    // Depolama kapalıysa mesaj gösterilmez, yönlendirme yine çalışır
  }
}

/** Oturumun başka yerden girişle düşürülüp düşürülmediğini okur */
export function wasSessionReplaced(): boolean {
  try {
    return sessionStorage.getItem(REPLACED_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearSessionReplaced() {
  try {
    sessionStorage.removeItem(REPLACED_FLAG_KEY);
  } catch {
    // yok say
  }
}

/** PostgREST yanıtı oturumun iptal edildiğini söylüyorsa uygulamayı haberdar eder */
export async function detectRevokedSession(response: Response): Promise<void> {
  if (response.status !== 401 || typeof window === "undefined") return;
  try {
    const body = (await response.clone().json()) as { code?: unknown };
    if (body?.code === "session_revoked") {
      window.dispatchEvent(new Event(SESSION_REVOKED_EVENT));
    }
  } catch {
    // JSON olmayan 401 yanıtları bizi ilgilendirmiyor
  }
}

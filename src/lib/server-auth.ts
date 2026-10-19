import { createClient } from "@supabase/supabase-js";
import { normalizeRole } from "@/lib/roles";
import type { UserRole } from "@/types";

/** API isteğini yapan, doğrulanmış kullanıcı */
export type RequestCaller = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string;
  isAdmin: boolean;
  /** Kullanıcının kendi oturumuyla (RLS uygulanarak) sorgu yapan istemci */
  accessToken: string;
};

type CallerResult = { ok: true; caller: RequestCaller } | { ok: false; response: Response };

function deny(message: string, status: number): CallerResult {
  return { ok: false, response: Response.json({ error: message }, { status }) };
}

/**
 * Authorization: Bearer <access token> başlığını doğrular.
 * - Token Supabase Auth'ta geçerli olmalı (süresi dolmamış, kullanıcı silinmemiş)
 * - Oturum hâlâ aktif olmalı: profil, kullanıcının kendi token'ıyla okunur;
 *   böylece tek oturum kuralı (enforce_active_session) ve RLS burada da işler
 * - Profil bir firmaya bağlı ve kısıtlanmamış olmalı
 * Service role ile çalışan route'lar işlem yapmadan önce bunu çağırmalıdır.
 */
export async function getRequestCaller(request: Request): Promise<CallerResult> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return deny("Oturum bulunamadı.", 401);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) return deny("Oturum geçersiz.", 401);

  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("id, email, name, role, organization_id, restricted")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    // Başka cihazdan giriş yapılınca eski oturumun istekleri reddedilir
    return deny("Oturum sonlandırılmış. Lütfen tekrar giriş yapın.", 401);
  }
  if (!profile?.organization_id) return deny("Kullanıcı profili bulunamadı.", 403);
  if (profile.restricted) return deny("Hesabınız kısıtlanmış.", 403);

  const role = normalizeRole(typeof profile.role === "string" ? profile.role : undefined);
  return {
    ok: true,
    caller: {
      id: profile.id,
      email: String(profile.email ?? ""),
      name: String(profile.name ?? ""),
      role,
      organizationId: profile.organization_id,
      isAdmin: role === "admin",
      accessToken: token,
    },
  };
}

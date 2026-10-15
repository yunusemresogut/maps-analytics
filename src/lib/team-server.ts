import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase";

export const TEAM_FILES_BUCKET = "team-files";
export const TEAM_RETENTION_DAYS = 3;

type MessageRow = { id: string; attachment_path: string | null };

/** İstekteki Supabase oturumunu doğrular, kullanıcı ve firmasını döndürür */
export async function getTeamRequestUser(
  request: Request
): Promise<{ userId: string; organizationId: string } | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;

  const { data: profile } = await getSupabaseAdmin()
    .from("profiles")
    .select("organization_id")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile?.organization_id) return null;
  return { userId: data.user.id, organizationId: profile.organization_id };
}

/** Mesajları ekleriyle birlikte kalıcı olarak siler */
export async function deleteTeamMessages(
  admin: SupabaseClient,
  rows: MessageRow[]
): Promise<number> {
  if (rows.length === 0) return 0;
  const paths = rows
    .map((row) => row.attachment_path)
    .filter((path): path is string => Boolean(path));
  if (paths.length > 0) {
    const { error } = await admin.storage.from(TEAM_FILES_BUCKET).remove(paths);
    if (error) console.error("Ekip dosyaları silinemedi", error);
  }
  const { error } = await admin
    .from("team_messages")
    .delete()
    .in(
      "id",
      rows.map((row) => row.id)
    );
  if (error) throw error;
  return rows.length;
}

/** Saklama süresi dolan mesajları siler; organizationId verilmezse tüm firmalar */
export async function cleanupExpiredTeamMessages(organizationId?: string): Promise<number> {
  const admin = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - TEAM_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  let deleted = 0;
  // Büyük birikimlerde parça parça ilerle
  for (let batch = 0; batch < 20; batch++) {
    let query = admin
      .from("team_messages")
      .select("id, attachment_path")
      .lte("created_at", cutoff)
      .limit(500);
    if (organizationId) query = query.eq("organization_id", organizationId);
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;
    deleted += await deleteTeamMessages(admin, data);
    if (data.length < 500) break;
  }
  return deleted;
}

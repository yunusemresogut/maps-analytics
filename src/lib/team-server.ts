import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase";
import { normalizeOrgSettings } from "@/lib/settings";
import { getRequestCaller } from "@/lib/server-auth";

export const TEAM_FILES_BUCKET = "team-files";

type MessageRow = { id: string; attachment_path: string | null };

/** İstekteki oturumu doğrular (tek oturum ve kısıt kontrolü dahil), kullanıcı ve firmasını döndürür */
export async function getTeamRequestUser(
  request: Request
): Promise<{ userId: string; organizationId: string } | null> {
  const auth = await getRequestCaller(request);
  return auth.ok ? { userId: auth.caller.id, organizationId: auth.caller.organizationId } : null;
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

/** Saklama süresi (firma ayarı, varsayılan 3 gün) dolan mesajları siler; organizationId verilmezse tüm firmalar */
export async function cleanupExpiredTeamMessages(organizationId?: string): Promise<number> {
  const admin = getSupabaseAdmin();
  let orgQuery = admin.from("organizations").select("id, settings");
  if (organizationId) orgQuery = orgQuery.eq("id", organizationId);
  const { data: orgs, error: orgError } = await orgQuery;
  if (orgError) throw orgError;

  let deleted = 0;
  for (const org of orgs ?? []) {
    const retentionDays = normalizeOrgSettings(org.settings).team.retentionDays;
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    // Büyük birikimlerde parça parça ilerle
    for (let batch = 0; batch < 20; batch++) {
      const { data, error } = await admin
        .from("team_messages")
        .select("id, attachment_path")
        .eq("organization_id", org.id)
        .lte("created_at", cutoff)
        .limit(500);
      if (error) throw error;
      if (!data || data.length === 0) break;
      deleted += await deleteTeamMessages(admin, data);
      if (data.length < 500) break;
    }
  }
  return deleted;
}

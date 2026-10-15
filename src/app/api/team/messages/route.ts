import { getSupabaseAdmin } from "@/lib/supabase";
import { deleteTeamMessages, getTeamRequestUser } from "@/lib/team-server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mesaj silme. Gövde:
 * - { messageId } → kullanıcının kendi gönderdiği tek mesaj
 * - { peerId }    → iki kişi arasındaki tüm sohbet (iki taraf için de silinir)
 */
export async function DELETE(request: Request) {
  const user = await getTeamRequestUser(request);
  if (!user) return Response.json({ error: "Oturum geçersiz." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { messageId?: unknown; peerId?: unknown }
    | null;
  const admin = getSupabaseAdmin();
  let query = admin
    .from("team_messages")
    .select("id, attachment_path")
    .eq("organization_id", user.organizationId);

  if (typeof body?.messageId === "string" && UUID_PATTERN.test(body.messageId)) {
    query = query.eq("id", body.messageId).eq("sender_id", user.userId);
  } else if (typeof body?.peerId === "string" && UUID_PATTERN.test(body.peerId)) {
    query = query.or(
      `and(sender_id.eq.${user.userId},recipient_id.eq.${body.peerId}),and(sender_id.eq.${body.peerId},recipient_id.eq.${user.userId})`
    );
  } else {
    return Response.json({ error: "Silinecek mesaj belirtilmedi." }, { status: 400 });
  }

  const { data, error } = await query;
  if (error) {
    console.error("Ekip mesajları okunamadı", error);
    return Response.json({ error: "Mesajlar silinemedi." }, { status: 500 });
  }
  try {
    const deleted = await deleteTeamMessages(admin, data ?? []);
    return Response.json({ deleted });
  } catch (deleteError) {
    console.error("Ekip mesajları silinemedi", deleteError);
    return Response.json({ error: "Mesajlar silinemedi." }, { status: 500 });
  }
}

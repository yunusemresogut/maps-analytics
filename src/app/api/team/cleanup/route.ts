import { cleanupExpiredTeamMessages, getTeamRequestUser } from "@/lib/team-server";
import { localeFromRequest, serverTranslator } from "@/i18n/server";

/** Vercel Cron: tüm firmalarda saklama süresi dolan mesajları ve dosyaları siler */
export async function GET(request: Request) {
  const t = serverTranslator(localeFromRequest(request));
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: t("api.common.unauthorized") }, { status: 401 });
  }
  try {
    const deleted = await cleanupExpiredTeamMessages();
    return Response.json({ deleted });
  } catch (error) {
    console.error("Ekip temizliği başarısız", error);
    return Response.json({ error: t("api.team.cleanupFailed") }, { status: 500 });
  }
}

/** Ekip sayfası açıldığında: yalnızca kullanıcının firmasını temizler */
export async function POST(request: Request) {
  const t = serverTranslator(localeFromRequest(request));
  const user = await getTeamRequestUser(request);
  if (!user) return Response.json({ error: t("api.session.invalid") }, { status: 401 });
  try {
    const deleted = await cleanupExpiredTeamMessages(user.organizationId);
    return Response.json({ deleted });
  } catch (error) {
    console.error("Ekip temizliği başarısız", error);
    return Response.json({ error: t("api.team.cleanupFailed") }, { status: 500 });
  }
}

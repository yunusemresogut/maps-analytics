import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { defaultMatrixForRole, normalizePermissions } from "@/lib/permissions";
import { isCustomRole, normalizeCustomRoles, normalizeRole } from "@/lib/roles";
import { authErrorMessage } from "@/lib/auth-errors";
import { getRequestCaller, type RequestCaller } from "@/lib/server-auth";
import { isValidEmail, isValidPassword, isValidUrl } from "@/lib/validation";

/**
 * Kullanıcı yönetimi (service role ile çalışır, RLS'i atlar). Bu yüzden her
 * istekte çağıran doğrulanır ve yetkisi burada kontrol edilir:
 * - Kullanıcı ekleme, silme, rol/yetki/kısıt değiştirme: yalnızca firmanın admin'i,
 *   yalnızca kendi firmasındaki admin olmayan kullanıcılar için
 * - Ad, telefon, profil fotoğrafı: herkes yalnızca kendi profili için
 * - Admin rolü bu uçtan verilemez (yalnızca firma kaydıyla oluşur)
 */

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Beklenmeyen bir sunucu hatası";
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() : undefined;
}

/** Özel rol yalnızca çağıranın firmasında tanımlıysa atanabilir (veritabanı da denetler) */
async function isRoleAvailable(caller: RequestCaller, role: string): Promise<boolean> {
  if (!isCustomRole(role)) return true;
  const { data } = await getSupabaseAdmin()
    .from("organizations")
    .select("custom_roles")
    .eq("id", caller.organizationId)
    .maybeSingle();
  return normalizeCustomRoles(data?.custom_roles).some((item) => item.key === role);
}

type TargetProfile = { id: string; role: string; organization_id: string | null; email: string | null };

/** Hedef kullanıcı çağıranın firmasında değilse bulunamadı gibi davranılır (varlığı sızdırılmaz) */
async function loadTarget(caller: RequestCaller, id: unknown): Promise<TargetProfile | null> {
  if (typeof id !== "string" || !id) return null;
  const { data } = await getSupabaseAdmin()
    .from("profiles")
    .select("id, role, organization_id, email")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.organization_id !== caller.organizationId) return null;
  return data as TargetProfile;
}

export async function POST(request: Request) {
  const auth = await getRequestCaller(request);
  if (!auth.ok) return auth.response;
  const { caller } = auth;
  if (!caller.isAdmin) return error("Bu işlem için yetkiniz yok.", 403);

  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const email = optionalString(body?.email)?.toLowerCase() ?? "";
    const name = optionalString(body?.name) ?? "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password || !name) return error("E-posta, şifre ve isim zorunludur", 400);
    if (!isValidEmail(email)) return error("Geçerli bir e-posta adresi girin", 400);
    if (!isValidPassword(password)) return error("Şifre en az 6 karakter olmalıdır", 400);

    const role = normalizeRole(typeof body?.role === "string" ? body.role : "manager");
    if (role === "admin") return error("Admin rolü yalnızca kayıt ile oluşturulabilir", 400);
    if (!(await isRoleAvailable(caller, role))) return error("Seçilen rol bu firmada tanımlı değil", 400);
    const permissions =
      body?.permissions !== undefined ? normalizePermissions(role, body.permissions) : defaultMatrixForRole(role);

    const adminClient = getSupabaseAdmin();
    // Firma her zaman çağıranın firmasıdır; istemcinin gönderdiği değere güvenilmez
    const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, organization_id: caller.organizationId },
    });

    if (createError) {
      console.error("Admin: auth kullanıcısı oluşturulamadı", createError);
      const status = createError.status && createError.status < 500 ? 400 : 500;
      return error(authErrorMessage(createError, "Kullanıcı oluşturulamadı. Lütfen tekrar deneyin."), status);
    }

    const userId = userData.user.id;
    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: userId,
      email,
      name,
      role,
      permissions,
      organization_id: caller.organizationId,
      restricted: false,
    });

    if (profileError) {
      await adminClient.auth.admin.deleteUser(userId);
      return error(profileError.message, 500);
    }

    return NextResponse.json({ success: true, user: { id: userId, email, name, role } });
  } catch (err: unknown) {
    return error(errorMessage(err), 500);
  }
}

export async function PUT(request: Request) {
  const auth = await getRequestCaller(request);
  if (!auth.ok) return auth.response;
  const { caller } = auth;

  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body.id !== "string" || !body.id) return error("Kullanıcı ID zorunludur", 400);

    const isSelf = body.id === caller.id;
    const adminFields = ["email", "password", "permissions", "restricted", "role"].filter(
      (key) => body[key] !== undefined && body[key] !== null && body[key] !== ""
    );

    // Admin olmayan kullanıcı yalnızca kendi ad/telefon/fotoğrafını değiştirebilir
    if (!caller.isAdmin && (!isSelf || adminFields.length > 0)) {
      return error("Bu işlem için yetkiniz yok.", 403);
    }

    const target = await loadTarget(caller, body.id);
    if (!target) return error("Kullanıcı bulunamadı.", 404);

    if (adminFields.length > 0) {
      // Admin kendi rolünü/yetkisini değiştirip kendini kilitleyemez; başka admin düzenlenemez
      if (isSelf) return error("Kendi rolünüzü, yetkinizi veya giriş bilgilerinizi buradan değiştiremezsiniz.", 403);
      if (normalizeRole(target.role) === "admin") return error("Admin kullanıcılar düzenlenemez.", 403);
    }

    const name = optionalString(body.name);
    const phone = optionalString(body.phone);
    const email = optionalString(body.email)?.toLowerCase();
    const password = typeof body.password === "string" ? body.password : undefined;
    const role = typeof body.role === "string" && body.role ? normalizeRole(body.role) : undefined;
    const avatarUrl = body.avatarUrl === null ? null : optionalString(body.avatarUrl);

    if (name !== undefined && !name) return error("İsim boş olamaz", 400);
    if (email && !isValidEmail(email)) return error("Geçerli bir e-posta adresi girin", 400);
    if (password && !isValidPassword(password)) return error("Şifre en az 6 karakter olmalıdır", 400);
    if (role === "admin") return error("Admin rolü bu ekrandan verilemez", 400);
    if (role && !(await isRoleAvailable(caller, role))) return error("Seçilen rol bu firmada tanımlı değil", 400);
    if (avatarUrl && !isValidUrl(avatarUrl)) return error("Geçersiz profil fotoğrafı adresi", 400);
    if (body.restricted !== undefined && typeof body.restricted !== "boolean") {
      return error("Geçersiz kısıt değeri", 400);
    }

    const adminClient = getSupabaseAdmin();
    const authUpdates: Record<string, unknown> = {};
    if (email) authUpdates.email = email;
    if (password) authUpdates.password = password;
    if (name) authUpdates.user_metadata = { name };

    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } = await adminClient.auth.admin.updateUserById(target.id, authUpdates);
      if (authError) return error(authError.message, 400);
    }

    const effectiveRole = role ?? normalizeRole(target.role);
    const profileUpdates: Record<string, unknown> = {};
    if (name !== undefined) profileUpdates.name = name;
    if (email) profileUpdates.email = email;
    if (phone !== undefined) profileUpdates.phone = phone;
    if (avatarUrl !== undefined) profileUpdates.avatar_url = avatarUrl;
    if (caller.isAdmin && !isSelf) {
      if (role) profileUpdates.role = role;
      if (body.permissions !== undefined) {
        profileUpdates.permissions = normalizePermissions(effectiveRole, body.permissions);
      }
      if (typeof body.restricted === "boolean") profileUpdates.restricted = body.restricted;
    }

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await adminClient
        .from("profiles")
        .update(profileUpdates)
        .eq("id", target.id)
        .eq("organization_id", caller.organizationId);
      if (profileError) return error(profileError.message, 500);
    }

    // Kısıtlanan kullanıcı Supabase Auth'ta da engellenir: yeniden giriş yapamaz,
    // oturumu yenilenemez. Kısıt kaldırılınca engel de kalkar.
    if (typeof body.restricted === "boolean" && caller.isAdmin && !isSelf) {
      const { error: banError } = await adminClient.auth.admin.updateUserById(target.id, {
        ban_duration: body.restricted ? "876000h" : "none",
      });
      if (banError) console.error("Kullanıcı giriş engeli güncellenemedi", banError);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return error(errorMessage(err), 500);
  }
}

export async function DELETE(request: Request) {
  const auth = await getRequestCaller(request);
  if (!auth.ok) return auth.response;
  const { caller } = auth;
  if (!caller.isAdmin) return error("Bu işlem için yetkiniz yok.", 403);

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return error("Kullanıcı ID zorunludur", 400);
    if (id === caller.id) return error("Kendi hesabınızı silemezsiniz.", 403);

    const target = await loadTarget(caller, id);
    if (!target) return error("Kullanıcı bulunamadı.", 404);
    if (normalizeRole(target.role) === "admin") return error("Admin kullanıcılar silinemez.", 403);

    const { error: deleteError } = await getSupabaseAdmin().auth.admin.deleteUser(target.id);
    if (deleteError) return error(deleteError.message, 400);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return error(errorMessage(err), 500);
  }
}

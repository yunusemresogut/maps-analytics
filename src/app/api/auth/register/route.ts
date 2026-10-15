import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getAdminPermissions } from "@/lib/permissions";
import { authErrorMessage } from "@/lib/auth-errors";

export async function POST(request: Request) {
  try {
    const adminClient = getSupabaseAdmin();
    const { email, password, name, companyName } = await request.json();

    if (!email || !password || !name || !companyName) {
      return NextResponse.json(
        { error: "Ad, e-posta, şifre ve firma adı zorunludur" },
        { status: 400 }
      );
    }

    if (String(password).length < 6) {
      return NextResponse.json(
        { error: "Şifre en az 6 karakter olmalıdır" },
        { status: 400 }
      );
    }

    // 1. Create organization
    const { data: org, error: orgError } = await adminClient
      .from("organizations")
      .insert({ name: companyName })
      .select("*")
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { error: orgError?.message || "Organizasyon oluşturulamadı" },
        { status: 500 }
      );
    }

    // 2. Create auth user
    const { data: userData, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, organization_id: org.id },
      });

    if (createError || !userData.user) {
      console.error("Kayıt: auth kullanıcısı oluşturulamadı", createError);
      await adminClient.from("organizations").delete().eq("id", org.id);
      const status = createError?.status && createError.status < 500 ? 400 : 500;
      return NextResponse.json(
        {
          error: authErrorMessage(
            createError,
            "Hesap oluşturulamadı. Lütfen biraz sonra tekrar deneyin."
          ),
        },
        { status }
      );
    }

    const userId = userData.user.id;

    // 3. Upsert profile as admin of the org
    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: userId,
      email,
      name,
      role: "admin",
      permissions: getAdminPermissions(),
      organization_id: org.id,
      restricted: false,
    });

    if (profileError) {
      await adminClient.auth.admin.deleteUser(userId);
      await adminClient.from("organizations").delete().eq("id", org.id);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user: { id: userId, email, name, role: "admin" },
      organization: { id: org.id, name: org.name },
    });
  } catch (error: unknown) {
    console.error("Kayıt başarısız", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kayıt başarısız" },
      { status: 500 }
    );
  }
}

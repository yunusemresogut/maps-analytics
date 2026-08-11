import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { defaultMatrixForRole } from "@/lib/permissions";
import { normalizeRole } from "@/lib/roles";

export async function POST(request: Request) {
  try {
    const adminClient = getSupabaseAdmin();
    const { email, password, name, permissions, role, organizationId } =
      await request.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "E-posta, şifre ve isim zorunludur" },
        { status: 400 }
      );
    }

    const normalizedRole = normalizeRole(role || "manager");
    if (normalizedRole === "admin") {
      return NextResponse.json(
        { error: "Admin rolü yalnızca kayıt ile oluşturulabilir" },
        { status: 400 }
      );
    }

    const { data: userData, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, organization_id: organizationId },
      });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    const userId = userData.user.id;
    const perms = permissions || defaultMatrixForRole(normalizedRole);

    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: userId,
      email,
      name,
      role: normalizedRole,
      permissions: perms,
      organization_id: organizationId || null,
      restricted: false,
    });

    if (profileError) {
      await adminClient.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user: { id: userId, email, name, role: normalizedRole },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const adminClient = getSupabaseAdmin();
    const {
      id,
      email,
      password,
      name,
      permissions,
      restricted,
      role,
      phone,
      avatarUrl,
    } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Kullanıcı ID zorunludur" },
        { status: 400 }
      );
    }

    const authUpdates: Record<string, unknown> = {};
    if (email) authUpdates.email = email;
    if (password) authUpdates.password = password;
    if (name) authUpdates.user_metadata = { name };

    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } = await adminClient.auth.admin.updateUserById(
        id,
        authUpdates
      );
      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }
    }

    const profileUpdates: Record<string, unknown> = {};
    if (name !== undefined) profileUpdates.name = name;
    if (email !== undefined) profileUpdates.email = email;
    if (permissions !== undefined) profileUpdates.permissions = permissions;
    if (restricted !== undefined) profileUpdates.restricted = restricted;
    if (role !== undefined) profileUpdates.role = normalizeRole(role);
    if (phone !== undefined) profileUpdates.phone = phone;
    if (avatarUrl !== undefined) profileUpdates.avatar_url = avatarUrl;

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await adminClient
        .from("profiles")
        .update(profileUpdates)
        .eq("id", id);

      if (profileError) {
        return NextResponse.json(
          { error: profileError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const adminClient = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Kullanıcı ID zorunludur" },
        { status: 400 }
      );
    }

    const { error } = await adminClient.auth.admin.deleteUser(id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

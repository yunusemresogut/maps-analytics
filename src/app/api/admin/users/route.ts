import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const adminClient = getSupabaseAdmin();
    const { email, password, name, permissions } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: "E-posta, şifre ve isim zorunludur" }, { status: 400 });
    }

    // 1. Create Auth User
    const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    const userId = userData.user.id;

    // 2. Update Profile (trigger will have already inserted it, but we update custom fields)
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        name,
        permissions: permissions || { view: true, add: false, edit: false, delete: false },
      })
      .eq("id", userId);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: { id: userId, email, name } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const adminClient = getSupabaseAdmin();
    const { id, email, password, name, permissions, restricted } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "Kullanıcı ID zorunludur" }, { status: 400 });
    }

    // 1. Update Auth User if email or password is changing
    const authUpdates: any = {};
    if (email) authUpdates.email = email;
    if (password) authUpdates.password = password;
    if (name) authUpdates.user_metadata = { name };

    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } = await adminClient.auth.admin.updateUserById(id, authUpdates);
      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }
    }

    // 2. Update Profile fields
    const profileUpdates: any = {};
    if (name !== undefined) profileUpdates.name = name;
    if (email !== undefined) profileUpdates.email = email;
    if (permissions !== undefined) profileUpdates.permissions = permissions;
    if (restricted !== undefined) profileUpdates.restricted = restricted;

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await adminClient
        .from("profiles")
        .update(profileUpdates)
        .eq("id", id);

      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 500 });
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
      return NextResponse.json({ error: "Kullanıcı ID zorunludur" }, { status: 400 });
    }

    // Delete Auth User (cascade will delete the profile row)
    const { error } = await adminClient.auth.admin.deleteUser(id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { supabase } from "@/lib/supabase";

/** Oturum açmış kullanıcı için organization_id döner; yoksa DB fonksiyonu ile oluşturur/atama yapar. */
export async function resolveOrganizationId(
  current?: string | null
): Promise<string | null> {
  if (current) return current;

  const { data, error } = await supabase.rpc("ensure_user_organization");
  if (error) {
    console.error("ensure_user_organization failed:", error);
    return null;
  }
  return (data as string) || null;
}

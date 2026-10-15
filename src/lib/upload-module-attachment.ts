import { supabase } from "@/lib/supabase";
import { isAllowedFileType } from "@/lib/file-types";
import type { User } from "@/types";

type UploadModuleAttachmentInput = {
  table: "ticket_attachments" | "contract_attachments";
  parentId: string;
  parentField: "ticket_id" | "contract_id";
  file: File;
  user: Pick<User, "id" | "name" | "organizationId">;
  bucket?: string;
};

export async function uploadModuleAttachment({
  table,
  parentId,
  parentField,
  file,
  user,
  bucket = "module-files",
}: UploadModuleAttachmentInput): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!user.organizationId) {
    return { ok: false, error: "Organizasyon bilgisi bulunamadı." };
  }
  if (!isAllowedFileType(file.name)) {
    return { ok: false, error: "Bu dosya türü desteklenmiyor." };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const path = `${parentId}/${Date.now()}_${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (uploadError) {
    return { ok: false, error: uploadError.message };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  const { error: insertError } = await supabase.from(table).insert({
    organization_id: user.organizationId,
    [parentField]: parentId,
    name: file.name,
    size: file.size,
    type: file.type,
    storage_path: data.publicUrl,
    uploaded_by: user.id,
    uploaded_by_name: user.name,
  });

  if (insertError) {
    await supabase.storage.from(bucket).remove([path]);
    return { ok: false, error: insertError.message };
  }

  return { ok: true };
}
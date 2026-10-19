import { supabase } from "@/lib/supabase";
import { getFileMimeType, isAllowedFileType, MAX_ATTACHMENT_BYTES } from "@/lib/file-types";
import type { User } from "@/types";

export const MODULE_FILES_BUCKET = "module-files";

/** Ek tablosu → üst kaydı gösteren sütun */
export const ATTACHMENT_PARENT_FIELDS = {
  ticket_attachments: "ticket_id",
  contract_attachments: "contract_id",
  progress_payment_attachments: "progress_payment_id",
} as const;

export type AttachmentTable = keyof typeof ATTACHMENT_PARENT_FIELDS;

type UploadModuleAttachmentInput = {
  table: AttachmentTable;
  parentId: string;
  file: File;
  user: Pick<User, "id" | "name" | "organizationId">;
  bucket?: string;
};

/**
 * storage_path sütununda public URL tutulur. Bucket özel olsa da açılabilsin
 * diye URL'den nesne yolu çıkarılıp kısa ömürlü imzalı URL üretilir.
 */
export function attachmentObjectPath(storagePath: string, bucket = MODULE_FILES_BUCKET): string {
  const marker = `/object/public/${bucket}/`;
  const index = storagePath.indexOf(marker);
  return index === -1 ? storagePath : decodeURIComponent(storagePath.slice(index + marker.length));
}

export async function getAttachmentUrl(
  storagePath: string,
  options: { download?: string; bucket?: string } = {}
): Promise<string> {
  const bucket = options.bucket ?? MODULE_FILES_BUCKET;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(attachmentObjectPath(storagePath, bucket), 60 * 10, {
      download: options.download ?? false,
    });
  // İmzalanamazsa (eski kayıt, farklı yol) public URL denenir
  return error || !data?.signedUrl ? storagePath : data.signedUrl;
}

export async function uploadModuleAttachment({
  table,
  parentId,
  file,
  user,
  bucket = MODULE_FILES_BUCKET,
}: UploadModuleAttachmentInput): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!user.organizationId) {
    return { ok: false, error: "Organizasyon bilgisi bulunamadı." };
  }
  if (!isAllowedFileType(file.name)) {
    return { ok: false, error: `"${file.name}": bu dosya türü desteklenmiyor.` };
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, error: `"${file.name}": dosya 50 MB sınırını aşıyor.` };
  }

  const contentType = getFileMimeType(file);
  const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const path = `${parentId}/${Date.now()}_${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, { cacheControl: "3600", upsert: false, contentType });

  if (uploadError) {
    return { ok: false, error: `"${file.name}": ${uploadError.message}` };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  const { error: insertError } = await supabase.from(table).insert({
    organization_id: user.organizationId,
    [ATTACHMENT_PARENT_FIELDS[table]]: parentId,
    name: file.name,
    size: file.size,
    type: contentType,
    storage_path: data.publicUrl,
    uploaded_by: user.id,
    uploaded_by_name: user.name,
  });

  if (insertError) {
    await supabase.storage.from(bucket).remove([path]);
    return { ok: false, error: `"${file.name}": ${insertError.message}` };
  }

  return { ok: true };
}

/** Birden çok dosyayı sırayla yükler; başarısız olanların hata mesajlarını döndürür */
export async function uploadModuleAttachments(
  input: Omit<UploadModuleAttachmentInput, "file"> & { files: File[] }
): Promise<string[]> {
  const errors: string[] = [];
  for (const file of input.files) {
    const result = await uploadModuleAttachment({ ...input, file });
    if (!result.ok) errors.push(result.error);
  }
  return errors;
}

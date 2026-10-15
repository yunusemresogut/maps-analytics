import { supabase } from "@/lib/supabase";

const BUCKET = "avatars";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function uploadAvatar(
  userId: string,
  file: File
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, error: "JPEG, PNG, WebP veya GIF yükleyin" };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Dosya en fazla 10 MB olabilir" };
  }

  const ext = EXTENSIONS[file.type];
  const path = `${userId}/avatar.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: true });

  if (uploadErr) {
    return { ok: false, error: uploadErr.message };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { ok: true, url: `${data.publicUrl}?v=${Date.now()}` };
}

export async function removeAvatarFiles(userId: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove(
    ["jpg", "jpeg", "png", "webp", "gif"].map(
      (extension) => `${userId}/avatar.${extension}`
    )
  );
}

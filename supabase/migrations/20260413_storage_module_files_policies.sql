-- Storage RLS: module-files & avatars buckets
-- Önkoşul: Supabase Dashboard → Storage'da bucket'lar oluşturulmuş olmalı:
--   module-files (private veya public)
--   avatars (public önerilir — profil fotoğrafı)

-- ========== module-files ==========
DROP POLICY IF EXISTS "module_files_insert" ON storage.objects;
CREATE POLICY "module_files_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'module-files');

DROP POLICY IF EXISTS "module_files_select" ON storage.objects;
CREATE POLICY "module_files_select"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'module-files');

DROP POLICY IF EXISTS "module_files_update" ON storage.objects;
CREATE POLICY "module_files_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'module-files');

DROP POLICY IF EXISTS "module_files_delete" ON storage.objects;
CREATE POLICY "module_files_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'module-files');

-- ========== avatars (kullanıcı kendi klasörüne yükler: {user_id}/avatar.ext) ==========
DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "avatars_select" ON storage.objects;
CREATE POLICY "avatars_select"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_public_select" ON storage.objects;
CREATE POLICY "avatars_public_select"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Güvenlik sıkılaştırması
-- Amaç: (1) kimse kendi rolünü/firmasını/yetkisini değiştiremesin,
-- (2) kimse başka bir kullanıcı adına kayıt oluşturamasın,
-- (3) dosyalar yalnızca ait oldukları firmanın kullanıcılarına açık olsun.
-- Kurallar yalnızca istemciden (authenticated/anon rolü) gelen isteklere uygulanır;
-- sunucu route'ları (service_role) ve SECURITY DEFINER fonksiyonlar etkilenmez.

-- =====================================================================
-- 1. Profiller yalnızca sunucu üzerinden değişir
--    Uygulama profillere istemciden hiç yazmaz; ad/telefon/fotoğraf ve
--    tüm yönetim işlemleri /api/admin/users üzerinden (yetki kontrollü) yapılır.
--    Bu olmadan kullanıcı kendi satırında role='admin' ya da başka bir
--    organization_id yazarak yetki/firma ele geçirebilirdi.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.guard_profile_writes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'Profiller yalnızca sunucu üzerinden değiştirilebilir'
      USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_writes ON public.profiles;
CREATE TRIGGER profiles_guard_writes
  BEFORE INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_writes();

-- =====================================================================
-- 2. "Kim yaptı" alanları istemciden alınmaz, oturumdaki kullanıcıdan yazılır
-- =====================================================================
CREATE OR REPLACE FUNCTION public.current_profile_name()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(NULLIF(name, ''), email) FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_profile_name() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_profile_name() TO authenticated;

-- created_by/updated_by: mağaza, ticket, sözleşme, hakediş, fatura
CREATE OR REPLACE FUNCTION public.stamp_record_actor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user <> 'authenticated' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.created_by_name := public.current_profile_name();
    IF NEW.updated_by IS NOT NULL THEN
      NEW.updated_by := auth.uid();
      NEW.updated_by_name := public.current_profile_name();
    END IF;
  ELSE
    -- Oluşturan değiştirilemez; güncelleyen her zaman oturumdaki kullanıcı
    NEW.created_by := OLD.created_by;
    NEW.created_by_name := OLD.created_by_name;
    NEW.updated_by := auth.uid();
    NEW.updated_by_name := public.current_profile_name();
  END IF;
  RETURN NEW;
END;
$$;

-- uploaded_by: ticket/sözleşme/hakediş ekleri
CREATE OR REPLACE FUNCTION public.stamp_uploader()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user <> 'authenticated' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.uploaded_by := auth.uid();
    NEW.uploaded_by_name := public.current_profile_name();
  ELSE
    NEW.uploaded_by := OLD.uploaded_by;
    NEW.uploaded_by_name := OLD.uploaded_by_name;
  END IF;
  RETURN NEW;
END;
$$;

-- user_id (+ user_name): mağaza notları ve dosyaları
CREATE OR REPLACE FUNCTION public.stamp_owner_with_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user <> 'authenticated' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.user_id := auth.uid();
    NEW.user_name := public.current_profile_name();
  ELSE
    NEW.user_id := OLD.user_id;
    NEW.user_name := OLD.user_name;
  END IF;
  RETURN NEW;
END;
$$;

-- user_id: keşif ve iş planı kalemleri
CREATE OR REPLACE FUNCTION public.stamp_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user <> 'authenticated' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.user_id := CASE WHEN TG_OP = 'INSERT' THEN auth.uid() ELSE OLD.user_id END;
  RETURN NEW;
END;
$$;

-- Aktivite logu: işlemi yapan her zaman oturumdaki kullanıcı
CREATE OR REPLACE FUNCTION public.stamp_activity_actor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user <> 'authenticated' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.actor_id := auth.uid();
    NEW.actor_name := public.current_profile_name();
  ELSE
    NEW.actor_id := OLD.actor_id;
    NEW.actor_name := OLD.actor_name;
  END IF;
  RETURN NEW;
END;
$$;

-- Mağaza onayları: onaylayan kişi ve zaman istemciden alınmaz
CREATE OR REPLACE FUNCTION public.stamp_store_approvals()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  IF current_user <> 'authenticated' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  v_name := public.current_profile_name();

  IF TG_OP = 'INSERT' OR NEW.architectural_approved IS DISTINCT FROM OLD.architectural_approved THEN
    NEW.architectural_approved_by := CASE WHEN NEW.architectural_approved THEN auth.uid() END;
    NEW.architectural_approved_by_name := CASE WHEN NEW.architectural_approved THEN v_name END;
    NEW.architectural_approved_at := CASE WHEN NEW.architectural_approved THEN now() END;
  ELSE
    NEW.architectural_approved_by := OLD.architectural_approved_by;
    NEW.architectural_approved_by_name := OLD.architectural_approved_by_name;
    NEW.architectural_approved_at := OLD.architectural_approved_at;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.mechanical_approved IS DISTINCT FROM OLD.mechanical_approved THEN
    NEW.mechanical_approved_by := CASE WHEN NEW.mechanical_approved THEN auth.uid() END;
    NEW.mechanical_approved_by_name := CASE WHEN NEW.mechanical_approved THEN v_name END;
    NEW.mechanical_approved_at := CASE WHEN NEW.mechanical_approved THEN now() END;
  ELSE
    NEW.mechanical_approved_by := OLD.mechanical_approved_by;
    NEW.mechanical_approved_by_name := OLD.mechanical_approved_by_name;
    NEW.mechanical_approved_at := OLD.mechanical_approved_at;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.electrical_approved IS DISTINCT FROM OLD.electrical_approved THEN
    NEW.electrical_approved_by := CASE WHEN NEW.electrical_approved THEN auth.uid() END;
    NEW.electrical_approved_by_name := CASE WHEN NEW.electrical_approved THEN v_name END;
    NEW.electrical_approved_at := CASE WHEN NEW.electrical_approved THEN now() END;
  ELSE
    NEW.electrical_approved_by := OLD.electrical_approved_by;
    NEW.electrical_approved_by_name := OLD.electrical_approved_by_name;
    NEW.electrical_approved_at := OLD.electrical_approved_at;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.project_opened IS DISTINCT FROM OLD.project_opened THEN
    NEW.project_opened_by := CASE WHEN NEW.project_opened THEN auth.uid() END;
    NEW.project_opened_by_name := CASE WHEN NEW.project_opened THEN v_name END;
    NEW.project_opened_at := CASE WHEN NEW.project_opened THEN now() END;
  ELSE
    NEW.project_opened_by := OLD.project_opened_by;
    NEW.project_opened_by_name := OLD.project_opened_by_name;
    NEW.project_opened_at := OLD.project_opened_at;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['stores', 'tickets', 'contracts', 'progress_payments', 'invoices'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_stamp_actor', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.stamp_record_actor()',
      t || '_stamp_actor', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['ticket_attachments', 'contract_attachments', 'progress_payment_attachments'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_stamp_uploader', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.stamp_uploader()',
      t || '_stamp_uploader', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['store_notes', 'store_files'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_stamp_owner', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.stamp_owner_with_name()',
      t || '_stamp_owner', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['store_materials', 'store_work_plan'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_stamp_owner', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.stamp_owner()',
      t || '_stamp_owner', t);
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS activity_logs_stamp_actor ON public.activity_logs;
CREATE TRIGGER activity_logs_stamp_actor
  BEFORE INSERT OR UPDATE ON public.activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.stamp_activity_actor();

DROP TRIGGER IF EXISTS stores_stamp_approvals ON public.stores;
CREATE TRIGGER stores_stamp_approvals
  BEFORE INSERT OR UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.stamp_store_approvals();

-- =====================================================================
-- 3. Dosya depoları firmaya göre kısıtlanır
--    RESTRICTIVE policy'ler, panelden tanımlanmış geniş (permissive)
--    kuralların üzerine ek şart koyar: dosyanın klasörü (ilk yol parçası)
--    kullanıcının firmasına ait bir kayda ait olmalı.
-- =====================================================================

-- module-files: {ticket|sözleşme|hakediş id}/{dosya}
CREATE OR REPLACE FUNCTION public.module_file_in_current_organization(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
      SELECT 1 FROM public.tickets
      WHERE id::text = split_part(p_name, '/', 1) AND organization_id = public.current_organization_id())
    OR EXISTS (
      SELECT 1 FROM public.contracts
      WHERE id::text = split_part(p_name, '/', 1) AND organization_id = public.current_organization_id())
    OR EXISTS (
      SELECT 1 FROM public.progress_payments
      WHERE id::text = split_part(p_name, '/', 1) AND organization_id = public.current_organization_id());
$$;

REVOKE ALL ON FUNCTION public.module_file_in_current_organization(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.module_file_in_current_organization(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.store_in_current_organization(text) TO anon;

DROP POLICY IF EXISTS module_files_tenant_isolation ON storage.objects;
CREATE POLICY module_files_tenant_isolation ON storage.objects
  AS RESTRICTIVE FOR ALL TO public
  USING (bucket_id <> 'module-files' OR public.module_file_in_current_organization(name))
  WITH CHECK (bucket_id <> 'module-files' OR public.module_file_in_current_organization(name));

-- store-files: {mağaza id}/{dosya}. Depo herkese açıktı (linki bilen giriş
-- yapmadan indirebiliyordu); gizli yapılır, uygulama imzalı bağlantı kullanır.
UPDATE storage.buckets SET public = false WHERE id = 'store-files';

DROP POLICY IF EXISTS store_files_storage_tenant_isolation ON storage.objects;
CREATE POLICY store_files_storage_tenant_isolation ON storage.objects
  AS RESTRICTIVE FOR ALL TO public
  USING (bucket_id <> 'store-files' OR public.store_in_current_organization(split_part(name, '/', 1)))
  WITH CHECK (bucket_id <> 'store-files' OR public.store_in_current_organization(split_part(name, '/', 1)));

-- Gizli depoda imzalı bağlantı üretmek, yüklemek ve silmek için izinler
-- (yukarıdaki RESTRICTIVE kural bunları firmanın mağazalarıyla sınırlar)
DROP POLICY IF EXISTS store_files_storage_select ON storage.objects;
CREATE POLICY store_files_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'store-files');

DROP POLICY IF EXISTS store_files_storage_insert ON storage.objects;
CREATE POLICY store_files_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'store-files');

DROP POLICY IF EXISTS store_files_storage_delete ON storage.objects;
CREATE POLICY store_files_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'store-files');

-- Modül yetkileri veritabanında da uygulanır
-- Şimdiye kadar görüntüle/ekle/düzenle/sil yetkileri yalnızca arayüzde
-- kontrol ediliyordu; veritabanı sadece firma sınırına bakıyordu. Teknik
-- bilgisi olan bir kullanıcı API'yi doğrudan çağırarak yetkisi olmayan
-- kayıtları ekleyip silebilirdi. Buradaki kurallar RESTRICTIVE'dir: mevcut
-- izinlerin üzerine ek şart koyar. Sunucu (service_role) etkilenmez.
--
-- Yetki hesabı src/lib/permissions.ts → normalizePermissions /
-- builtInMatrixForRole ile birebir aynıdır; birini değiştiren diğerini de
-- değiştirmelidir.

-- =====================================================================
-- 1. Yetki hesabı (saf fonksiyonlar)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.app_normalize_role(p_role text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_role IN ('admin', 'mechanical_engineer', 'electrical_engineer', 'architect',
                    'civil_engineer', 'manager', 'regional_manager', 'store_manager', 'accounting')
      THEN p_role
    ELSE 'manager'
  END;
$$;

-- Rolün yerleşik varsayılan yetkisi: {view, add, edit, delete}
CREATE OR REPLACE FUNCTION public.app_builtin_crud(p_role text, p_module text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  c_none    CONSTANT jsonb := '{"view":false,"add":false,"edit":false,"delete":false}';
  c_view    CONSTANT jsonb := '{"view":true,"add":false,"edit":false,"delete":false}';
  c_edit    CONSTANT jsonb := '{"view":true,"add":false,"edit":true,"delete":false}';
  c_default CONSTANT jsonb := '{"view":true,"add":true,"edit":true,"delete":false}';
  c_full    CONSTANT jsonb := '{"view":true,"add":true,"edit":true,"delete":true}';
  v_role text := public.app_normalize_role(p_role);
BEGIN
  IF v_role = 'admin' THEN
    RETURN c_full;
  END IF;

  IF v_role = 'accounting' THEN
    RETURN CASE
      WHEN p_module IN ('map', 'stores') THEN c_view
      WHEN p_module IN ('progressPayments', 'invoices') THEN c_default
      ELSE c_none END;
  END IF;

  IF v_role = 'store_manager' THEN
    RETURN CASE
      WHEN p_module IN ('map', 'stores') THEN c_edit
      WHEN p_module = 'projects' THEN c_view
      WHEN p_module = 'tickets' THEN c_default
      ELSE c_none END;
  END IF;

  IF v_role IN ('mechanical_engineer', 'electrical_engineer', 'architect', 'civil_engineer') THEN
    RETURN CASE
      WHEN p_module IN ('map', 'stores', 'projects', 'tickets') THEN c_default
      WHEN p_module = 'approvals' THEN c_edit
      ELSE c_none END;
  END IF;

  IF v_role IN ('manager', 'regional_manager') THEN
    RETURN CASE
      WHEN p_module IN ('map', 'stores', 'projects', 'approvals', 'tickets', 'contracts', 'progressPayments')
        THEN c_default
      ELSE c_none END;
  END IF;

  RETURN CASE WHEN p_module IN ('map', 'stores') THEN c_view ELSE c_none END;
END;
$$;

CREATE OR REPLACE FUNCTION public.app_module_permission(
  p_role text,
  p_permissions jsonb,
  p_module text,
  p_action text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  c_modules CONSTANT text[] := ARRAY['map', 'stores', 'projects', 'approvals', 'tickets',
                                     'contracts', 'progressPayments', 'invoices'];
  c_actions CONSTANT text[] := ARRAY['view', 'add', 'edit', 'delete'];
  v_role text := public.app_normalize_role(p_role);
  v_is_matrix boolean := jsonb_typeof(p_permissions) = 'object';
  v_is_flat boolean;
  v_crud jsonb;
  m text;
  a text;
BEGIN
  IF v_role = 'admin' THEN
    RETURN true;
  END IF;
  IF NOT (p_module = ANY (c_modules)) OR NOT (p_action = ANY (c_actions)) THEN
    RETURN false;
  END IF;

  -- Tam matris: 8 modülün hepsinde 4 eylem boolean
  IF v_is_matrix THEN
    FOREACH m IN ARRAY c_modules LOOP
      IF jsonb_typeof(p_permissions -> m) IS DISTINCT FROM 'object' THEN
        v_is_matrix := false;
        EXIT;
      END IF;
      FOREACH a IN ARRAY c_actions LOOP
        IF jsonb_typeof(p_permissions -> m -> a) IS DISTINCT FROM 'boolean' THEN
          v_is_matrix := false;
          EXIT;
        END IF;
      END LOOP;
      EXIT WHEN NOT v_is_matrix;
    END LOOP;
  END IF;

  IF v_is_matrix THEN
    v_crud := p_permissions -> p_module;
  ELSE
    -- Eski düz biçim: {view, add, edit, delete}; rolün erişebildiği modüllere uygulanır
    v_is_flat := jsonb_typeof(p_permissions) = 'object'
      AND jsonb_typeof(p_permissions -> 'view') = 'boolean'
      AND jsonb_typeof(p_permissions -> 'add') = 'boolean'
      AND jsonb_typeof(p_permissions -> 'edit') = 'boolean'
      AND jsonb_typeof(p_permissions -> 'delete') = 'boolean'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(c_modules) AS k
        WHERE p_permissions ? k AND jsonb_typeof(p_permissions -> k) IN ('object', 'array', 'null')
      );

    IF v_is_flat THEN
      IF NOT (public.app_builtin_crud(v_role, p_module) ->> 'view')::boolean THEN
        RETURN false;
      END IF;
      v_crud := p_permissions;
    ELSE
      -- Eksik/geçersiz: rolün varsayılanı (bu durumda ekle/düzenle/sil zaten görüntülemeyi içerir)
      RETURN (public.app_builtin_crud(v_role, p_module) ->> p_action)::boolean;
    END IF;
  END IF;

  -- Ekle/düzenle/sil görüntülemeyi de kapsar
  IF p_action = 'view' THEN
    RETURN (v_crud ->> 'view')::boolean OR (v_crud ->> 'add')::boolean
        OR (v_crud ->> 'edit')::boolean OR (v_crud ->> 'delete')::boolean;
  END IF;
  RETURN (v_crud ->> p_action)::boolean;
END;
$$;

-- Oturumdaki kullanıcının yetkisi (kısıtlanmış kullanıcı hiçbir şey yapamaz)
CREATE OR REPLACE FUNCTION public.has_module_permission(p_module text, p_action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT NOT COALESCE(p.restricted, false)
        AND public.app_module_permission(p.role, p.permissions, p_module, p_action)
     FROM public.profiles p
     WHERE p.id = auth.uid()),
    false);
$$;

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.app_normalize_role(role) FROM public.profiles WHERE id = auth.uid();
$$;

-- Mağaza ve detaylarını (not, dosya, keşif, iş planı) düzenleme: harita veya mağazalar
CREATE OR REPLACE FUNCTION public.can_edit_stores()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.has_module_permission('map', 'edit') OR public.has_module_permission('stores', 'edit');
$$;

REVOKE ALL ON FUNCTION public.has_module_permission(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_app_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_module_permission(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_stores() TO authenticated;
GRANT EXECUTE ON FUNCTION public.app_module_permission(text, jsonb, text, text) TO authenticated, service_role;

-- =====================================================================
-- 2. Ticket, sözleşme, hakediş, fatura: ekle / düzenle / sil
-- =====================================================================
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('tickets', 'tickets'),
    ('contracts', 'contracts'),
    ('progress_payments', 'progressPayments'),
    ('invoices', 'invoices')
  ) AS t(tbl, module) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.tbl || '_module_insert', r.tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated
         WITH CHECK (public.has_module_permission(%L, ''add''))',
      r.tbl || '_module_insert', r.tbl, r.module);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.tbl || '_module_update', r.tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated
         USING (public.has_module_permission(%L, ''edit''))
         WITH CHECK (public.has_module_permission(%L, ''edit''))',
      r.tbl || '_module_update', r.tbl, r.module, r.module);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.tbl || '_module_delete', r.tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated
         USING (public.has_module_permission(%L, ''delete''))',
      r.tbl || '_module_delete', r.tbl, r.module);
  END LOOP;

  -- Ekler: kaydı oluşturan (ekle) veya düzenleyen yükleyebilir; düzenleme yetkisi olan siler
  FOR r IN SELECT * FROM (VALUES
    ('ticket_attachments', 'tickets'),
    ('contract_attachments', 'contracts'),
    ('progress_payment_attachments', 'progressPayments')
  ) AS t(tbl, module) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.tbl || '_module_insert', r.tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated
         WITH CHECK (public.has_module_permission(%L, ''add'') OR public.has_module_permission(%L, ''edit''))',
      r.tbl || '_module_insert', r.tbl, r.module, r.module);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.tbl || '_module_update', r.tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated
         USING (public.has_module_permission(%L, ''edit''))
         WITH CHECK (public.has_module_permission(%L, ''edit''))',
      r.tbl || '_module_update', r.tbl, r.module, r.module);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.tbl || '_module_delete', r.tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated
         USING (public.has_module_permission(%L, ''edit'') OR public.has_module_permission(%L, ''delete''))',
      r.tbl || '_module_delete', r.tbl, r.module, r.module);
  END LOOP;

  -- Mağaza detayları: düzenleme yetkisi
  FOR r IN SELECT * FROM (VALUES ('store_notes'), ('store_files'), ('store_materials'), ('store_work_plan'))
    AS t(tbl) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.tbl || '_module_insert', r.tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated
         WITH CHECK (public.can_edit_stores())',
      r.tbl || '_module_insert', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.tbl || '_module_update', r.tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated
         USING (public.can_edit_stores()) WITH CHECK (public.can_edit_stores())',
      r.tbl || '_module_update', r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.tbl || '_module_delete', r.tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated
         USING (public.can_edit_stores())',
      r.tbl || '_module_delete', r.tbl);
  END LOOP;
END;
$$;

-- =====================================================================
-- 3. Mağazalar
--    Ekle/sil: harita veya mağazalar modülü. Düzenle: harita/mağazalar
--    düzenleme ya da onaylar düzenleme (yalnızca onay alanları, aşağıda).
-- =====================================================================
DROP POLICY IF EXISTS stores_module_insert ON public.stores;
CREATE POLICY stores_module_insert ON public.stores
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.has_module_permission('map', 'add') OR public.has_module_permission('stores', 'add'));

DROP POLICY IF EXISTS stores_module_update ON public.stores;
CREATE POLICY stores_module_update ON public.stores
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.can_edit_stores() OR public.has_module_permission('approvals', 'edit'))
  WITH CHECK (public.can_edit_stores() OR public.has_module_permission('approvals', 'edit'));

DROP POLICY IF EXISTS stores_module_delete ON public.stores;
CREATE POLICY stores_module_delete ON public.stores
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.has_module_permission('map', 'delete') OR public.has_module_permission('stores', 'delete'));

-- Onay kuralları (src/lib/roles.ts ile aynı) ve onaylayan bilgisinin damgalanması.
-- Önceki migration'daki fonksiyonun yerini alır.
CREATE OR REPLACE FUNCTION public.stamp_store_approvals()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_role text;
  v_full_manager boolean;
  v_can_approve boolean;
  v_was_opened boolean;
  v_store_editor boolean;
  d text;
  v_role_for text;
  v_old boolean;
  v_new boolean;
  c_ignored CONSTANT text[] := ARRAY[
    'architectural_approved', 'architectural_approved_by', 'architectural_approved_by_name', 'architectural_approved_at',
    'mechanical_approved', 'mechanical_approved_by', 'mechanical_approved_by_name', 'mechanical_approved_at',
    'electrical_approved', 'electrical_approved_by', 'electrical_approved_by_name', 'electrical_approved_at',
    'project_opened', 'project_opened_by', 'project_opened_by_name', 'project_opened_at',
    'updated_by', 'updated_by_name', 'updated_at'];
BEGIN
  IF current_user <> 'authenticated' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_name := public.current_profile_name();
  v_role := public.current_app_role();
  v_full_manager := v_role IN ('admin', 'manager', 'regional_manager');
  v_can_approve := public.has_module_permission('approvals', 'edit');
  v_was_opened := CASE WHEN TG_OP = 'INSERT' THEN false ELSE COALESCE(OLD.project_opened, false) END;

  -- Yalnızca onay yetkisi olan (mağaza düzenleme yetkisi olmayan) kullanıcı
  -- mağazanın diğer alanlarını değiştiremez
  IF TG_OP = 'UPDATE' THEN
    v_store_editor := public.can_edit_stores();
    IF NOT v_store_editor AND (to_jsonb(NEW) - c_ignored) IS DISTINCT FROM (to_jsonb(OLD) - c_ignored) THEN
      RAISE EXCEPTION 'Mağaza bilgilerini düzenleme yetkiniz yok' USING ERRCODE = '42501';
    END IF;
  END IF;

  FOREACH d IN ARRAY ARRAY['architectural', 'mechanical', 'electrical'] LOOP
    v_role_for := CASE d WHEN 'architectural' THEN 'architect'
                         WHEN 'mechanical' THEN 'mechanical_engineer'
                         ELSE 'electrical_engineer' END;
    v_new := COALESCE((to_jsonb(NEW) ->> (d || '_approved'))::boolean, false);
    v_old := CASE WHEN TG_OP = 'INSERT' THEN false
                  ELSE COALESCE((to_jsonb(OLD) ->> (d || '_approved'))::boolean, false) END;

    IF v_new IS DISTINCT FROM v_old THEN
      -- Proje açıldıktan sonra yalnızca admin/yöneticiler; öncesinde ilgili disiplin veya yöneticiler
      IF NOT v_can_approve
         OR (v_was_opened AND NOT v_full_manager)
         OR (NOT v_was_opened AND NOT (v_full_manager OR v_role = v_role_for)) THEN
        RAISE EXCEPTION 'Bu onayı değiştirme yetkiniz yok' USING ERRCODE = '42501';
      END IF;
    END IF;
  END LOOP;

  v_new := COALESCE(NEW.project_opened, false);
  IF v_new IS DISTINCT FROM v_was_opened THEN
    IF v_new THEN
      -- Açmak: admin, mühendis veya yönetici; üç disiplin onaylı olmalı
      IF NOT v_can_approve
         OR NOT (v_full_manager OR v_role IN ('mechanical_engineer', 'electrical_engineer', 'architect', 'civil_engineer'))
         OR NOT (COALESCE(NEW.architectural_approved, false) AND COALESCE(NEW.mechanical_approved, false)
                 AND COALESCE(NEW.electrical_approved, false)) THEN
        RAISE EXCEPTION 'Projeyi açma yetkiniz yok ya da disiplin onayları eksik' USING ERRCODE = '42501';
      END IF;
    ELSIF NOT v_can_approve OR NOT v_full_manager THEN
      RAISE EXCEPTION 'Projeyi kapatma yetkiniz yok' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Onaylayan kişi ve zaman istemciden alınmaz
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

-- Mağaza "Hakediş" aşamasına geçince açık sözleşmeleri tamamlanır. Önceden
-- tarayıcı yapıyordu; sözleşme yetkisi olmayan kullanıcıda artık çalışmayacağı
-- için veritabanına taşındı (SECURITY DEFINER: kullanıcının yetkisinden bağımsız).
CREATE OR REPLACE FUNCTION public.complete_contracts_on_hakedis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.contracts
  SET status = 'completed'
  WHERE store_id = NEW.id
    AND organization_id = NEW.organization_id
    AND status IN ('active', 'draft');
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_contracts_on_hakedis() FROM PUBLIC;

DROP TRIGGER IF EXISTS stores_complete_contracts_on_hakedis ON public.stores;
CREATE TRIGGER stores_complete_contracts_on_hakedis
  AFTER UPDATE OF project_status ON public.stores
  FOR EACH ROW
  WHEN (NEW.project_status = 'hakedis' AND OLD.project_status IS DISTINCT FROM 'hakedis')
  EXECUTE FUNCTION public.complete_contracts_on_hakedis();

-- =====================================================================
-- 4. Bölgeler: yalnızca admin yönetir (arayüzde yalnızca admin panelinde)
-- =====================================================================
DROP POLICY IF EXISTS regions_admin_write_insert ON public.regions;
CREATE POLICY regions_admin_write_insert ON public.regions
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.current_app_role() = 'admin');

DROP POLICY IF EXISTS regions_admin_write_update ON public.regions;
CREATE POLICY regions_admin_write_update ON public.regions
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.current_app_role() = 'admin')
  WITH CHECK (public.current_app_role() = 'admin');

DROP POLICY IF EXISTS regions_admin_write_delete ON public.regions;
CREATE POLICY regions_admin_write_delete ON public.regions
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.current_app_role() = 'admin');

-- =====================================================================
-- 5. Dosya depoları: yükleme/silme de modül yetkisine bağlı
-- =====================================================================
CREATE OR REPLACE FUNCTION public.module_file_can_write(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (EXISTS (SELECT 1 FROM public.tickets
             WHERE id::text = split_part(p_name, '/', 1) AND organization_id = public.current_organization_id())
      AND (public.has_module_permission('tickets', 'add') OR public.has_module_permission('tickets', 'edit')))
    OR (EXISTS (SELECT 1 FROM public.contracts
             WHERE id::text = split_part(p_name, '/', 1) AND organization_id = public.current_organization_id())
      AND (public.has_module_permission('contracts', 'add') OR public.has_module_permission('contracts', 'edit')))
    OR (EXISTS (SELECT 1 FROM public.progress_payments
             WHERE id::text = split_part(p_name, '/', 1) AND organization_id = public.current_organization_id())
      AND (public.has_module_permission('progressPayments', 'add')
           OR public.has_module_permission('progressPayments', 'edit')));
$$;

REVOKE ALL ON FUNCTION public.module_file_can_write(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.module_file_can_write(text) TO authenticated;

DROP POLICY IF EXISTS module_files_module_insert ON storage.objects;
CREATE POLICY module_files_module_insert ON storage.objects
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id <> 'module-files' OR public.module_file_can_write(name));

DROP POLICY IF EXISTS module_files_module_delete ON storage.objects;
CREATE POLICY module_files_module_delete ON storage.objects
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (bucket_id <> 'module-files' OR public.module_file_can_write(name));

DROP POLICY IF EXISTS store_files_module_insert ON storage.objects;
CREATE POLICY store_files_module_insert ON storage.objects
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id <> 'store-files' OR public.can_edit_stores());

DROP POLICY IF EXISTS store_files_module_delete ON storage.objects;
CREATE POLICY store_files_module_delete ON storage.objects
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (bucket_id <> 'store-files' OR public.can_edit_stores());

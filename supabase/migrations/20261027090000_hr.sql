-- İnsan Kaynakları (Faz 1): personel kartları, özlük (hassas) bilgileri,
-- belge / sertifika takibi ve puantaj.
--
-- Yetki üç yeni modüldür (varsayılan olarak yalnızca admin'de açıktır):
--   personnel         Personel kartları ve belgeler
--   personnelPrivate  Özlük: TC kimlik no, doğum tarihi, adres, IBAN, acil durum
--                     kişisi ve sağlık raporu dosyaları (KVKK: hassas / özel nitelikli)
--   timesheets        Puantaj
-- Personel bir kullanıcıya bağlıysa (personnel.user_id) yetkisi olmasa da kendi
-- kartını, özlük bilgisini, belgelerini ve puantajını görür; kendi belgesini
-- ekleyebilir. Personelin eklediği belge İK onaylayana kadar "onay bekliyor"dur.

-- =====================================================================
-- 1. Yetki matrisi: yeni modüller (20261021180000_inventory.sql içindeki
--    fonksiyonun yeni hâli; yalnızca c_modules değişti)
-- =====================================================================
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
  -- Matrisin geçerli sayılması için bulunması gereken modüller
  c_core CONSTANT text[] := ARRAY['map', 'stores', 'projects', 'approvals', 'tickets',
                                  'contracts', 'progressPayments', 'invoices'];
  c_modules CONSTANT text[] := c_core || ARRAY['inventory', 'personnel', 'personnelPrivate', 'timesheets'];
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

  IF v_is_matrix THEN
    FOREACH m IN ARRAY c_core LOOP
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
    -- Matriste olmayan (sonradan eklenen) modül: yetki yok
    IF jsonb_typeof(v_crud) IS DISTINCT FROM 'object' THEN
      RETURN false;
    END IF;
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
      RETURN (public.app_builtin_crud(v_role, p_module) ->> p_action)::boolean;
    END IF;
  END IF;

  -- Ekle/düzenle/sil görüntülemeyi de kapsar
  IF p_action = 'view' THEN
    RETURN COALESCE((v_crud ->> 'view')::boolean, false) OR COALESCE((v_crud ->> 'add')::boolean, false)
        OR COALESCE((v_crud ->> 'edit')::boolean, false) OR COALESCE((v_crud ->> 'delete')::boolean, false);
  END IF;
  RETURN COALESCE((v_crud ->> p_action)::boolean, false);
END;
$$;
-- app_builtin_crud yeni modüller için admin dışında hiçbir role yetki vermez.

-- =====================================================================
-- 2. Tablolar
-- =====================================================================
-- Personel: uygulamaya giriş yapmayan (taşeron, işçi) kişiler de kaydedilir;
-- giriş yapan personel user_id ile kendi hesabına bağlanır.
CREATE TABLE IF NOT EXISTS public.personnel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_organization_id()
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL DEFAULT '',
  full_name text NOT NULL CHECK (btrim(full_name) <> ''),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  employment_type text NOT NULL DEFAULT 'office'
    CHECK (employment_type IN ('office', 'salaried', 'daily', 'subcontractor')),
  -- Taşeron personelin bağlı olduğu alt işveren
  subcontractor_company text NOT NULL DEFAULT '',
  department text NOT NULL DEFAULT '',
  job_title text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  store_id text REFERENCES public.stores(id) ON DELETE SET NULL,
  start_date date,
  end_date date,
  -- KVKK aydınlatma metninin personele tebliğ edildiği tarih
  privacy_notice_date date,
  notes text NOT NULL DEFAULT '',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_by_name text,
  updated_at timestamptz,
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS personnel_org_idx ON public.personnel (organization_id, full_name);
-- Bir kullanıcı firmada en fazla bir personel kartına bağlanır
CREATE UNIQUE INDEX IF NOT EXISTS personnel_user_idx
  ON public.personnel (organization_id, user_id) WHERE user_id IS NOT NULL;

-- Özlük: ayrı tabloda, yalnızca personnelPrivate yetkisi (ve kişinin kendisi) okur
CREATE TABLE IF NOT EXISTS public.personnel_private (
  personnel_id uuid PRIMARY KEY REFERENCES public.personnel(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL DEFAULT public.current_organization_id()
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  national_id text NOT NULL DEFAULT '' CHECK (national_id = '' OR national_id ~ '^[0-9]{11}$'),
  birth_date date,
  address text NOT NULL DEFAULT '',
  iban text NOT NULL DEFAULT '',
  emergency_contact_name text NOT NULL DEFAULT '',
  emergency_contact_phone text NOT NULL DEFAULT '',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_by_name text,
  updated_at timestamptz
);

-- Belge / sertifika. Süresi olmayan belgede expires_at boştur.
CREATE TABLE IF NOT EXISTS public.personnel_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_organization_id()
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  personnel_id uuid NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'other'
    CHECK (type IN ('isg_training', 'health_check', 'myk', 'height_work', 'operator',
                    'driver_license', 'first_aid', 'emergency_team', 'other')),
  name text NOT NULL DEFAULT '',
  document_no text NOT NULL DEFAULT '',
  issuer text NOT NULL DEFAULT '',
  issued_at date,
  expires_at date,
  -- hr-files bucket'ındaki nesne yolu: <firma>/<personel>/<belge>/<dosya>
  file_path text,
  file_name text,
  verified boolean NOT NULL DEFAULT false,
  verified_by_name text,
  verified_at timestamptz,
  notes text NOT NULL DEFAULT '',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_by_name text,
  updated_at timestamptz,
  CHECK (expires_at IS NULL OR issued_at IS NULL OR expires_at >= issued_at)
);

CREATE INDEX IF NOT EXISTS personnel_certificates_personnel_idx
  ON public.personnel_certificates (personnel_id, expires_at);
CREATE INDEX IF NOT EXISTS personnel_certificates_expiry_idx
  ON public.personnel_certificates (organization_id, expires_at) WHERE expires_at IS NOT NULL;

-- Puantaj: personel başına günde tek kayıt
CREATE TABLE IF NOT EXISTS public.timesheet_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_organization_id()
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  personnel_id uuid NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  status text NOT NULL
    CHECK (status IN ('worked', 'half_day', 'annual_leave', 'excused_leave', 'sick_leave',
                      'unpaid_leave', 'absent', 'weekly_rest', 'public_holiday')),
  hours numeric(4, 2) NOT NULL DEFAULT 0 CHECK (hours >= 0 AND hours <= 24),
  overtime_hours numeric(4, 2) NOT NULL DEFAULT 0 CHECK (overtime_hours >= 0 AND overtime_hours <= 24),
  store_id text REFERENCES public.stores(id) ON DELETE SET NULL,
  notes text NOT NULL DEFAULT '',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_by_name text,
  updated_at timestamptz,
  CHECK (hours + overtime_hours <= 24),
  UNIQUE (personnel_id, work_date)
);

CREATE INDEX IF NOT EXISTS timesheet_entries_org_date_idx ON public.timesheet_entries (organization_id, work_date);

-- =====================================================================
-- 3. Sunucu tarafı damgalar ve korumalar
-- =====================================================================
-- Firma, oluşturan ve güncelleyen sunucudan yazılır (envanterdeki fonksiyon)
DROP TRIGGER IF EXISTS personnel_stamp ON public.personnel;
CREATE TRIGGER personnel_stamp
  BEFORE INSERT OR UPDATE ON public.personnel
  FOR EACH ROW EXECUTE FUNCTION public.stamp_inventory_row();

DROP TRIGGER IF EXISTS personnel_private_stamp ON public.personnel_private;
CREATE TRIGGER personnel_private_stamp
  BEFORE INSERT OR UPDATE ON public.personnel_private
  FOR EACH ROW EXECUTE FUNCTION public.stamp_inventory_row();

DROP TRIGGER IF EXISTS personnel_certificates_stamp ON public.personnel_certificates;
CREATE TRIGGER personnel_certificates_stamp
  BEFORE INSERT OR UPDATE ON public.personnel_certificates
  FOR EACH ROW EXECUTE FUNCTION public.stamp_inventory_row();

DROP TRIGGER IF EXISTS timesheet_entries_stamp ON public.timesheet_entries;
CREATE TRIGGER timesheet_entries_stamp
  BEFORE INSERT OR UPDATE ON public.timesheet_entries
  FOR EACH ROW EXECUTE FUNCTION public.stamp_inventory_row();

-- Oturumdaki kullanıcının personel kartı (yoksa NULL)
CREATE OR REPLACE FUNCTION public.my_personnel_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.personnel
  WHERE user_id = auth.uid() AND organization_id = public.current_organization_id()
  LIMIT 1;
$$;

-- Personel firmada mı (alt tablolara başka firmanın personeli yazılamaz)
CREATE OR REPLACE FUNCTION public.personnel_in_current_organization(p_personnel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.personnel
    WHERE id = p_personnel_id AND organization_id = public.current_organization_id()
  );
$$;

REVOKE ALL ON FUNCTION public.my_personnel_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.personnel_in_current_organization(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_personnel_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.personnel_in_current_organization(uuid) TO authenticated;

-- Bağlanan kullanıcı aynı firmadan olmalı
CREATE OR REPLACE FUNCTION public.guard_personnel_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = NEW.user_id AND organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Kullanıcı bu firmada değil' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS personnel_guard_user ON public.personnel;
CREATE TRIGGER personnel_guard_user
  BEFORE INSERT OR UPDATE OF user_id, organization_id ON public.personnel
  FOR EACH ROW EXECUTE FUNCTION public.guard_personnel_user();

-- Belge başka personele taşınamaz. Onayı yalnızca personel düzenleme yetkisi
-- verir; onaylayan ve zaman sunucudan yazılır. Onaysız kişi (personelin
-- kendisi) belgeyi değiştirirse belge yeniden onay bekler.
CREATE OR REPLACE FUNCTION public.stamp_personnel_certificate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_reviewer boolean := current_user <> 'authenticated'
    OR public.has_module_permission('personnel', 'edit')
    OR public.has_module_permission('personnel', 'add');
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.personnel_id := OLD.personnel_id;
  END IF;
  IF NOT v_reviewer THEN
    NEW.verified := false;
  END IF;
  IF NOT NEW.verified THEN
    NEW.verified_by_name := NULL;
    NEW.verified_at := NULL;
  ELSIF TG_OP = 'INSERT' OR NOT OLD.verified THEN
    NEW.verified_by_name := public.current_profile_name();
    NEW.verified_at := now();
  ELSE
    NEW.verified_by_name := OLD.verified_by_name;
    NEW.verified_at := OLD.verified_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS personnel_certificates_verify ON public.personnel_certificates;
CREATE TRIGGER personnel_certificates_verify
  BEFORE INSERT OR UPDATE ON public.personnel_certificates
  FOR EACH ROW EXECUTE FUNCTION public.stamp_personnel_certificate();

-- Puantaj kaydı başka personele ya da güne taşınamaz
CREATE OR REPLACE FUNCTION public.stamp_timesheet_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.personnel_id := OLD.personnel_id;
  NEW.work_date := OLD.work_date;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS timesheet_entries_lock_key ON public.timesheet_entries;
CREATE TRIGGER timesheet_entries_lock_key
  BEFORE UPDATE ON public.timesheet_entries
  FOR EACH ROW EXECUTE FUNCTION public.stamp_timesheet_entry();

-- =====================================================================
-- 4. Erişim (RLS)
-- =====================================================================
ALTER TABLE public.personnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personnel_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personnel_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheet_entries ENABLE ROW LEVEL SECURITY;

-- Personel: puantaj yetkilisi de listeyi görür (özlük ayrı tablodadır)
DROP POLICY IF EXISTS personnel_select ON public.personnel;
CREATE POLICY personnel_select ON public.personnel
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (public.has_module_permission('personnel', 'view')
         OR public.has_module_permission('timesheets', 'view')
         OR user_id = auth.uid())
  );

DROP POLICY IF EXISTS personnel_insert ON public.personnel;
CREATE POLICY personnel_insert ON public.personnel
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.has_module_permission('personnel', 'add')
    AND (store_id IS NULL OR public.store_in_current_organization(store_id))
  );

DROP POLICY IF EXISTS personnel_update ON public.personnel;
CREATE POLICY personnel_update ON public.personnel
  FOR UPDATE TO authenticated
  USING (organization_id = public.current_organization_id() AND public.has_module_permission('personnel', 'edit'))
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (store_id IS NULL OR public.store_in_current_organization(store_id))
  );

DROP POLICY IF EXISTS personnel_delete ON public.personnel;
CREATE POLICY personnel_delete ON public.personnel
  FOR DELETE TO authenticated
  USING (organization_id = public.current_organization_id() AND public.has_module_permission('personnel', 'delete'));

-- Özlük: kişi kendi bilgisini görür (KVKK md. 11 erişim hakkı), değiştiremez
DROP POLICY IF EXISTS personnel_private_select ON public.personnel_private;
CREATE POLICY personnel_private_select ON public.personnel_private
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (public.has_module_permission('personnelPrivate', 'view') OR personnel_id = public.my_personnel_id())
  );

DROP POLICY IF EXISTS personnel_private_insert ON public.personnel_private;
CREATE POLICY personnel_private_insert ON public.personnel_private
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.has_module_permission('personnelPrivate', 'edit')
    AND public.personnel_in_current_organization(personnel_id)
  );

DROP POLICY IF EXISTS personnel_private_update ON public.personnel_private;
CREATE POLICY personnel_private_update ON public.personnel_private
  FOR UPDATE TO authenticated
  USING (organization_id = public.current_organization_id() AND public.has_module_permission('personnelPrivate', 'edit'))
  WITH CHECK (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS personnel_private_delete ON public.personnel_private;
CREATE POLICY personnel_private_delete ON public.personnel_private
  FOR DELETE TO authenticated
  USING (organization_id = public.current_organization_id() AND public.has_module_permission('personnelPrivate', 'delete'));

-- Belgeler: personel kendi belgesini ekler; onaylanana kadar düzenleyip silebilir
DROP POLICY IF EXISTS personnel_certificates_select ON public.personnel_certificates;
CREATE POLICY personnel_certificates_select ON public.personnel_certificates
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (public.has_module_permission('personnel', 'view') OR personnel_id = public.my_personnel_id())
  );

DROP POLICY IF EXISTS personnel_certificates_insert ON public.personnel_certificates;
CREATE POLICY personnel_certificates_insert ON public.personnel_certificates
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.personnel_in_current_organization(personnel_id)
    AND (public.has_module_permission('personnel', 'add')
         OR public.has_module_permission('personnel', 'edit')
         OR personnel_id = public.my_personnel_id())
  );

DROP POLICY IF EXISTS personnel_certificates_update ON public.personnel_certificates;
CREATE POLICY personnel_certificates_update ON public.personnel_certificates
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (public.has_module_permission('personnel', 'edit')
         OR (personnel_id = public.my_personnel_id() AND NOT verified))
  )
  WITH CHECK (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS personnel_certificates_delete ON public.personnel_certificates;
CREATE POLICY personnel_certificates_delete ON public.personnel_certificates
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (public.has_module_permission('personnel', 'delete')
         OR (personnel_id = public.my_personnel_id() AND NOT verified))
  );

-- Puantaj: personel kendi puantajını görür. Hücreyi boşaltmak (silmek)
-- puantaj düzeltmesidir; "düzenle" yetkisi yeter.
DROP POLICY IF EXISTS timesheet_entries_select ON public.timesheet_entries;
CREATE POLICY timesheet_entries_select ON public.timesheet_entries
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (public.has_module_permission('timesheets', 'view') OR personnel_id = public.my_personnel_id())
  );

DROP POLICY IF EXISTS timesheet_entries_insert ON public.timesheet_entries;
CREATE POLICY timesheet_entries_insert ON public.timesheet_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.has_module_permission('timesheets', 'add')
    AND public.personnel_in_current_organization(personnel_id)
    AND (store_id IS NULL OR public.store_in_current_organization(store_id))
  );

DROP POLICY IF EXISTS timesheet_entries_update ON public.timesheet_entries;
CREATE POLICY timesheet_entries_update ON public.timesheet_entries
  FOR UPDATE TO authenticated
  USING (organization_id = public.current_organization_id() AND public.has_module_permission('timesheets', 'edit'))
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (store_id IS NULL OR public.store_in_current_organization(store_id))
  );

DROP POLICY IF EXISTS timesheet_entries_delete ON public.timesheet_entries;
CREATE POLICY timesheet_entries_delete ON public.timesheet_entries
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (public.has_module_permission('timesheets', 'edit') OR public.has_module_permission('timesheets', 'delete'))
  );

REVOKE ALL ON public.personnel, public.personnel_private, public.personnel_certificates, public.timesheet_entries FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.personnel, public.personnel_private, public.personnel_certificates, public.timesheet_entries
  TO authenticated;

-- =====================================================================
-- 5. Belge dosyaları: özel "hr-files" bucket'ı
--    Yol: <firma>/<personel>/<belge>/<dosya>. Sağlık raporu (health_check)
--    dosyasını yalnızca özlük yetkilisi ve personelin kendisi açar.
-- =====================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('hr-files', 'hr-files', false, 20971520)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.hr_file_readable(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.personnel_certificates c
    WHERE c.organization_id = public.current_organization_id()
      AND c.organization_id::text = (storage.foldername(p_name))[1]
      AND c.personnel_id::text = (storage.foldername(p_name))[2]
      AND c.id::text = (storage.foldername(p_name))[3]
      AND (
        c.personnel_id = public.my_personnel_id()
        OR (public.has_module_permission('personnel', 'view')
            AND (c.type <> 'health_check' OR public.has_module_permission('personnelPrivate', 'view')))
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.hr_file_writable(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.personnel_certificates c
    WHERE c.organization_id = public.current_organization_id()
      AND c.organization_id::text = (storage.foldername(p_name))[1]
      AND c.personnel_id::text = (storage.foldername(p_name))[2]
      AND c.id::text = (storage.foldername(p_name))[3]
      AND (
        public.has_module_permission('personnel', 'edit')
        OR public.has_module_permission('personnel', 'add')
        OR (c.personnel_id = public.my_personnel_id() AND NOT c.verified)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.hr_file_readable(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hr_file_writable(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hr_file_readable(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hr_file_writable(text) TO authenticated;

DROP POLICY IF EXISTS hr_files_select ON storage.objects;
CREATE POLICY hr_files_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'hr-files' AND public.hr_file_readable(name));

DROP POLICY IF EXISTS hr_files_insert ON storage.objects;
CREATE POLICY hr_files_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'hr-files' AND public.hr_file_writable(name));

DROP POLICY IF EXISTS hr_files_delete ON storage.objects;
CREATE POLICY hr_files_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'hr-files'
    AND (public.hr_file_writable(name) OR public.has_module_permission('personnel', 'delete'))
  );

-- Panelden tanımlanmış geniş (permissive) storage politikaları olabilir; bunlar
-- hr-files'a erişim açmasın diye aynı kurallar RESTRICTIVE olarak da uygulanır.
DROP POLICY IF EXISTS hr_files_guard_select ON storage.objects;
CREATE POLICY hr_files_guard_select ON storage.objects
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (bucket_id <> 'hr-files' OR public.hr_file_readable(name));

DROP POLICY IF EXISTS hr_files_guard_insert ON storage.objects;
CREATE POLICY hr_files_guard_insert ON storage.objects
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (bucket_id <> 'hr-files' OR public.hr_file_writable(name));

DROP POLICY IF EXISTS hr_files_guard_update ON storage.objects;
CREATE POLICY hr_files_guard_update ON storage.objects
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (bucket_id <> 'hr-files' OR public.hr_file_writable(name))
  WITH CHECK (bucket_id <> 'hr-files' OR public.hr_file_writable(name));

DROP POLICY IF EXISTS hr_files_guard_delete ON storage.objects;
CREATE POLICY hr_files_guard_delete ON storage.objects
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    bucket_id <> 'hr-files'
    OR public.hr_file_writable(name)
    OR public.has_module_permission('personnel', 'delete')
  );

-- =====================================================================
-- 6. Listeler
-- =====================================================================
-- Belge geçerliliği: expired (süresi geçmiş), expiring (30 gün içinde bitiyor),
-- valid, permanent (süresiz)
DROP VIEW IF EXISTS public.personnel_certificates_list;
CREATE VIEW public.personnel_certificates_list
WITH (security_invoker = true) AS
SELECT
	c.*,
	p.full_name AS personnel_name,
	p.code AS personnel_code,
	p.employment_type,
	p.subcontractor_company,
	(p.end_date IS NULL OR p.end_date >= current_date) AS personnel_active,
	CASE
		WHEN c.expires_at IS NULL THEN 'permanent'
		WHEN c.expires_at < current_date THEN 'expired'
		WHEN c.expires_at <= current_date + 30 THEN 'expiring'
		ELSE 'valid'
	END AS validity
FROM public.personnel_certificates c
JOIN public.personnel p ON p.id = c.personnel_id;

-- Personel + görev yeri + belge özeti. Belge sayıları satırı görebilen
-- kullanıcının görebildiği belgelerden hesaplanır (security_invoker).
DROP VIEW IF EXISTS public.personnel_list;
CREATE VIEW public.personnel_list
WITH (security_invoker = true) AS
SELECT
	p.*,
	s.name AS store_name,
	CASE WHEN p.end_date IS NULL OR p.end_date >= current_date THEN 'active' ELSE 'left' END AS state,
	COALESCE(cs.expired_count, 0) AS expired_count,
	COALESCE(cs.expiring_count, 0) AS expiring_count,
	COALESCE(cs.pending_count, 0) AS pending_count,
	COALESCE(cs.total_count, 0) AS certificate_count,
	-- Listede filtrelenen en kötü belge durumu
	CASE
		WHEN COALESCE(cs.expired_count, 0) > 0 THEN 'expired'
		WHEN COALESCE(cs.expiring_count, 0) > 0 THEN 'expiring'
		WHEN COALESCE(cs.pending_count, 0) > 0 THEN 'pending'
		ELSE 'ok'
	END AS document_state
FROM public.personnel p
LEFT JOIN public.stores s ON s.id = p.store_id
LEFT JOIN LATERAL (
	SELECT
		count(*) FILTER (WHERE c.expires_at < current_date) AS expired_count,
		count(*) FILTER (WHERE c.expires_at >= current_date AND c.expires_at <= current_date + 30) AS expiring_count,
		count(*) FILTER (WHERE NOT c.verified) AS pending_count,
		count(*) AS total_count
	FROM public.personnel_certificates c
	WHERE c.personnel_id = p.id
) cs ON true;

REVOKE ALL ON public.personnel_list, public.personnel_certificates_list FROM anon;
GRANT SELECT ON public.personnel_list, public.personnel_certificates_list TO authenticated;

NOTIFY pgrst, 'reload schema';

-- İnsan Kaynakları (Faz 2): izin talepleri ve puantajda ay kapatma.
-- 20261027090000_hr.sql'den sonra uygulanır.
--
-- İzin akışı: personel (ya da İK) talep oluşturur → personelin yöneticisi
-- onaylar (personnel.manager_id; yönetici yoksa bu adım atlanır) → İK onaylar.
-- Son onayda izin günleri puantaja yazılır; iptal edilince o günler silinir.
-- Yeni modül "leaves" (İzinler): görüntüle = tüm talepler, ekle = başkası adına
-- talep, düzenle = İK onayı / ret / iptal, sil = kaydı silme.
--
-- Ay kapatma: kapatılan aya puantaj yazılamaz, değiştirilemez, silinemez.
-- Kapatma "puantaj düzenle", kilidi açma "puantaj sil" yetkisi ister.

-- =====================================================================
-- 1. Yetki matrisi: "leaves" modülü (fonksiyonun yeni hâli; yalnızca c_modules değişti)
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
  c_modules CONSTANT text[] := c_core || ARRAY['inventory', 'personnel', 'personnelPrivate', 'timesheets', 'leaves'];
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

-- =====================================================================
-- 2. Personel: onaylayan yönetici ve yıllık izin düzeltmesi
-- =====================================================================
ALTER TABLE public.personnel
  ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Önceki sistemden devreden ya da elle düzeltilen yıllık izin günü (+/-)
  ADD COLUMN IF NOT EXISTS leave_adjustment numeric(5, 1) NOT NULL DEFAULT 0;

-- Yönetici de aynı firmadan olmalı (kullanıcı bağlantısındaki kural)
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
  IF NEW.manager_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = NEW.manager_id AND organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Yönetici bu firmada değil' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS personnel_guard_user ON public.personnel;
CREATE TRIGGER personnel_guard_user
  BEFORE INSERT OR UPDATE OF user_id, manager_id, organization_id ON public.personnel
  FOR EACH ROW EXECUTE FUNCTION public.guard_personnel_user();

-- Oturumdaki kullanıcı bu personelin yöneticisi mi
CREATE OR REPLACE FUNCTION public.is_personnel_manager(p_personnel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.personnel
    WHERE id = p_personnel_id
      AND manager_id = auth.uid()
      AND organization_id = public.current_organization_id()
  );
$$;

REVOKE ALL ON FUNCTION public.is_personnel_manager(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_personnel_manager(uuid) TO authenticated;

-- Yönetici, ekibindeki personelin kartını da görür (izin onayı için)
DROP POLICY IF EXISTS personnel_select ON public.personnel;
CREATE POLICY personnel_select ON public.personnel
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (public.has_module_permission('personnel', 'view')
         OR public.has_module_permission('timesheets', 'view')
         OR public.has_module_permission('leaves', 'view')
         OR user_id = auth.uid()
         OR manager_id = auth.uid())
  );

-- =====================================================================
-- 3. Puantaj: ay kapatma ve izinden gelen günler
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.timesheet_locks (
  organization_id uuid NOT NULL DEFAULT public.current_organization_id()
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Ayın ilk günü
  month date NOT NULL CHECK (extract(day FROM month) = 1),
  locked_by uuid NOT NULL DEFAULT auth.uid(),
  locked_by_name text NOT NULL DEFAULT '',
  locked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, month)
);

CREATE OR REPLACE FUNCTION public.stamp_timesheet_lock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    NEW.organization_id := public.current_organization_id();
    NEW.locked_by := auth.uid();
    NEW.locked_by_name := COALESCE(public.current_profile_name(), '');
    NEW.locked_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS timesheet_locks_stamp ON public.timesheet_locks;
CREATE TRIGGER timesheet_locks_stamp
  BEFORE INSERT ON public.timesheet_locks
  FOR EACH ROW EXECUTE FUNCTION public.stamp_timesheet_lock();

ALTER TABLE public.timesheet_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS timesheet_locks_select ON public.timesheet_locks;
CREATE POLICY timesheet_locks_select ON public.timesheet_locks
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS timesheet_locks_insert ON public.timesheet_locks;
CREATE POLICY timesheet_locks_insert ON public.timesheet_locks
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_organization_id() AND public.has_module_permission('timesheets', 'edit'));

DROP POLICY IF EXISTS timesheet_locks_delete ON public.timesheet_locks;
CREATE POLICY timesheet_locks_delete ON public.timesheet_locks
  FOR DELETE TO authenticated
  USING (organization_id = public.current_organization_id() AND public.has_module_permission('timesheets', 'delete'));

REVOKE ALL ON public.timesheet_locks FROM anon;
GRANT SELECT, INSERT, DELETE ON public.timesheet_locks TO authenticated;

-- Kapatılmış aya yazma, değiştirme ya da silme yok (izin onayı dahil)
CREATE OR REPLACE FUNCTION public.guard_timesheet_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_date date;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_org := OLD.organization_id;
    v_date := OLD.work_date;
  ELSE
    v_org := NEW.organization_id;
    v_date := NEW.work_date;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.timesheet_locks
    WHERE organization_id = v_org AND month = date_trunc('month', v_date)::date
  ) THEN
    RAISE EXCEPTION '% ayının puantajı kapatılmış', to_char(v_date, 'MM.YYYY')
      USING ERRCODE = 'P0001', HINT = 'timesheet_locked';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS timesheet_entries_lock_guard ON public.timesheet_entries;
CREATE TRIGGER timesheet_entries_lock_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.timesheet_entries
  FOR EACH ROW EXECUTE FUNCTION public.guard_timesheet_lock();

-- =====================================================================
-- 4. İzin talepleri
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_organization_id()
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  personnel_id uuid NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('annual', 'excused', 'sick', 'unpaid')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  -- İzinden düşülecek iş günü (hafta tatili ve resmî tatiller hariç); İK düzeltebilir
  day_count numeric(5, 1) NOT NULL CHECK (day_count > 0),
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending_hr'
    CHECK (status IN ('pending_manager', 'pending_hr', 'approved', 'rejected', 'cancelled')),
  manager_decided_by_name text,
  manager_decided_at timestamptz,
  manager_note text NOT NULL DEFAULT '',
  hr_decided_by_name text,
  hr_decided_at timestamptz,
  hr_note text NOT NULL DEFAULT '',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_by_name text,
  updated_at timestamptz,
  CHECK (end_date >= start_date),
  CHECK (end_date - start_date < 366)
);

CREATE INDEX IF NOT EXISTS leave_requests_personnel_idx ON public.leave_requests (personnel_id, start_date);
CREATE INDEX IF NOT EXISTS leave_requests_org_status_idx ON public.leave_requests (organization_id, status, start_date);

-- İzinden yazılan puantaj günleri; talep silinince günler de silinir
ALTER TABLE public.timesheet_entries
  ADD COLUMN IF NOT EXISTS leave_request_id uuid REFERENCES public.leave_requests(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS timesheet_entries_leave_idx
  ON public.timesheet_entries (leave_request_id) WHERE leave_request_id IS NOT NULL;

DROP TRIGGER IF EXISTS leave_requests_stamp ON public.leave_requests;
CREATE TRIGGER leave_requests_stamp
  BEFORE INSERT OR UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.stamp_inventory_row();

-- Durum ve onay alanları yalnızca karar fonksiyonlarından değişir. Yeni talep,
-- personelin (talep edenden farklı) bir yöneticisi varsa önce ona gider.
CREATE OR REPLACE FUNCTION public.guard_leave_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_manager uuid;
BEGIN
  IF current_setting('app.leave_decision', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT manager_id INTO v_manager FROM public.personnel WHERE id = NEW.personnel_id;
    NEW.status := CASE
      WHEN v_manager IS NOT NULL AND v_manager IS DISTINCT FROM auth.uid() THEN 'pending_manager'
      ELSE 'pending_hr'
    END;
    NEW.manager_decided_by_name := NULL;
    NEW.manager_decided_at := NULL;
    NEW.manager_note := '';
    NEW.hr_decided_by_name := NULL;
    NEW.hr_decided_at := NULL;
    NEW.hr_note := '';
  ELSE
    NEW.personnel_id := OLD.personnel_id;
    NEW.status := OLD.status;
    NEW.manager_decided_by_name := OLD.manager_decided_by_name;
    NEW.manager_decided_at := OLD.manager_decided_at;
    NEW.manager_note := OLD.manager_note;
    NEW.hr_decided_by_name := OLD.hr_decided_by_name;
    NEW.hr_decided_at := OLD.hr_decided_at;
    NEW.hr_note := OLD.hr_note;
    -- Onaylanmış iznin tarihleri değişirse puantaj ile çelişir
    IF OLD.status = 'approved' AND (NEW.start_date <> OLD.start_date OR NEW.end_date <> OLD.end_date OR NEW.type <> OLD.type) THEN
      RAISE EXCEPTION 'Onaylanmış iznin tarihi ya da türü değiştirilemez; iptal edip yeniden talep oluşturun'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leave_requests_guard ON public.leave_requests;
CREATE TRIGGER leave_requests_guard
  BEFORE INSERT OR UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_leave_request();

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leave_requests_select ON public.leave_requests;
CREATE POLICY leave_requests_select ON public.leave_requests
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (public.has_module_permission('leaves', 'view')
         OR personnel_id = public.my_personnel_id()
         OR public.is_personnel_manager(personnel_id))
  );

-- Personel kendi adına, İK ("ekle") herkes adına talep oluşturur
DROP POLICY IF EXISTS leave_requests_insert ON public.leave_requests;
CREATE POLICY leave_requests_insert ON public.leave_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.personnel_in_current_organization(personnel_id)
    AND (public.has_module_permission('leaves', 'add') OR personnel_id = public.my_personnel_id())
  );

-- Doğrudan düzenleme (gün sayısı, açıklama düzeltmesi) yalnızca İK; durum
-- tetikleyiciyle korunur, karar ve iptal aşağıdaki fonksiyonlardan geçer
DROP POLICY IF EXISTS leave_requests_update ON public.leave_requests;
CREATE POLICY leave_requests_update ON public.leave_requests
  FOR UPDATE TO authenticated
  USING (organization_id = public.current_organization_id() AND public.has_module_permission('leaves', 'edit'))
  WITH CHECK (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS leave_requests_delete ON public.leave_requests;
CREATE POLICY leave_requests_delete ON public.leave_requests
  FOR DELETE TO authenticated
  USING (organization_id = public.current_organization_id() AND public.has_module_permission('leaves', 'delete'));

REVOKE ALL ON public.leave_requests FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;

-- Sabit tarihli resmî tatiller (dini bayramlar her yıl değiştiği için dahil değil)
CREATE OR REPLACE FUNCTION public.hr_is_fixed_holiday(p_date date)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (extract(month FROM p_date)::int, extract(day FROM p_date)::int)
    IN ((1, 1), (4, 23), (5, 1), (5, 19), (7, 15), (8, 30), (10, 29));
$$;

-- Onaylanan izni puantaja yazar: Pazar → hafta tatili, sabit resmî tatil →
-- resmî tatil (boşsa), Cumartesi çalışılmayan firmada Cumartesi atlanır,
-- diğer günler izin türü. Mevcut günlük kayıt izinle değiştirilir.
CREATE OR REPLACE FUNCTION public.apply_leave_to_timesheet(p_request public.leave_requests)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text := CASE p_request.type
    WHEN 'annual' THEN 'annual_leave'
    WHEN 'excused' THEN 'excused_leave'
    WHEN 'sick' THEN 'sick_leave'
    ELSE 'unpaid_leave'
  END;
  v_saturday_working boolean;
  v_name text := COALESCE(public.current_profile_name(), '');
  v_day date;
BEGIN
  SELECT COALESCE((settings -> 'hr' ->> 'saturdayWorking')::boolean, true)
    INTO v_saturday_working
    FROM public.organizations WHERE id = p_request.organization_id;

  FOR v_day IN SELECT generate_series(p_request.start_date, p_request.end_date, interval '1 day')::date LOOP
    IF extract(isodow FROM v_day) = 7 OR public.hr_is_fixed_holiday(v_day) THEN
      INSERT INTO public.timesheet_entries
        (organization_id, personnel_id, work_date, status, created_by, created_by_name)
      VALUES (
        p_request.organization_id, p_request.personnel_id, v_day,
        CASE WHEN extract(isodow FROM v_day) = 7 THEN 'weekly_rest' ELSE 'public_holiday' END,
        auth.uid(), v_name
      )
      ON CONFLICT (personnel_id, work_date) DO NOTHING;
    ELSIF extract(isodow FROM v_day) = 6 AND NOT v_saturday_working THEN
      CONTINUE;
    ELSE
      INSERT INTO public.timesheet_entries
        (organization_id, personnel_id, work_date, status, hours, overtime_hours, leave_request_id, created_by, created_by_name)
      VALUES (p_request.organization_id, p_request.personnel_id, v_day, v_status, 0, 0, p_request.id, auth.uid(), v_name)
      ON CONFLICT (personnel_id, work_date) DO UPDATE
        SET status = EXCLUDED.status,
            hours = 0,
            overtime_hours = 0,
            leave_request_id = EXCLUDED.leave_request_id,
            updated_by = auth.uid(),
            updated_by_name = v_name,
            updated_at = now();
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_leave_to_timesheet(public.leave_requests) FROM PUBLIC, authenticated;

-- Onay / ret. Yönetici ilk adımı, İK ("düzenle") son adımı onaylar; İK
-- yönetici adımında da doğrudan son onayı verebilir. Kimse kendi iznini onaylamaz
-- (kurucu hariç).
CREATE OR REPLACE FUNCTION public.decide_leave_request(p_id uuid, p_approve boolean, p_note text DEFAULT '')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.leave_requests;
  v_is_hr boolean := public.has_module_permission('leaves', 'edit');
  v_is_manager boolean;
  v_name text := COALESCE(public.current_profile_name(), '');
  v_note text := btrim(COALESCE(p_note, ''));
BEGIN
  SELECT * INTO v_request FROM public.leave_requests
  WHERE id = p_id AND organization_id = public.current_organization_id()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'İzin talebi bulunamadı' USING ERRCODE = 'P0002';
  END IF;
  IF v_request.personnel_id = public.my_personnel_id() AND public.current_app_role() <> 'admin' THEN
    RAISE EXCEPTION 'Kendi izin talebinizi onaylayamazsınız' USING ERRCODE = '42501';
  END IF;
  v_is_manager := public.is_personnel_manager(v_request.personnel_id);

  PERFORM set_config('app.leave_decision', 'on', true);

  IF v_request.status = 'pending_manager' AND (v_is_manager OR v_is_hr) THEN
    IF NOT p_approve THEN
      IF v_is_manager THEN
        UPDATE public.leave_requests
          SET status = 'rejected', manager_decided_by_name = v_name, manager_decided_at = now(), manager_note = v_note
          WHERE id = p_id;
      ELSE
        UPDATE public.leave_requests
          SET status = 'rejected', hr_decided_by_name = v_name, hr_decided_at = now(), hr_note = v_note
          WHERE id = p_id;
      END IF;
    ELSIF v_is_hr THEN
      -- İK yönetici adımını da geçer
      UPDATE public.leave_requests
        SET status = 'approved', hr_decided_by_name = v_name, hr_decided_at = now(), hr_note = v_note
        WHERE id = p_id
        RETURNING * INTO v_request;
      PERFORM public.apply_leave_to_timesheet(v_request);
    ELSE
      UPDATE public.leave_requests
        SET status = 'pending_hr', manager_decided_by_name = v_name, manager_decided_at = now(), manager_note = v_note
        WHERE id = p_id;
    END IF;
  ELSIF v_request.status = 'pending_hr' AND v_is_hr THEN
    IF p_approve THEN
      UPDATE public.leave_requests
        SET status = 'approved', hr_decided_by_name = v_name, hr_decided_at = now(), hr_note = v_note
        WHERE id = p_id
        RETURNING * INTO v_request;
      PERFORM public.apply_leave_to_timesheet(v_request);
    ELSE
      UPDATE public.leave_requests
        SET status = 'rejected', hr_decided_by_name = v_name, hr_decided_at = now(), hr_note = v_note
        WHERE id = p_id;
    END IF;
  ELSIF v_request.status IN ('pending_manager', 'pending_hr') THEN
    RAISE EXCEPTION 'Bu talebi onaylama yetkiniz yok' USING ERRCODE = '42501';
  ELSE
    RAISE EXCEPTION 'Bu talep zaten sonuçlanmış' USING ERRCODE = '23514';
  END IF;

  PERFORM set_config('app.leave_decision', 'off', true);
  SELECT status INTO v_request.status FROM public.leave_requests WHERE id = p_id;
  RETURN v_request.status;
END;
$$;

-- İptal: personel bekleyen kendi talebini; İK onaylanmış talebi de iptal eder
-- (puantaja yazılan günler silinir; ay kapatılmışsa iptal edilemez)
CREATE OR REPLACE FUNCTION public.cancel_leave_request(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.leave_requests;
  v_is_hr boolean := public.has_module_permission('leaves', 'edit');
BEGIN
  SELECT * INTO v_request FROM public.leave_requests
  WHERE id = p_id AND organization_id = public.current_organization_id()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'İzin talebi bulunamadı' USING ERRCODE = 'P0002';
  END IF;
  IF v_request.status IN ('rejected', 'cancelled') THEN
    RAISE EXCEPTION 'Bu talep zaten sonuçlanmış' USING ERRCODE = '23514';
  END IF;
  IF NOT (v_is_hr OR (v_request.personnel_id = public.my_personnel_id()
                      AND v_request.status IN ('pending_manager', 'pending_hr'))) THEN
    RAISE EXCEPTION 'Bu talebi iptal etme yetkiniz yok' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.timesheet_entries WHERE leave_request_id = p_id;

  PERFORM set_config('app.leave_decision', 'on', true);
  UPDATE public.leave_requests SET status = 'cancelled' WHERE id = p_id;
  PERFORM set_config('app.leave_decision', 'off', true);
END;
$$;

REVOKE ALL ON FUNCTION public.decide_leave_request(uuid, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_leave_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decide_leave_request(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_leave_request(uuid) TO authenticated;

-- =====================================================================
-- 5. Listeler
-- =====================================================================
DROP VIEW IF EXISTS public.leave_requests_list;
CREATE VIEW public.leave_requests_list
WITH (security_invoker = true) AS
SELECT
	r.*,
	p.full_name AS personnel_name,
	p.code AS personnel_code,
	p.employment_type,
	p.user_id AS personnel_user_id,
	p.manager_id
FROM public.leave_requests r
JOIN public.personnel p ON p.id = r.personnel_id;

REVOKE ALL ON public.leave_requests_list FROM anon;
GRANT SELECT ON public.leave_requests_list TO authenticated;

-- personnel_list yeni sütunları (manager_id, leave_adjustment) içersin diye yeniden kurulur
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

REVOKE ALL ON public.personnel_list FROM anon;
GRANT SELECT ON public.personnel_list TO authenticated;

NOTIFY pgrst, 'reload schema';

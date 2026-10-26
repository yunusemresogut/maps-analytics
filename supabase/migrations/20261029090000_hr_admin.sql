-- İnsan Kaynakları (Faz 4): idari işler.
-- 20261028090000_hr_leaves.sql'den sonra uygulanır.
--
--  * Araç takibi: envanterdeki araçlara sigorta, kasko, muayene bitişi ve kilometre
--  * Duyurular: firmaya ya da seçili rollere duyuru, "okudum" onayı (tebliğ kaydı)
--  * Talep kutusu: avans, belge, ekipman, eğitim ve diğer personel talepleri
--
-- Yeni modüller (varsayılan olarak yalnızca admin'de açıktır):
--   announcements  görüntüle = tüm duyurular ve okuma durumu, ekle / düzenle / sil = yayınlama
--   hrRequests     görüntüle = tüm talepler, ekle = başkası adına talep,
--                  düzenle = onay / ret / tamamlama, sil = kaydı silme

-- =====================================================================
-- 1. Yetki matrisi (fonksiyonun yeni hâli; yalnızca c_modules değişti)
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
  c_modules CONSTANT text[] := c_core || ARRAY['inventory', 'personnel', 'personnelPrivate', 'timesheets', 'leaves',
                                               'announcements', 'hrRequests'];
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
-- 2. Araç takibi: envanterdeki araçların belge bitişleri
-- =====================================================================
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS insurance_expires date,   -- zorunlu trafik sigortası
  ADD COLUMN IF NOT EXISTS casco_expires date,       -- kasko
  ADD COLUMN IF NOT EXISTS inspection_expires date,  -- araç muayenesi
  ADD COLUMN IF NOT EXISTS odometer_km integer CHECK (odometer_km IS NULL OR odometer_km >= 0);

-- Liste view'ı yeni sütunları ve en yakın belge bitişini içersin diye yeniden kurulur
DROP VIEW IF EXISTS public.inventory_items_list;
CREATE VIEW public.inventory_items_list
WITH (security_invoker = true) AS
SELECT
	i.*,
	a.id AS assignment_id,
	a.assignee_id,
	a.assignee_name,
	a.assigned_at,
	a.expected_return,
	a.notes AS assignment_notes,
	a.store_id AS assignment_store_id,
	s.name AS assignment_store_name,
	CASE
		WHEN i.status = 'retired' THEN 'retired'
		WHEN a.id IS NOT NULL THEN 'assigned'
		WHEN i.status = 'maintenance' THEN 'maintenance'
		ELSE 'available'
	END AS state,
	-- Aracın en yakın belge bitişi (sigorta, kasko, muayene); hurda araçta yok
	CASE WHEN i.category = 'vehicle' AND i.status <> 'retired'
		THEN LEAST(i.insurance_expires, i.casco_expires, i.inspection_expires)
	END AS next_vehicle_expiry
FROM public.inventory_items i
LEFT JOIN public.inventory_assignments a ON a.item_id = i.id AND a.returned_at IS NULL
LEFT JOIN public.stores s ON s.id = a.store_id;

REVOKE ALL ON public.inventory_items_list FROM anon;
GRANT SELECT ON public.inventory_items_list TO authenticated;

-- =====================================================================
-- 3. Duyurular
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_organization_id()
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (btrim(title) <> ''),
  body text NOT NULL DEFAULT '',
  -- Boş dizi: herkes; aksi hâlde yalnızca bu rollerdeki kullanıcılar
  audience_roles text[] NOT NULL DEFAULT '{}',
  pinned boolean NOT NULL DEFAULT false,
  -- "Okudum, anladım" onayı istenir (İSG talimatı, yönetmelik tebliği vb.)
  requires_ack boolean NOT NULL DEFAULT false,
  publish_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_by_name text,
  updated_at timestamptz,
  CHECK (expires_at IS NULL OR expires_at > publish_at)
);

CREATE INDEX IF NOT EXISTS announcements_org_publish_idx ON public.announcements (organization_id, publish_at DESC);

DROP TRIGGER IF EXISTS announcements_stamp ON public.announcements;
CREATE TRIGGER announcements_stamp
  BEFORE INSERT OR UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.stamp_inventory_row();

-- Okuma kaydı değiştirilemez: zaman ve ad sunucudan yazılır
CREATE TABLE IF NOT EXISTS public.announcement_reads (
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name text NOT NULL DEFAULT '',
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

CREATE OR REPLACE FUNCTION public.stamp_announcement_read()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    NEW.user_id := auth.uid();
    NEW.user_name := COALESCE(public.current_profile_name(), '');
    NEW.read_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS announcement_reads_stamp ON public.announcement_reads;
CREATE TRIGGER announcement_reads_stamp
  BEFORE INSERT ON public.announcement_reads
  FOR EACH ROW EXECUTE FUNCTION public.stamp_announcement_read();

-- Duyuru oturumdaki kullanıcıya yayında mı (hedef rol ve yayın aralığı)
CREATE OR REPLACE FUNCTION public.announcement_visible_to_me(p_announcement_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.announcements a
    WHERE a.id = p_announcement_id
      AND a.organization_id = public.current_organization_id()
      AND a.publish_at <= now()
      AND (a.expires_at IS NULL OR a.expires_at > now())
      AND (cardinality(a.audience_roles) = 0 OR public.current_app_role() = ANY (a.audience_roles))
  );
$$;

REVOKE ALL ON FUNCTION public.announcement_visible_to_me(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.announcement_visible_to_me(uuid) TO authenticated;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

-- Yetkili tümünü (taslak / süresi geçmiş dahil), diğerleri kendine yayında olanı görür
DROP POLICY IF EXISTS announcements_select ON public.announcements;
CREATE POLICY announcements_select ON public.announcements
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (public.has_module_permission('announcements', 'view') OR public.announcement_visible_to_me(id))
  );

DROP POLICY IF EXISTS announcements_insert ON public.announcements;
CREATE POLICY announcements_insert ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_organization_id() AND public.has_module_permission('announcements', 'add'));

DROP POLICY IF EXISTS announcements_update ON public.announcements;
CREATE POLICY announcements_update ON public.announcements
  FOR UPDATE TO authenticated
  USING (organization_id = public.current_organization_id() AND public.has_module_permission('announcements', 'edit'))
  WITH CHECK (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS announcements_delete ON public.announcements;
CREATE POLICY announcements_delete ON public.announcements
  FOR DELETE TO authenticated
  USING (organization_id = public.current_organization_id() AND public.has_module_permission('announcements', 'delete'));

-- Okuma: herkes kendi kaydını, yetkili firmadaki tüm kayıtları görür
DROP POLICY IF EXISTS announcement_reads_select ON public.announcement_reads;
CREATE POLICY announcement_reads_select ON public.announcement_reads
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (public.has_module_permission('announcements', 'view')
        AND EXISTS (SELECT 1 FROM public.announcements a
                    WHERE a.id = announcement_id AND a.organization_id = public.current_organization_id()))
  );

DROP POLICY IF EXISTS announcement_reads_insert ON public.announcement_reads;
CREATE POLICY announcement_reads_insert ON public.announcement_reads
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.announcement_visible_to_me(announcement_id));

REVOKE ALL ON public.announcements, public.announcement_reads FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT SELECT, INSERT ON public.announcement_reads TO authenticated;

-- =====================================================================
-- 4. Talep kutusu
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.personnel_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_organization_id()
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  personnel_id uuid NOT NULL REFERENCES public.personnel(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('advance', 'document', 'equipment', 'training', 'other')),
  title text NOT NULL CHECK (btrim(title) <> ''),
  description text NOT NULL DEFAULT '',
  -- Avans tutarı (TL); diğer taleplerde boş
  amount numeric(12, 2) CHECK (amount IS NULL OR amount > 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
  decision_note text NOT NULL DEFAULT '',
  decided_by_name text,
  decided_at timestamptz,
  completed_by_name text,
  completed_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_by_name text,
  updated_at timestamptz,
  CHECK (type <> 'advance' OR amount IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS personnel_requests_org_status_idx ON public.personnel_requests (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS personnel_requests_personnel_idx ON public.personnel_requests (personnel_id, created_at DESC);

DROP TRIGGER IF EXISTS personnel_requests_stamp ON public.personnel_requests;
CREATE TRIGGER personnel_requests_stamp
  BEFORE INSERT OR UPDATE ON public.personnel_requests
  FOR EACH ROW EXECUTE FUNCTION public.stamp_inventory_row();

-- Durum ve karar alanları yalnızca set_personnel_request_status'tan değişir
CREATE OR REPLACE FUNCTION public.guard_personnel_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.request_decision', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.decision_note := '';
    NEW.decided_by_name := NULL;
    NEW.decided_at := NULL;
    NEW.completed_by_name := NULL;
    NEW.completed_at := NULL;
  ELSE
    NEW.personnel_id := OLD.personnel_id;
    NEW.status := OLD.status;
    NEW.decision_note := OLD.decision_note;
    NEW.decided_by_name := OLD.decided_by_name;
    NEW.decided_at := OLD.decided_at;
    NEW.completed_by_name := OLD.completed_by_name;
    NEW.completed_at := OLD.completed_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS personnel_requests_guard ON public.personnel_requests;
CREATE TRIGGER personnel_requests_guard
  BEFORE INSERT OR UPDATE ON public.personnel_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_personnel_request();

ALTER TABLE public.personnel_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS personnel_requests_select ON public.personnel_requests;
CREATE POLICY personnel_requests_select ON public.personnel_requests
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (public.has_module_permission('hrRequests', 'view') OR personnel_id = public.my_personnel_id())
  );

DROP POLICY IF EXISTS personnel_requests_insert ON public.personnel_requests;
CREATE POLICY personnel_requests_insert ON public.personnel_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.personnel_in_current_organization(personnel_id)
    AND (public.has_module_permission('hrRequests', 'add') OR personnel_id = public.my_personnel_id())
  );

-- Doğrudan düzenleme (başlık, açıklama, tutar düzeltmesi) yalnızca yetkili
DROP POLICY IF EXISTS personnel_requests_update ON public.personnel_requests;
CREATE POLICY personnel_requests_update ON public.personnel_requests
  FOR UPDATE TO authenticated
  USING (organization_id = public.current_organization_id() AND public.has_module_permission('hrRequests', 'edit'))
  WITH CHECK (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS personnel_requests_delete ON public.personnel_requests;
CREATE POLICY personnel_requests_delete ON public.personnel_requests
  FOR DELETE TO authenticated
  USING (organization_id = public.current_organization_id() AND public.has_module_permission('hrRequests', 'delete'));

REVOKE ALL ON public.personnel_requests FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.personnel_requests TO authenticated;

-- Durum geçişleri: bekliyor → onaylandı / reddedildi; onaylandı → tamamlandı
-- (avans ödendi, belge verildi). Personel bekleyen kendi talebini iptal eder.
-- Kimse kendi talebini sonuçlandıramaz (kurucu hariç).
CREATE OR REPLACE FUNCTION public.set_personnel_request_status(p_id uuid, p_status text, p_note text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.personnel_requests;
  v_is_hr boolean := public.has_module_permission('hrRequests', 'edit');
  v_own boolean;
  v_name text := COALESCE(public.current_profile_name(), '');
  v_note text := btrim(COALESCE(p_note, ''));
BEGIN
  SELECT * INTO v_request FROM public.personnel_requests
  WHERE id = p_id AND organization_id = public.current_organization_id()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Talep bulunamadı' USING ERRCODE = 'P0002';
  END IF;
  v_own := v_request.personnel_id = public.my_personnel_id();

  IF p_status = 'cancelled' THEN
    IF v_request.status <> 'pending' THEN
      RAISE EXCEPTION 'Yalnızca bekleyen talep iptal edilebilir' USING ERRCODE = '23514';
    END IF;
    IF NOT (v_own OR v_is_hr) THEN
      RAISE EXCEPTION 'Bu talebi iptal etme yetkiniz yok' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NOT v_is_hr THEN
      RAISE EXCEPTION 'Bu talebi sonuçlandırma yetkiniz yok' USING ERRCODE = '42501';
    END IF;
    IF v_own AND public.current_app_role() <> 'admin' THEN
      RAISE EXCEPTION 'Kendi talebinizi sonuçlandıramazsınız' USING ERRCODE = '42501';
    END IF;
    IF NOT ((v_request.status = 'pending' AND p_status IN ('approved', 'rejected'))
            OR (v_request.status = 'approved' AND p_status = 'completed')) THEN
      RAISE EXCEPTION 'Bu durum değişikliği yapılamaz' USING ERRCODE = '23514';
    END IF;
    IF p_status = 'rejected' AND v_note = '' THEN
      RAISE EXCEPTION 'Ret gerekçesi zorunludur' USING ERRCODE = '23514';
    END IF;
  END IF;

  PERFORM set_config('app.request_decision', 'on', true);
  IF p_status = 'completed' THEN
    UPDATE public.personnel_requests
      SET status = 'completed', completed_by_name = v_name, completed_at = now(),
          decision_note = CASE WHEN v_note = '' THEN decision_note ELSE v_note END
      WHERE id = p_id;
  ELSIF p_status = 'cancelled' THEN
    UPDATE public.personnel_requests SET status = 'cancelled' WHERE id = p_id;
  ELSE
    UPDATE public.personnel_requests
      SET status = p_status, decision_note = v_note, decided_by_name = v_name, decided_at = now()
      WHERE id = p_id;
  END IF;
  PERFORM set_config('app.request_decision', 'off', true);
END;
$$;

REVOKE ALL ON FUNCTION public.set_personnel_request_status(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_personnel_request_status(uuid, text, text) TO authenticated;

DROP VIEW IF EXISTS public.personnel_requests_list;
CREATE VIEW public.personnel_requests_list
WITH (security_invoker = true) AS
SELECT
	r.*,
	p.full_name AS personnel_name,
	p.code AS personnel_code,
	p.user_id AS personnel_user_id
FROM public.personnel_requests r
JOIN public.personnel p ON p.id = r.personnel_id;

REVOKE ALL ON public.personnel_requests_list FROM anon;
GRANT SELECT ON public.personnel_requests_list TO authenticated;

NOTIFY pgrst, 'reload schema';

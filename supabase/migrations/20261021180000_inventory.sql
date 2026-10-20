-- Envanter: ekipman ve araçlar, kişilere zimmet ve teslim alma.
-- Yetki yeni "inventory" modülüdür (görüntüle/ekle/düzenle/sil): varsayılan
-- olarak yalnızca admin'de açıktır, admin istediği rol ya da kişiye verir.
-- Zimmetleme ve teslim alma "düzenle" yetkisi ister. Yetkisi olmayan kullanıcı
-- yalnızca kendi zimmetindeki eşyaları ve zimmet kayıtlarını görür.

-- =====================================================================
-- 1. Yetki matrisi: yeni modül. Kayıtlı matrislerde "inventory" anahtarı
--    yoktur; matrisin geçerliliği eski 8 modüle bakar, eksik modül = yetki yok.
--    (20261019170000_module_permissions.sql içindeki fonksiyonun yeni hâli)
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
  c_modules CONSTANT text[] := c_core || ARRAY['inventory'];
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
-- app_builtin_crud "inventory" için admin dışında hiçbir role yetki vermez.

-- =====================================================================
-- 2. Tablolar
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_organization_id()
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  code text NOT NULL DEFAULT '',
  name text NOT NULL CHECK (btrim(name) <> ''),
  category text NOT NULL DEFAULT 'equipment'
    CHECK (category IN ('equipment', 'vehicle', 'hand_tool', 'electronics', 'safety', 'other')),
  brand text NOT NULL DEFAULT '',
  serial_no text NOT NULL DEFAULT '',
  -- Zimmet dışı durum; zimmet açık zimmet kaydından gelir
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired')),
  purchase_date date,
  notes text NOT NULL DEFAULT '',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_by_name text,
  updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS inventory_items_org_idx ON public.inventory_items (organization_id, name);

-- Zimmet: kişi uygulamada kullanıcıysa assignee_id dolu, değilse yalnızca ad
-- (ör. taşeron ustası). Teslim alınınca returned_at dolar.
CREATE TABLE IF NOT EXISTS public.inventory_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_organization_id()
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assignee_name text NOT NULL CHECK (btrim(assignee_name) <> ''),
  store_id text REFERENCES public.stores(id) ON DELETE SET NULL,
  assigned_at date NOT NULL DEFAULT current_date,
  expected_return date,
  notes text NOT NULL DEFAULT '',
  returned_at date,
  return_condition text CHECK (return_condition IN ('good', 'damaged', 'lost')),
  return_notes text NOT NULL DEFAULT '',
  returned_by_name text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_by_name text,
  updated_at timestamptz,
  CHECK (returned_at IS NULL OR returned_at >= assigned_at),
  CHECK ((returned_at IS NULL) = (return_condition IS NULL))
);

-- Bir eşya aynı anda yalnızca bir kişide olabilir
CREATE UNIQUE INDEX IF NOT EXISTS inventory_assignments_open_idx
  ON public.inventory_assignments (item_id) WHERE returned_at IS NULL;
CREATE INDEX IF NOT EXISTS inventory_assignments_item_idx ON public.inventory_assignments (item_id, assigned_at DESC);
CREATE INDEX IF NOT EXISTS inventory_assignments_assignee_idx ON public.inventory_assignments (assignee_id) WHERE returned_at IS NULL;

-- Firma, oluşturan ve güncelleyen sunucudan yazılır
CREATE OR REPLACE FUNCTION public.stamp_inventory_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user <> 'authenticated' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.organization_id := public.current_organization_id();
    NEW.created_by := auth.uid();
    NEW.created_by_name := COALESCE(public.current_profile_name(), '');
    NEW.created_at := now();
    NEW.updated_by := NULL;
    NEW.updated_by_name := NULL;
    NEW.updated_at := NULL;
  ELSE
    NEW.organization_id := OLD.organization_id;
    NEW.created_by := OLD.created_by;
    NEW.created_by_name := OLD.created_by_name;
    NEW.created_at := OLD.created_at;
    NEW.updated_by := auth.uid();
    NEW.updated_by_name := public.current_profile_name();
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

-- Zimmet kaydı başka eşyaya taşınamaz; teslim alanın adı sunucudan
CREATE OR REPLACE FUNCTION public.stamp_inventory_assignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.item_id := OLD.item_id;
  END IF;
  IF NEW.returned_at IS NULL THEN
    NEW.returned_by_name := NULL;
  ELSIF TG_OP = 'INSERT' OR OLD.returned_at IS NULL THEN
    NEW.returned_by_name := public.current_profile_name();
  ELSE
    NEW.returned_by_name := OLD.returned_by_name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inventory_items_stamp ON public.inventory_items;
CREATE TRIGGER inventory_items_stamp
  BEFORE INSERT OR UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.stamp_inventory_row();

DROP TRIGGER IF EXISTS inventory_assignments_stamp ON public.inventory_assignments;
CREATE TRIGGER inventory_assignments_stamp
  BEFORE INSERT OR UPDATE ON public.inventory_assignments
  FOR EACH ROW EXECUTE FUNCTION public.stamp_inventory_row();

DROP TRIGGER IF EXISTS inventory_assignments_stamp_return ON public.inventory_assignments;
CREATE TRIGGER inventory_assignments_stamp_return
  BEFORE INSERT OR UPDATE ON public.inventory_assignments
  FOR EACH ROW EXECUTE FUNCTION public.stamp_inventory_assignment();

-- =====================================================================
-- 3. Erişim
-- =====================================================================
-- Eşya oturumdaki kullanıcıya zimmetli mi (yetkisi olmayan kendi zimmetini görür)
CREATE OR REPLACE FUNCTION public.inventory_item_assigned_to_me(p_item_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.inventory_assignments
    WHERE item_id = p_item_id AND assignee_id = auth.uid() AND returned_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.inventory_item_assigned_to_me(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inventory_item_assigned_to_me(uuid) TO authenticated;

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_items_select ON public.inventory_items;
CREATE POLICY inventory_items_select ON public.inventory_items
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (public.has_module_permission('inventory', 'view') OR public.inventory_item_assigned_to_me(id))
  );

DROP POLICY IF EXISTS inventory_items_insert ON public.inventory_items;
CREATE POLICY inventory_items_insert ON public.inventory_items
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_organization_id() AND public.has_module_permission('inventory', 'add'));

DROP POLICY IF EXISTS inventory_items_update ON public.inventory_items;
CREATE POLICY inventory_items_update ON public.inventory_items
  FOR UPDATE TO authenticated
  USING (organization_id = public.current_organization_id() AND public.has_module_permission('inventory', 'edit'))
  WITH CHECK (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS inventory_items_delete ON public.inventory_items;
CREATE POLICY inventory_items_delete ON public.inventory_items
  FOR DELETE TO authenticated
  USING (organization_id = public.current_organization_id() AND public.has_module_permission('inventory', 'delete'));

DROP POLICY IF EXISTS inventory_assignments_select ON public.inventory_assignments;
CREATE POLICY inventory_assignments_select ON public.inventory_assignments
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (public.has_module_permission('inventory', 'view') OR assignee_id = auth.uid())
  );

-- Zimmetleme, teslim alma ve zimmet düzeltme "düzenle" yetkisidir
DROP POLICY IF EXISTS inventory_assignments_insert ON public.inventory_assignments;
CREATE POLICY inventory_assignments_insert ON public.inventory_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.has_module_permission('inventory', 'edit')
    AND EXISTS (SELECT 1 FROM public.inventory_items i
                WHERE i.id = item_id AND i.organization_id = public.current_organization_id())
    AND (store_id IS NULL OR public.store_in_current_organization(store_id))
  );

DROP POLICY IF EXISTS inventory_assignments_update ON public.inventory_assignments;
CREATE POLICY inventory_assignments_update ON public.inventory_assignments
  FOR UPDATE TO authenticated
  USING (organization_id = public.current_organization_id() AND public.has_module_permission('inventory', 'edit'))
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (store_id IS NULL OR public.store_in_current_organization(store_id))
  );

DROP POLICY IF EXISTS inventory_assignments_delete ON public.inventory_assignments;
CREATE POLICY inventory_assignments_delete ON public.inventory_assignments
  FOR DELETE TO authenticated
  USING (organization_id = public.current_organization_id() AND public.has_module_permission('inventory', 'delete'));

REVOKE ALL ON public.inventory_items, public.inventory_assignments FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items, public.inventory_assignments TO authenticated;

-- =====================================================================
-- 4. Liste: eşya + açık zimmet; durum filtresi için state
--    (assigned = zimmette, available = boşta, maintenance, retired)
-- =====================================================================
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
	END AS state
FROM public.inventory_items i
LEFT JOIN public.inventory_assignments a ON a.item_id = i.id AND a.returned_at IS NULL
LEFT JOIN public.stores s ON s.id = a.store_id;

REVOKE ALL ON public.inventory_items_list FROM anon;
GRANT SELECT ON public.inventory_items_list TO authenticated;

NOTIFY pgrst, 'reload schema';

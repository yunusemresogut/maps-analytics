-- Organizasyon (firma) bazlı veri izolasyonu.
--
-- Her kayıt kendi organizasyonunu açar; o organizasyonun admini ve altında
-- açılan hesaplar yalnızca kendi verilerini görür. Modül tabloları (ticket,
-- sözleşme, hakediş, fatura) zaten organization_id ile korunuyordu; mağazalar,
-- mağaza detayları, bölgeler, aktivite logu ve profiller korunmuyordu.
--
-- Mevcut izin (RBAC) policy'leri Supabase panelinden oluşturulduğu için
-- silinmez. Bunun yerine RESTRICTIVE policy eklenir: Postgres bunları mevcut
-- policy'lerle AND'ler, böylece rol izinleri aynen korunur ve üstüne firma
-- sınırı eklenir.

-- 1. Organizasyonu olmayan kullanıcıyı başka firmaya bağlama; kendi
--    organizasyonunu aç.
CREATE OR REPLACE FUNCTION public.ensure_user_organization()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
	v_org_id uuid;
	v_name text;
BEGIN
	IF auth.uid() IS NULL THEN
		RETURN NULL;
	END IF;

	SELECT organization_id, COALESCE(NULLIF(name, ''), email)
	INTO v_org_id, v_name
	FROM public.profiles
	WHERE id = auth.uid();

	IF v_org_id IS NOT NULL THEN
		RETURN v_org_id;
	END IF;

	INSERT INTO public.organizations (name)
	VALUES (COALESCE(v_name, 'Yeni Organizasyon'))
	RETURNING id INTO v_org_id;

	UPDATE public.profiles
	SET organization_id = v_org_id
	WHERE id = auth.uid();

	RETURN v_org_id;
END;
$$;

-- 2. Mağaza detay tabloları için yardımcı: mağaza oturumdaki firmaya mı ait?
CREATE OR REPLACE FUNCTION public.store_in_current_organization(p_store_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
	SELECT EXISTS (
		SELECT 1 FROM public.stores
		WHERE id = p_store_id
			AND organization_id = public.current_organization_id()
	);
$$;

GRANT EXECUTE ON FUNCTION public.store_in_current_organization(text) TO authenticated;

-- 3. Bölgeler ve aktivite logu firmaya bağlanır. Mevcut kayıtlar, mevcut
--    mağazaların sahibi olan ilk organizasyona aktarılır.
ALTER TABLE public.regions
	ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.activity_logs
	ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

DO $$
DECLARE
	v_default_org uuid;
BEGIN
	SELECT id INTO v_default_org FROM public.organizations ORDER BY created_at LIMIT 1;
	IF v_default_org IS NOT NULL THEN
		UPDATE public.regions SET organization_id = v_default_org WHERE organization_id IS NULL;
		UPDATE public.activity_logs SET organization_id = v_default_org WHERE organization_id IS NULL;
		UPDATE public.stores SET organization_id = v_default_org WHERE organization_id IS NULL;
	END IF;
END;
$$;

-- Yeni kayıtlar istemci göndermese bile oturumdaki firmaya yazılır.
ALTER TABLE public.stores ALTER COLUMN organization_id SET DEFAULT public.current_organization_id();
ALTER TABLE public.regions ALTER COLUMN organization_id SET DEFAULT public.current_organization_id();
ALTER TABLE public.activity_logs ALTER COLUMN organization_id SET DEFAULT public.current_organization_id();

CREATE INDEX IF NOT EXISTS stores_organization_id_idx ON public.stores (organization_id);
CREATE INDEX IF NOT EXISTS regions_organization_id_idx ON public.regions (organization_id);
CREATE INDEX IF NOT EXISTS activity_logs_organization_id_idx ON public.activity_logs (organization_id, created_at DESC);

-- 4. RLS'i aç (zaten açıksa etkisizdir).
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_work_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. Mağazalar ve detayları: firma sınırı (RESTRICTIVE).
DROP POLICY IF EXISTS stores_tenant_isolation ON public.stores;
CREATE POLICY stores_tenant_isolation ON public.stores
	AS RESTRICTIVE FOR ALL
	USING (organization_id = public.current_organization_id())
	WITH CHECK (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS store_notes_tenant_isolation ON public.store_notes;
CREATE POLICY store_notes_tenant_isolation ON public.store_notes
	AS RESTRICTIVE FOR ALL
	USING (public.store_in_current_organization(store_id))
	WITH CHECK (public.store_in_current_organization(store_id));

DROP POLICY IF EXISTS store_files_tenant_isolation ON public.store_files;
CREATE POLICY store_files_tenant_isolation ON public.store_files
	AS RESTRICTIVE FOR ALL
	USING (public.store_in_current_organization(store_id))
	WITH CHECK (public.store_in_current_organization(store_id));

DROP POLICY IF EXISTS store_materials_tenant_isolation ON public.store_materials;
CREATE POLICY store_materials_tenant_isolation ON public.store_materials
	AS RESTRICTIVE FOR ALL
	USING (public.store_in_current_organization(store_id))
	WITH CHECK (public.store_in_current_organization(store_id));

DROP POLICY IF EXISTS store_work_plan_tenant_isolation ON public.store_work_plan;
CREATE POLICY store_work_plan_tenant_isolation ON public.store_work_plan
	AS RESTRICTIVE FOR ALL
	USING (public.store_in_current_organization(store_id))
	WITH CHECK (public.store_in_current_organization(store_id));

-- Not ve dosya tablolarında RLS daha önce kapalı olabilir; firma içinde
-- erişimin kesilmemesi için permissive policy (UI zaten rol iznini denetler).
DROP POLICY IF EXISTS store_notes_org_access ON public.store_notes;
CREATE POLICY store_notes_org_access ON public.store_notes
	FOR ALL TO authenticated
	USING (public.store_in_current_organization(store_id))
	WITH CHECK (public.store_in_current_organization(store_id));

DROP POLICY IF EXISTS store_files_org_access ON public.store_files;
CREATE POLICY store_files_org_access ON public.store_files
	FOR ALL TO authenticated
	USING (public.store_in_current_organization(store_id))
	WITH CHECK (public.store_in_current_organization(store_id));

-- 6. Bölgeler ve aktivite logu: firma içinde erişim (PERMISSIVE) + sınır
--    (RESTRICTIVE). Permissive policy, RLS daha önce kapalıysa erişimin
--    kesilmemesini sağlar; restrictive olan başka firmayı dışarıda tutar.
DROP POLICY IF EXISTS regions_org_access ON public.regions;
CREATE POLICY regions_org_access ON public.regions
	FOR ALL TO authenticated
	USING (organization_id = public.current_organization_id())
	WITH CHECK (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS regions_tenant_isolation ON public.regions;
CREATE POLICY regions_tenant_isolation ON public.regions
	AS RESTRICTIVE FOR ALL
	USING (organization_id = public.current_organization_id())
	WITH CHECK (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS activity_logs_org_access ON public.activity_logs;
CREATE POLICY activity_logs_org_access ON public.activity_logs
	FOR ALL TO authenticated
	USING (organization_id = public.current_organization_id())
	WITH CHECK (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS activity_logs_tenant_isolation ON public.activity_logs;
CREATE POLICY activity_logs_tenant_isolation ON public.activity_logs
	AS RESTRICTIVE FOR ALL
	USING (organization_id = public.current_organization_id())
	WITH CHECK (organization_id = public.current_organization_id());

-- 7. Profiller: kullanıcı kendi profilini ve kendi firmasındakileri görür /
--    günceller. INSERT kısıtlanmaz: auth.users tetikleyicisi profili
--    organization_id olmadan ekler, kayıt akışı hemen ardından firmayı atar.
DROP POLICY IF EXISTS profiles_tenant_isolation_select ON public.profiles;
CREATE POLICY profiles_tenant_isolation_select ON public.profiles
	AS RESTRICTIVE FOR SELECT
	USING (id = auth.uid() OR organization_id = public.current_organization_id());

DROP POLICY IF EXISTS profiles_tenant_isolation_update ON public.profiles;
CREATE POLICY profiles_tenant_isolation_update ON public.profiles
	AS RESTRICTIVE FOR UPDATE
	USING (id = auth.uid() OR organization_id = public.current_organization_id())
	WITH CHECK (id = auth.uid() OR organization_id = public.current_organization_id());

DROP POLICY IF EXISTS profiles_tenant_isolation_delete ON public.profiles;
CREATE POLICY profiles_tenant_isolation_delete ON public.profiles
	AS RESTRICTIVE FOR DELETE
	USING (organization_id = public.current_organization_id());

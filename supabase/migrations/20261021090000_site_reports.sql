-- Şantiye raporları (şimdilik yalnızca günlük şantiye raporu).
-- Form içeriği "data" (jsonb) sütunundadır; şantiye ve tarih liste/filtre için
-- ayrı sütundur. Fotoğraflar module-files deposunda {rapor id}/{dosya} yolunda
-- durur, yolları data.photos içinde tutulur (src/lib/site-reports.ts).
-- Yetki: firmadaki herkes görür; raporu yazan ile admin, yönetici ve bölge
-- müdürü düzenler ve siler.

CREATE TABLE IF NOT EXISTS public.site_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL DEFAULT public.current_organization_id()
    REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_type text NOT NULL DEFAULT 'daily_site' CHECK (report_type IN ('daily_site')),
  store_id text NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  report_date date NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_by_name text,
  updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS site_reports_org_date_idx ON public.site_reports (organization_id, report_date DESC);
CREATE INDEX IF NOT EXISTS site_reports_store_idx ON public.site_reports (store_id);

-- Raporu düzenleyebilen: yazan ya da tam yetkili yönetici
CREATE OR REPLACE FUNCTION public.can_modify_site_report(p_created_by uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_created_by = auth.uid()
    OR COALESCE(public.current_app_role() IN ('admin', 'manager', 'regional_manager'), false);
$$;

REVOKE ALL ON FUNCTION public.can_modify_site_report(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_modify_site_report(uuid) TO authenticated;

-- Firma, yazar ve oluşturma zamanı sonradan değiştirilemez; güncelleme damgası sunucudan
CREATE OR REPLACE FUNCTION public.stamp_site_report()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.organization_id := public.current_organization_id();
    NEW.created_by := auth.uid();
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
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stamp_site_report ON public.site_reports;
CREATE TRIGGER stamp_site_report
  BEFORE INSERT OR UPDATE ON public.site_reports
  FOR EACH ROW EXECUTE FUNCTION public.stamp_site_report();

ALTER TABLE public.site_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_reports_select ON public.site_reports;
CREATE POLICY site_reports_select ON public.site_reports
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id());

-- Şantiye de firmaya ait olmalı
DROP POLICY IF EXISTS site_reports_insert ON public.site_reports;
CREATE POLICY site_reports_insert ON public.site_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.store_in_current_organization(store_id)
  );

DROP POLICY IF EXISTS site_reports_update ON public.site_reports;
CREATE POLICY site_reports_update ON public.site_reports
  FOR UPDATE TO authenticated
  USING (organization_id = public.current_organization_id() AND public.can_modify_site_report(created_by))
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.store_in_current_organization(store_id)
  );

DROP POLICY IF EXISTS site_reports_delete ON public.site_reports;
CREATE POLICY site_reports_delete ON public.site_reports
  FOR DELETE TO authenticated
  USING (organization_id = public.current_organization_id() AND public.can_modify_site_report(created_by));

REVOKE ALL ON public.site_reports FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_reports TO authenticated;

-- Liste: şantiye adıyla aranabilsin, fotoğraf sayısı görünsün
DROP VIEW IF EXISTS public.site_reports_list;
CREATE VIEW public.site_reports_list
WITH (security_invoker = true) AS
SELECT
	r.id,
	r.organization_id,
	r.report_type,
	r.store_id,
	r.report_date,
	r.created_by,
	r.created_by_name,
	r.created_at,
	r.updated_by_name,
	r.updated_at,
	s.name AS store_name,
	s.city AS store_city,
	COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(r.data->'photos') = 'array' THEN r.data->'photos' END), 0)
		AS photo_count
FROM public.site_reports r
LEFT JOIN public.stores s ON s.id = r.store_id;

REVOKE ALL ON public.site_reports_list FROM anon;
GRANT SELECT ON public.site_reports_list TO authenticated;

-- Fotoğraflar: module-files deposunun kurallarına rapor klasörleri eklenir
-- (20261019150000_security_hardening.sql ve 20261019170000_module_permissions.sql)
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
      WHERE id::text = split_part(p_name, '/', 1) AND organization_id = public.current_organization_id())
    OR EXISTS (
      SELECT 1 FROM public.site_reports
      WHERE id::text = split_part(p_name, '/', 1) AND organization_id = public.current_organization_id());
$$;

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
           OR public.has_module_permission('progressPayments', 'edit')))
    OR EXISTS (SELECT 1 FROM public.site_reports
             WHERE id::text = split_part(p_name, '/', 1) AND organization_id = public.current_organization_id()
               AND public.can_modify_site_report(created_by));
$$;

NOTIFY pgrst, 'reload schema';

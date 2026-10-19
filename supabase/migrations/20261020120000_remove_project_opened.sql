-- "Proje açma" kavramı kaldırıldı. Onay akışı yalnızca üç disiplin onayından
-- (mimari, mekanik, elektrik) oluşur; "onay bekliyor" = disiplinlerden biri eksik.
-- Sıra önemli: fonksiyon güncellenir, görünüm kaldırılır, sütunlar silinir,
-- görünüm yeniden oluşturulur.

-- 1. Onay kuralları (src/lib/roles.ts → canApproveDiscipline ile aynı):
--    bir disiplini ilgili mühendis, yönetici, bölge müdürü ya da admin
--    değiştirebilir; onaylayan kişi ve zaman istemciden alınmaz.
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
  d text;
  v_role_for text;
  v_old boolean;
  v_new boolean;
  c_ignored CONSTANT text[] := ARRAY[
    'architectural_approved', 'architectural_approved_by', 'architectural_approved_by_name', 'architectural_approved_at',
    'mechanical_approved', 'mechanical_approved_by', 'mechanical_approved_by_name', 'mechanical_approved_at',
    'electrical_approved', 'electrical_approved_by', 'electrical_approved_by_name', 'electrical_approved_at',
    'updated_by', 'updated_by_name', 'updated_at'];
BEGIN
  IF current_user <> 'authenticated' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_name := public.current_profile_name();
  v_role := public.current_app_role();
  v_full_manager := v_role IN ('admin', 'manager', 'regional_manager');
  v_can_approve := public.has_module_permission('approvals', 'edit');

  -- Yalnızca onay yetkisi olan (mağaza düzenleme yetkisi olmayan) kullanıcı
  -- mağazanın diğer alanlarını değiştiremez
  IF TG_OP = 'UPDATE' AND NOT public.can_edit_stores()
     AND (to_jsonb(NEW) - c_ignored) IS DISTINCT FROM (to_jsonb(OLD) - c_ignored) THEN
    RAISE EXCEPTION 'Mağaza bilgilerini düzenleme yetkiniz yok' USING ERRCODE = '42501';
  END IF;

  FOREACH d IN ARRAY ARRAY['architectural', 'mechanical', 'electrical'] LOOP
    v_role_for := CASE d WHEN 'architectural' THEN 'architect'
                         WHEN 'mechanical' THEN 'mechanical_engineer'
                         ELSE 'electrical_engineer' END;
    v_new := COALESCE((to_jsonb(NEW) ->> (d || '_approved'))::boolean, false);
    v_old := CASE WHEN TG_OP = 'INSERT' THEN false
                  ELSE COALESCE((to_jsonb(OLD) ->> (d || '_approved'))::boolean, false) END;
    IF v_new IS DISTINCT FROM v_old
       AND (NOT v_can_approve OR NOT (v_full_manager OR v_role = v_role_for)) THEN
      RAISE EXCEPTION 'Bu onayı değiştirme yetkiniz yok' USING ERRCODE = '42501';
    END IF;
  END LOOP;

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

  RETURN NEW;
END;
$$;

-- 2. Görünüm sütunlara bağlı olduğu için önce kaldırılır
DROP VIEW IF EXISTS public.stores_list;

-- 3. Proje açma sütunları
ALTER TABLE public.stores
  DROP COLUMN IF EXISTS project_opened,
  DROP COLUMN IF EXISTS project_opened_by,
  DROP COLUMN IF EXISTS project_opened_by_name,
  DROP COLUMN IF EXISTS project_opened_at;

-- 4. Liste görünümü: "onay bekliyor" yalnızca disiplin onaylarına bakar
CREATE VIEW public.stores_list
WITH (security_invoker = true) AS
SELECT
	s.*,
	(s.architectural_approved::int + s.mechanical_approved::int + s.electrical_approved::int)
		AS approval_count,
	NOT (s.architectural_approved AND s.mechanical_approved AND s.electrical_approved)
		AS pending_approval
FROM public.stores s;

REVOKE ALL ON public.stores_list FROM anon;
GRANT SELECT ON public.stores_list TO authenticated;

NOTIFY pgrst, 'reload schema';

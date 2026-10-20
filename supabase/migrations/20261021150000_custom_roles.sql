-- Firmaya özel roller (ör. Usta, Tedarik).
-- Roller organizations.custom_roles içinde [{key, label, description}] olarak
-- tutulur; anahtar "custom_" ile başlar (src/lib/roles.ts → CUSTOM_ROLE_PATTERN).
-- Yetki matrisi rol şablonu olarak role_permission_defaults'ta, kullanıcıya
-- atanınca profiles.permissions'ta durur; veritabanı kuralları zaten bu matrisi
-- kullanır. Özel rolün onay disiplini ya da yönetici ayrıcalığı yoktur.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS custom_roles jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 1. Rol adı doğrulaması: yerleşik roller korunur, özel rol anahtarı olduğu gibi
--    döner. Önceden tanınmayan her rol "manager" sayılıyordu; özel rol yönetici
--    ayrıcalığı (tüm onaylar, başkasının raporunu silme) kazanmasın diye değişti.
CREATE OR REPLACE FUNCTION public.app_normalize_role(p_role text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_role IN ('admin', 'mechanical_engineer', 'electrical_engineer', 'architect',
                    'civil_engineer', 'manager', 'regional_manager', 'store_manager', 'accounting')
      THEN p_role
    WHEN p_role ~ '^custom_[a-z0-9]{4,32}$' THEN p_role
    ELSE 'manager'
  END;
$$;
-- Not: app_builtin_crud özel rol için son satırdaki en dar varsayılanı verir
-- (harita ve mağazaları görüntüleme); bu yalnızca profilde matris yoksa kullanılır.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (
    role IN ('admin', 'mechanical_engineer', 'electrical_engineer', 'architect',
             'civil_engineer', 'manager', 'regional_manager', 'store_manager', 'accounting')
    OR role ~ '^custom_[a-z0-9]{4,32}$'
  );

-- 2. Özel rol yalnızca kendi firmasında tanımlıysa atanabilir
CREATE OR REPLACE FUNCTION public.guard_profile_custom_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role LIKE 'custom\_%' AND NOT EXISTS (
    SELECT 1
    FROM public.organizations o, jsonb_array_elements(o.custom_roles) AS r
    WHERE o.id = NEW.organization_id AND r->>'key' = NEW.role
  ) THEN
    RAISE EXCEPTION 'Rol bu firmada tanımlı değil: %', NEW.role USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_custom_role ON public.profiles;
CREATE TRIGGER profiles_guard_custom_role
  BEFORE INSERT OR UPDATE OF role, organization_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_custom_role();

-- 3. Kullanıcısı olan özel rol silinemez; rol listesi biçimi doğrulanır
CREATE OR REPLACE FUNCTION public.guard_organization_custom_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_in_use text;
BEGIN
  IF jsonb_typeof(NEW.custom_roles) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Geçersiz rol listesi' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.custom_roles) AS r
    WHERE jsonb_typeof(r) IS DISTINCT FROM 'object'
       OR NOT ((r->>'key') ~ '^custom_[a-z0-9]{4,32}$')
       OR btrim(COALESCE(r->>'label', '')) = ''
  ) THEN
    RAISE EXCEPTION 'Rol anahtarı ya da adı geçersiz' USING ERRCODE = '22023';
  END IF;

  SELECT p.role INTO v_in_use
  FROM public.profiles p
  WHERE p.organization_id = NEW.id
    AND p.role LIKE 'custom\_%'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(NEW.custom_roles) AS r WHERE r->>'key' = p.role
    )
  LIMIT 1;
  IF v_in_use IS NOT NULL THEN
    RAISE EXCEPTION 'Bu rolde kullanıcılar var; önce rollerini değiştirin (%)', v_in_use
      USING ERRCODE = '23503';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_guard_custom_roles ON public.organizations;
CREATE TRIGGER organizations_guard_custom_roles
  BEFORE INSERT OR UPDATE OF custom_roles ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.guard_organization_custom_roles();

NOTIFY pgrst, 'reload schema';

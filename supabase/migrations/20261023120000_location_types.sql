-- Firmaya göre düzenlenebilir saha türleri (eski sabit "Konum Tipi": avm/cadde/outdoor).
-- Türler organizations.location_types içinde [{key, label}] olarak tutulur; varsayılan
-- liste src/lib/location-types.ts → DEFAULT_LOCATION_TYPES ile aynıdır.
-- stores.location_type türün anahtarını tutar.

-- 1. Tür listesi; mevcut firmalar varsayılan listeyle doldurulur
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS location_types jsonb NOT NULL DEFAULT '[
    {"key": "magaza", "label": "Mağaza"},
    {"key": "ofis", "label": "Ofis"},
    {"key": "kafe", "label": "Kafe"},
    {"key": "konut", "label": "Konut"},
    {"key": "otel", "label": "Otel"},
    {"key": "endustriyel", "label": "Endüstriyel"}
  ]'::jsonb;

-- 2. Eski sabit değerleri sınırlayan CHECK kısıtı varsa kaldırılır (panelden eklenmiş olabilir)
DO $$
DECLARE
  v_name text;
BEGIN
  FOR v_name IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.stores'::regclass
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%location_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.stores DROP CONSTRAINT %I', v_name);
  END LOOP;
END;
$$;

-- 3. Eski değerler (AVM, Cadde, Outdoor) "Mağaza" olur
UPDATE public.stores
SET location_type = 'magaza'
WHERE location_type IS NULL OR location_type IN ('avm', 'cadde', 'outdoor');

ALTER TABLE public.stores ALTER COLUMN location_type SET DEFAULT 'magaza';

-- 4. Liste biçimi doğrulanır; sahalarda kullanılan tür listeden çıkarılamaz
CREATE OR REPLACE FUNCTION public.guard_organization_location_types()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_in_use text;
BEGIN
  IF jsonb_typeof(NEW.location_types) IS DISTINCT FROM 'array'
     OR jsonb_array_length(NEW.location_types) = 0 THEN
    RAISE EXCEPTION 'En az bir saha türü olmalı' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.location_types) AS t
    WHERE jsonb_typeof(t) IS DISTINCT FROM 'object'
       OR NOT ((t->>'key') ~ '^[a-z0-9_]{2,40}$')
       OR btrim(COALESCE(t->>'label', '')) = ''
  ) THEN
    RAISE EXCEPTION 'Saha türü anahtarı ya da adı geçersiz' USING ERRCODE = '22023';
  END IF;

  IF (SELECT count(DISTINCT t->>'key') FROM jsonb_array_elements(NEW.location_types) AS t)
     <> jsonb_array_length(NEW.location_types) THEN
    RAISE EXCEPTION 'Saha türü anahtarları tekrar ediyor' USING ERRCODE = '22023';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT s.location_type INTO v_in_use
    FROM public.stores s
    WHERE s.organization_id = NEW.id
      AND EXISTS (SELECT 1 FROM jsonb_array_elements(OLD.location_types) AS t WHERE t->>'key' = s.location_type)
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.location_types) AS t WHERE t->>'key' = s.location_type)
    LIMIT 1;
    IF v_in_use IS NOT NULL THEN
      RAISE EXCEPTION 'Bu türde sahalar var; önce sahaların türünü değiştirin (%)', v_in_use
        USING ERRCODE = '23503';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_guard_location_types ON public.organizations;
CREATE TRIGGER organizations_guard_location_types
  BEFORE INSERT OR UPDATE OF location_types ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.guard_organization_location_types();

-- 5. Sahaya yalnızca firmasında tanımlı bir tür atanabilir. Tür değişmeyen
--    güncellemeler kontrol edilmez (eski kayıtlar diğer alanlarıyla düzenlenebilsin).
CREATE OR REPLACE FUNCTION public.guard_store_location_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.location_type IS NOT DISTINCT FROM OLD.location_type THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organizations o, jsonb_array_elements(o.location_types) AS t
    WHERE o.id = NEW.organization_id AND t->>'key' = NEW.location_type
  ) THEN
    RAISE EXCEPTION 'Saha türü bu firmada tanımlı değil: %', NEW.location_type USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stores_guard_location_type ON public.stores;
CREATE TRIGGER stores_guard_location_type
  BEFORE INSERT OR UPDATE OF location_type ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.guard_store_location_type();

NOTIFY pgrst, 'reload schema';

-- Varsayılan organizasyon + profil/mağaza backfill (legacy kurulumlar)
-- Sözleşme / ticket / hakediş / fatura tabloları organization_id zorunlu.

CREATE OR REPLACE FUNCTION public.ensure_user_organization()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT organization_id INTO v_org_id
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_org_id IS NOT NULL THEN
    RETURN v_org_id;
  END IF;

  SELECT id INTO v_org_id
  FROM public.organizations
  ORDER BY created_at
  LIMIT 1;

  IF v_org_id IS NULL THEN
    INSERT INTO public.organizations (name)
    VALUES ('Varsayılan Organizasyon')
    RETURNING id INTO v_org_id;
  END IF;

  UPDATE public.profiles
  SET organization_id = v_org_id
  WHERE id = auth.uid();

  RETURN v_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_organization() TO authenticated;

-- Mevcut veriyi backfill et
DO $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT id INTO v_org_id
  FROM public.organizations
  ORDER BY created_at
  LIMIT 1;

  IF v_org_id IS NULL THEN
    INSERT INTO public.organizations (name)
    VALUES ('Varsayılan Organizasyon')
    RETURNING id INTO v_org_id;
  END IF;

  UPDATE public.profiles
  SET organization_id = v_org_id
  WHERE organization_id IS NULL;

  UPDATE public.stores
  SET organization_id = v_org_id
  WHERE organization_id IS NULL;
END;
$$;

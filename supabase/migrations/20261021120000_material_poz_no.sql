-- Keşif kalemine poz numarası (birim fiyat poz no, örn. 15.150.1005).
-- Serbest metindir; boş bırakılabilir. Listede ilk sütundur ve aramaya dahildir.
-- Sıra önemli: liste görünümü m.* ile bağlı olduğu için önce kaldırılır.

DROP VIEW IF EXISTS public.store_materials_list;

ALTER TABLE public.store_materials ADD COLUMN IF NOT EXISTS poz_no text NOT NULL DEFAULT '';

-- 20261020200000_currency.sql ile aynı
CREATE VIEW public.store_materials_list
WITH (security_invoker = true) AS
SELECT
	m.*,
	CASE m.status
		WHEN 'bekleniyor' THEN 'Bekleniyor'
		WHEN 'geldi' THEN 'Geldi'
		WHEN 'gitti' THEN 'Gitti'
		ELSE m.status
	END AS status_label
FROM public.store_materials m;

REVOKE ALL ON public.store_materials_list FROM anon;
GRANT SELECT ON public.store_materials_list TO authenticated;

-- Araya keşif kalemi ekleme: poz numarası da alınır (eski imza kaldırılır)
DROP FUNCTION IF EXISTS public.insert_store_material_after(text, text, bigint, text, numeric, text, numeric, text, text);

CREATE OR REPLACE FUNCTION public.insert_store_material_after(
  p_id text,
  p_store_id text,
  p_after_seq bigint,
  p_name text,
  p_quantity numeric,
  p_unit text,
  p_unit_price numeric,
  p_status text,
  p_currency text,
  p_poz_no text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_seq bigint;
BEGIN
  -- Aynı mağazaya eşzamanlı araya eklemeler sırayı bozmasın
  PERFORM 1 FROM public.stores WHERE id = p_store_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mağaza bulunamadı' USING ERRCODE = 'P0002';
  END IF;

  -- Referans kalem bu mağazaya ait olmalı
  IF NOT EXISTS (
    SELECT 1 FROM public.store_materials WHERE store_id = p_store_id AND seq = p_after_seq
  ) THEN
    RAISE EXCEPTION 'Referans keşif kalemi bulunamadı' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.store_materials
  SET seq = seq + 1
  WHERE store_id = p_store_id AND seq > p_after_seq;

  v_seq := p_after_seq + 1;
  INSERT INTO public.store_materials (id, store_id, user_id, name, quantity, unit, unit_price, status, currency, poz_no, imported_at, seq)
  VALUES (p_id, p_store_id, auth.uid(), p_name, p_quantity, p_unit, p_unit_price, p_status, p_currency, COALESCE(p_poz_no, ''), now(), v_seq);

  PERFORM public.advance_store_material_seq();
  RETURN v_seq;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_store_material_after(text, text, bigint, text, numeric, text, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_store_material_after(text, text, bigint, text, numeric, text, numeric, text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

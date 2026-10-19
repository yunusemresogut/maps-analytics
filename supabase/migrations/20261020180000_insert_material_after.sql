-- Keşif kalemini belirli bir kalemin hemen altına ekler (ör. seçilen kalemlerden
-- yüzdelik kalem, seçilenlerin sonuncusunun altına). Sonraki kalemlerin sırası
-- (seq) bir kaydırılır; kaydırma ve ekleme tek işlemde yapılır, yarıda kalmaz.
-- SECURITY INVOKER: kullanıcının yetkileri (RLS) ve "kim ekledi" damgası geçerlidir.

-- Kaydırma sonrası sıra sayacı en büyük seq'in gerisinde kalırsa, sonradan
-- normal eklenen kalem kaydırılmış bir kalemle aynı sırayı alır. Bu yardımcı
-- sayacı yalnızca ileri alır (geri almaz, veri okumaz/yazmaz).
CREATE OR REPLACE FUNCTION public.advance_store_material_seq()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq text := pg_get_serial_sequence('public.store_materials', 'seq');
  v_max bigint;
BEGIN
  SELECT MAX(seq) INTO v_max FROM public.store_materials;
  IF v_max IS NOT NULL AND v_max > COALESCE(pg_sequence_last_value(v_seq::regclass), 0) THEN
    PERFORM setval(v_seq, v_max, true);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_store_material_seq() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.advance_store_material_seq() TO authenticated;

CREATE OR REPLACE FUNCTION public.insert_store_material_after(
  p_id text,
  p_store_id text,
  p_after_seq bigint,
  p_name text,
  p_quantity numeric,
  p_unit text,
  p_unit_price numeric,
  p_status text
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
  INSERT INTO public.store_materials (id, store_id, user_id, name, quantity, unit, unit_price, status, imported_at, seq)
  VALUES (p_id, p_store_id, auth.uid(), p_name, p_quantity, p_unit, p_unit_price, p_status, now(), v_seq);

  PERFORM public.advance_store_material_seq();
  RETURN v_seq;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_store_material_after(text, text, bigint, text, numeric, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_store_material_after(text, text, bigint, text, numeric, text, numeric, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

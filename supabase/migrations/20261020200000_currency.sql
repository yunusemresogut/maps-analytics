-- Para birimi ve kuruş hassasiyeti.
-- Tutar girilen her kayıt kendi para birimini taşır (TRY, USD, EUR, GBP, CHF;
-- uygulamadaki src/lib/currency.ts ile aynı liste). Kur çevrimi yapılmaz:
-- farklı birimdeki tutarlar birbirine eklenmez, toplamlar birim başına ayrı
-- tutulur, örn. {"TRY": 1250.5, "USD": 300}. Tutarlar kuruş hassasiyetindedir
-- (2 ondalık); keşif satır tutarı da kuruşa yuvarlanır (src/lib/material-totals.ts).
-- Sıra önemli: görünümler sütunlara (*) bağlı olduğu için önce kaldırılır,
-- sütunlar eklenir, görünümler yeniden oluşturulur.

-- 1. Görünümler
DROP VIEW IF EXISTS public.contracts_list;
DROP VIEW IF EXISTS public.progress_payments_list;
DROP VIEW IF EXISTS public.invoices_list;
DROP VIEW IF EXISTS public.stores_list;
DROP VIEW IF EXISTS public.store_materials_list;
DROP VIEW IF EXISTS public.store_detail_summary;

-- 2. Para birimi sütunları (mevcut kayıtlar TRY)
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'TRY';
ALTER TABLE public.progress_payments ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'TRY';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'TRY';
ALTER TABLE public.store_materials ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'TRY';
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS budget_currency text NOT NULL DEFAULT 'TRY';

DO $$
DECLARE
  v_table text;
  v_column text;
BEGIN
  FOR v_table, v_column IN
    SELECT * FROM (VALUES
      ('contracts', 'currency'),
      ('progress_payments', 'currency'),
      ('invoices', 'currency'),
      ('store_materials', 'currency'),
      ('stores', 'budget_currency')
    ) AS t(table_name, column_name)
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
      v_table, v_table || '_' || v_column || '_check');
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%I IN (''TRY'', ''USD'', ''EUR'', ''GBP'', ''CHF''))',
      v_table, v_table || '_' || v_column || '_check', v_column);
  END LOOP;
END;
$$;

-- 3. Liste görünümleri (20261016130000_list_views.sql ile aynı, yeni sütunlarla)
CREATE VIEW public.contracts_list
WITH (security_invoker = true) AS
SELECT
	c.*,
	s.name AS store_name
FROM public.contracts c
LEFT JOIN public.stores s ON s.id = c.store_id;

-- paid: hakedişe bağlı "paid" faturaların hakedişin kendi birimindeki KDV dahil toplamı (sıralama için)
-- paid_totals: aynı toplam, para birimine göre
-- progress: sözleşmenin biriminde ödenen / sözleşme tutarı (0–100); başka birimdeki faturalar sayılmaz
CREATE VIEW public.progress_payments_list
WITH (security_invoker = true) AS
WITH paid_by_currency AS (
	SELECT progress_payment_id, currency, SUM(amount + tax_amount) AS paid
	FROM public.invoices
	WHERE status = 'paid' AND progress_payment_id IS NOT NULL
	GROUP BY progress_payment_id, currency
),
paid_totals AS (
	SELECT progress_payment_id, jsonb_object_agg(currency, paid) AS paid_totals
	FROM paid_by_currency
	GROUP BY progress_payment_id
),
paid_by_contract AS (
	SELECT p.contract_id, SUM(pc.paid) AS paid
	FROM public.progress_payments p
	JOIN public.contracts c ON c.id = p.contract_id
	JOIN paid_by_currency pc ON pc.progress_payment_id = p.id AND pc.currency = c.currency
	GROUP BY p.contract_id
)
SELECT
	p.*,
	s.name AS store_name,
	c.title AS contract_title,
	c.currency AS contract_currency,
	COALESCE(own.paid, 0) AS paid,
	COALESCE(pt.paid_totals, '{}'::jsonb) AS paid_totals,
	CASE
		WHEN c.amount IS NULL OR c.amount <= 0 THEN 0
		ELSE LEAST(100, ROUND(COALESCE(pbc.paid, 0) / c.amount * 100))
	END AS progress
FROM public.progress_payments p
LEFT JOIN public.stores s ON s.id = p.store_id
LEFT JOIN public.contracts c ON c.id = p.contract_id
LEFT JOIN paid_by_currency own ON own.progress_payment_id = p.id AND own.currency = p.currency
LEFT JOIN paid_totals pt ON pt.progress_payment_id = p.id
LEFT JOIN paid_by_contract pbc ON pbc.contract_id = p.contract_id;

CREATE VIEW public.invoices_list
WITH (security_invoker = true) AS
SELECT
	i.*,
	s.name AS store_name,
	p.title AS payment_title,
	i.amount + i.tax_amount AS total
FROM public.invoices i
LEFT JOIN public.stores s ON s.id = i.store_id
LEFT JOIN public.progress_payments p ON p.id = i.progress_payment_id;

-- 20261020140000_private_store_notes.sql ile aynı
CREATE VIEW public.stores_list
WITH (security_invoker = true) AS
SELECT
	s.*,
	(s.architectural_approved::int + s.mechanical_approved::int + s.electrical_approved::int)
		AS approval_count,
	NOT (s.architectural_approved AND s.mechanical_approved AND s.electrical_approved)
		AS pending_approval
FROM public.stores s;

-- 4. Keşif görünümleri (20261016150000_store_detail_views.sql ile aynı)
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

-- material_totals: keşif toplamı para birimine göre. Yüzdelik kalem ("%")
-- tutarı = birim fiyat × miktar / 100 (20261020160000_percent_material_total.sql)
CREATE VIEW public.store_detail_summary
WITH (security_invoker = true) AS
SELECT
	s.id AS store_id,
	COALESCE(m.material_count, 0) AS material_count,
	COALESCE(m.material_totals, '{}'::jsonb) AS material_totals,
	COALESCE(w.work_plan_count, 0) AS work_plan_count,
	w.work_plan_avg_progress
FROM public.stores s
LEFT JOIN (
	SELECT
		store_id,
		SUM(line_count) AS material_count,
		jsonb_object_agg(currency, total) AS material_totals
	FROM (
		SELECT
			store_id,
			currency,
			COUNT(*) AS line_count,
			SUM(ROUND(
				CASE WHEN btrim(unit) = '%'
					THEN quantity * unit_price / 100
					ELSE quantity * unit_price
				END, 2)) AS total
		FROM public.store_materials
		GROUP BY store_id, currency
	) per_currency
	GROUP BY store_id
) m ON m.store_id = s.id
LEFT JOIN (
	SELECT store_id, COUNT(*) AS work_plan_count, ROUND(AVG(percent_complete)) AS work_plan_avg_progress
	FROM public.store_work_plan
	GROUP BY store_id
) w ON w.store_id = s.id;

REVOKE ALL ON public.contracts_list, public.progress_payments_list, public.invoices_list,
	public.stores_list, public.store_materials_list, public.store_detail_summary FROM anon;
GRANT SELECT ON public.contracts_list, public.progress_payments_list, public.invoices_list,
	public.stores_list, public.store_materials_list, public.store_detail_summary TO authenticated;

-- 5. Araya keşif kalemi ekleme: para birimi de alınır
--    (20261020180000_insert_material_after.sql; eski imza kaldırılır)
DROP FUNCTION IF EXISTS public.insert_store_material_after(text, text, bigint, text, numeric, text, numeric, text);

CREATE OR REPLACE FUNCTION public.insert_store_material_after(
  p_id text,
  p_store_id text,
  p_after_seq bigint,
  p_name text,
  p_quantity numeric,
  p_unit text,
  p_unit_price numeric,
  p_status text,
  p_currency text
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
  INSERT INTO public.store_materials (id, store_id, user_id, name, quantity, unit, unit_price, status, currency, imported_at, seq)
  VALUES (p_id, p_store_id, auth.uid(), p_name, p_quantity, p_unit, p_unit_price, p_status, p_currency, now(), v_seq);

  PERFORM public.advance_store_material_seq();
  RETURN v_seq;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_store_material_after(text, text, bigint, text, numeric, text, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_store_material_after(text, text, bigint, text, numeric, text, numeric, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

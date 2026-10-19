-- Yüzdelik keşif kalemi: birimi "%" olan kalemde miktar yüzdeyi, birim fiyat
-- seçilen kalemlerin toplam tutarını temsil eder; tutar = birim fiyat × miktar / 100.
-- (100 + 100) × %10 = 20. Uygulamadaki src/lib/material-totals.ts ile aynı formül.
-- Mağaza özetindeki keşif toplamı (bütçe, dashboard, asistan) buna göre hesaplanır.

DROP VIEW IF EXISTS public.store_detail_summary;
CREATE VIEW public.store_detail_summary
WITH (security_invoker = true) AS
SELECT
	s.id AS store_id,
	COALESCE(m.material_count, 0) AS material_count,
	COALESCE(m.material_total, 0) AS material_total,
	COALESCE(w.work_plan_count, 0) AS work_plan_count,
	w.work_plan_avg_progress
FROM public.stores s
LEFT JOIN (
	SELECT
		store_id,
		COUNT(*) AS material_count,
		SUM(
			CASE WHEN btrim(unit) = '%'
				THEN quantity * unit_price / 100
				ELSE quantity * unit_price
			END
		) AS material_total
	FROM public.store_materials
	GROUP BY store_id
) m ON m.store_id = s.id
LEFT JOIN (
	SELECT store_id, COUNT(*) AS work_plan_count, ROUND(AVG(percent_complete)) AS work_plan_avg_progress
	FROM public.store_work_plan
	GROUP BY store_id
) w ON w.store_id = s.id;

REVOKE ALL ON public.store_detail_summary FROM anon;
GRANT SELECT ON public.store_detail_summary TO authenticated;

NOTIFY pgrst, 'reload schema';

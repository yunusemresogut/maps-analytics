-- Malzeme ve iş planı artık mağaza başına, sayfa sayfa sunucudan çekilir.
-- Bu view'lar liste sorgularını ve tüm mağazaları kapsayan özetleri sağlar.
-- security_invoker = true: temel tablolardaki firma izolasyonu (RLS) geçerlidir.

-- Liste: arayüzdeki durum etiketiyle de arama yapılabilsin
DROP VIEW IF EXISTS public.store_materials_list;
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

DROP VIEW IF EXISTS public.store_work_plan_list;
CREATE VIEW public.store_work_plan_list
WITH (security_invoker = true) AS
SELECT
	w.*,
	CASE w.status
		WHEN 'yapilacak' THEN 'Yapılacak'
		WHEN 'devam_ediyor' THEN 'Devam ediyor'
		WHEN 'tamamlandi' THEN 'Tamamlandı'
		ELSE w.status
	END AS status_label
FROM public.store_work_plan w;

-- Mağaza başına tek satır özet: dashboard, bütçe ve asistan bunu kullanır
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
	SELECT store_id, COUNT(*) AS material_count, SUM(quantity * unit_price) AS material_total
	FROM public.store_materials
	GROUP BY store_id
) m ON m.store_id = s.id
LEFT JOIN (
	SELECT store_id, COUNT(*) AS work_plan_count, ROUND(AVG(percent_complete)) AS work_plan_avg_progress
	FROM public.store_work_plan
	GROUP BY store_id
) w ON w.store_id = s.id;

REVOKE ALL ON public.store_materials_list, public.store_work_plan_list,
	public.store_detail_summary FROM anon;
GRANT SELECT ON public.store_materials_list, public.store_work_plan_list,
	public.store_detail_summary TO authenticated;

NOTIFY pgrst, 'reload schema';

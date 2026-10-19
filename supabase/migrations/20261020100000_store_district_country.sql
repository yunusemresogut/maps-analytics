-- Mağaza konumu: ilçe ve ülke de saklanır (yurt dışı mağazalar desteklenir).
-- Değerler her zaman pinin konumundan (adres servisi) gelir; elle yazılmaz.
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS country text;

-- Mevcut mağazalar şimdiye kadar yalnızca Türkiye'de eklenebiliyordu
UPDATE public.stores SET country = 'Türkiye' WHERE country IS NULL;

-- stores_list "s.*" ile tanımlı; Postgres sütun listesini görünüm oluşturulurken
-- sabitlediği için yeni sütunların görünmesi için görünüm yeniden oluşturulur
DROP VIEW IF EXISTS public.stores_list;
CREATE VIEW public.stores_list
WITH (security_invoker = true) AS
SELECT
	s.*,
	(s.architectural_approved::int + s.mechanical_approved::int + s.electrical_approved::int)
		AS approval_count,
	NOT (s.architectural_approved AND s.mechanical_approved AND s.electrical_approved AND s.project_opened)
		AS pending_approval
FROM public.stores s;

REVOKE ALL ON public.stores_list FROM anon;
GRANT SELECT ON public.stores_list TO authenticated;

NOTIFY pgrst, 'reload schema';

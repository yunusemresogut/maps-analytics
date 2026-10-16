-- Liste ekranları için sunucu taraflı arama/filtre/sıralama/sayfalama.
-- İlişkili alanlar (mağaza adı, hakediş ödemesi vb.) view'da düz kolon olarak
-- sunulur; böylece PostgREST bu kolonlarda ilike, order ve range uygulayabilir.
-- security_invoker = true: sorgu çağıranın yetkisiyle çalışır, yani temel
-- tablolardaki firma izolasyonu (RLS) aynen geçerlidir.

DROP VIEW IF EXISTS public.tickets_list;
CREATE VIEW public.tickets_list
WITH (security_invoker = true) AS
SELECT
	t.*,
	s.name AS store_name
FROM public.tickets t
LEFT JOIN public.stores s ON s.id = t.store_id;

DROP VIEW IF EXISTS public.contracts_list;
CREATE VIEW public.contracts_list
WITH (security_invoker = true) AS
SELECT
	c.*,
	s.name AS store_name
FROM public.contracts c
LEFT JOIN public.stores s ON s.id = c.store_id;

-- paid: hakedişe bağlı "paid" faturaların KDV dahil toplamı
-- progress: sözleşmenin tüm hakedişlerinden ödenen / sözleşme tutarı (0–100)
DROP VIEW IF EXISTS public.progress_payments_list;
CREATE VIEW public.progress_payments_list
WITH (security_invoker = true) AS
WITH paid_by_payment AS (
	SELECT progress_payment_id, SUM(amount + tax_amount) AS paid
	FROM public.invoices
	WHERE status = 'paid' AND progress_payment_id IS NOT NULL
	GROUP BY progress_payment_id
),
paid_by_contract AS (
	SELECT p.contract_id, SUM(pp.paid) AS paid
	FROM public.progress_payments p
	JOIN paid_by_payment pp ON pp.progress_payment_id = p.id
	WHERE p.contract_id IS NOT NULL
	GROUP BY p.contract_id
)
SELECT
	p.*,
	s.name AS store_name,
	c.title AS contract_title,
	COALESCE(pp.paid, 0) AS paid,
	CASE
		WHEN c.amount IS NULL OR c.amount <= 0 THEN 0
		ELSE LEAST(100, ROUND(COALESCE(pc.paid, 0) / c.amount * 100))
	END AS progress
FROM public.progress_payments p
LEFT JOIN public.stores s ON s.id = p.store_id
LEFT JOIN public.contracts c ON c.id = p.contract_id
LEFT JOIN paid_by_payment pp ON pp.progress_payment_id = p.id
LEFT JOIN paid_by_contract pc ON pc.contract_id = p.contract_id;

DROP VIEW IF EXISTS public.invoices_list;
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

REVOKE ALL ON public.tickets_list, public.contracts_list, public.progress_payments_list,
	public.invoices_list, public.stores_list FROM anon;
GRANT SELECT ON public.tickets_list, public.contracts_list, public.progress_payments_list,
	public.invoices_list, public.stores_list TO authenticated;

-- Liste sorgularında kullanılan birleştirme kolonları
CREATE INDEX IF NOT EXISTS tickets_store_id_idx ON public.tickets (store_id);
CREATE INDEX IF NOT EXISTS contracts_store_id_idx ON public.contracts (store_id);
CREATE INDEX IF NOT EXISTS progress_payments_store_id_idx ON public.progress_payments (store_id);
CREATE INDEX IF NOT EXISTS progress_payments_contract_id_idx ON public.progress_payments (contract_id);
CREATE INDEX IF NOT EXISTS invoices_store_id_idx ON public.invoices (store_id);
CREATE INDEX IF NOT EXISTS invoices_progress_payment_id_idx ON public.invoices (progress_payment_id);

NOTIFY pgrst, 'reload schema';

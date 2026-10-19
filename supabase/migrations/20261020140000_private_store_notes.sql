-- Özel not artık kişiseldir: her kullanıcı bir mağaza için kendi notunu tutar
-- ve yalnızca kendisi görür (admin dahil kimse başkasının notunu okuyamaz).
-- Önceden stores.special_note mağazadaki herkesle paylaşılan tek bir alandı.

CREATE TABLE IF NOT EXISTS public.store_private_notes (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id text NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, store_id)
);

ALTER TABLE public.store_private_notes ENABLE ROW LEVEL SECURITY;

-- Yalnızca kendi notu; mağaza kullanıcının firmasında olmalı ve mağazayı
-- görme yetkisi bulunmalı (not tutmak için düzenleme yetkisi gerekmez)
DROP POLICY IF EXISTS store_private_notes_own ON public.store_private_notes;
CREATE POLICY store_private_notes_own ON public.store_private_notes
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND public.store_in_current_organization(store_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    AND public.store_in_current_organization(store_id)
    AND (public.has_module_permission('map', 'view') OR public.has_module_permission('stores', 'view'))
  );

-- Mevcut ortak notlar kaybolmasın: notu en son yazan kişiye (aktivite logundan),
-- bulunamazsa mağazayı oluşturana taşınır
INSERT INTO public.store_private_notes (user_id, store_id, note, updated_at)
SELECT owner.user_id, s.id, s.special_note, now()
FROM public.stores s
CROSS JOIN LATERAL (
  SELECT COALESCE(
    (SELECT l.actor_id::uuid
     FROM public.activity_logs l
     WHERE l.category = 'note' AND l.action = 'update' AND l.target_id = s.id
       AND l.actor_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     ORDER BY l.created_at DESC
     LIMIT 1),
    CASE WHEN s.created_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN s.created_by::uuid END
  ) AS user_id
) owner
WHERE COALESCE(s.special_note, '') <> ''
  AND owner.user_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = owner.user_id)
ON CONFLICT (user_id, store_id) DO NOTHING;

-- Eski ortak alan kaldırılır (liste görünümü s.* ile bağlı olduğu için yeniden oluşturulur)
DROP VIEW IF EXISTS public.stores_list;
ALTER TABLE public.stores DROP COLUMN IF EXISTS special_note;

CREATE VIEW public.stores_list
WITH (security_invoker = true) AS
SELECT
	s.*,
	(s.architectural_approved::int + s.mechanical_approved::int + s.electrical_approved::int)
		AS approval_count,
	NOT (s.architectural_approved AND s.mechanical_approved AND s.electrical_approved)
		AS pending_approval
FROM public.stores s;

REVOKE ALL ON public.stores_list FROM anon;
GRANT SELECT ON public.stores_list TO authenticated;

NOTIFY pgrst, 'reload schema';

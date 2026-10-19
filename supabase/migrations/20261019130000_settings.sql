-- Ayarlar: firma ayarları (admin) ve kullanıcı tercihleri

-- 1. Firma ayarları. Güncelleme mevcut organizations_update policy'siyle
--    yalnızca firmanın admin'ine açıktır.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Kullanıcı tercihleri: profiles yerine ayrı tablo; kullanıcı yalnızca
--    kendi satırını okur/yazar (rol ve yetki alanlarına dokunamaz).
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  dismissed_notifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_preferences_own ON public.user_preferences;
CREATE POLICY user_preferences_own ON public.user_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 3. Ekip sohbeti: saklama süresi (1-30 gün, varsayılan 3) ve dosya paylaşımı
--    firma ayarından okunur.
CREATE OR REPLACE FUNCTION public.team_retention_days(p_org uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT LEAST(GREATEST((o.settings->'team'->>'retentionDays')::int, 1), 30)
     FROM public.organizations o
     WHERE o.id = p_org
       AND (o.settings->'team'->>'retentionDays') ~ '^\d+$'),
    3);
$$;

CREATE OR REPLACE FUNCTION public.team_file_sharing_enabled(p_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (o.settings->'team'->>'fileSharing')::boolean
     FROM public.organizations o WHERE o.id = p_org),
    true);
$$;

REVOKE ALL ON FUNCTION public.team_retention_days(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.team_file_sharing_enabled(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.team_retention_days(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_file_sharing_enabled(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS team_messages_select ON public.team_messages;
CREATE POLICY team_messages_select ON public.team_messages
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (sender_id = auth.uid() OR recipient_id = auth.uid())
    AND created_at > now() - make_interval(days => public.team_retention_days(organization_id))
  );

DROP POLICY IF EXISTS team_messages_insert ON public.team_messages;
CREATE POLICY team_messages_insert ON public.team_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND organization_id = public.current_organization_id()
    AND read_at IS NULL
    AND (attachment_path IS NULL OR public.team_file_sharing_enabled(organization_id))
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = recipient_id
        AND p.organization_id = public.current_organization_id()
    )
  );

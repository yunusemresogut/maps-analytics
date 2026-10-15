-- Ekip: organizasyon içi birebir mesajlaşma ve dosya paylaşımı.
-- Mesajlar en fazla 3 gün saklanır: 3 günden eski kayıtlar RLS ile anında
-- görünmez olur, /api/team/cleanup da kayıtları ve dosyalarını kalıcı siler.

CREATE TABLE IF NOT EXISTS public.team_messages (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	organization_id uuid NOT NULL DEFAULT public.current_organization_id()
		REFERENCES public.organizations(id) ON DELETE CASCADE,
	sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
	recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
	body text NOT NULL DEFAULT '',
	attachment_path text,
	attachment_name text,
	attachment_size bigint,
	attachment_type text,
	created_at timestamptz NOT NULL DEFAULT now(),
	read_at timestamptz,
	CONSTRAINT team_messages_not_self CHECK (sender_id <> recipient_id),
	CONSTRAINT team_messages_body_length CHECK (char_length(body) <= 4000),
	CONSTRAINT team_messages_has_content CHECK (char_length(body) > 0 OR attachment_path IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS team_messages_recipient_unread_idx
	ON public.team_messages (recipient_id, sender_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS team_messages_pair_idx
	ON public.team_messages (sender_id, recipient_id, created_at);
CREATE INDEX IF NOT EXISTS team_messages_created_at_idx
	ON public.team_messages (organization_id, created_at);

ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;

-- Yalnızca sohbetin tarafları, kendi firmasında ve son 3 gün içinde görür
DROP POLICY IF EXISTS team_messages_select ON public.team_messages;
CREATE POLICY team_messages_select ON public.team_messages
	FOR SELECT TO authenticated
	USING (
		organization_id = public.current_organization_id()
		AND (sender_id = auth.uid() OR recipient_id = auth.uid())
		AND created_at > now() - interval '3 days'
	);

-- Yalnızca kendi adına, kendi firmasındaki birine gönderebilir
DROP POLICY IF EXISTS team_messages_insert ON public.team_messages;
CREATE POLICY team_messages_insert ON public.team_messages
	FOR INSERT TO authenticated
	WITH CHECK (
		sender_id = auth.uid()
		AND organization_id = public.current_organization_id()
		AND read_at IS NULL
		AND EXISTS (
			SELECT 1 FROM public.profiles p
			WHERE p.id = recipient_id
				AND p.organization_id = public.current_organization_id()
		)
	);

-- UPDATE/DELETE policy yok: okundu işareti aşağıdaki fonksiyonla, silme
-- dosyaları da temizleyen sunucu route'u (service role) ile yapılır.

CREATE OR REPLACE FUNCTION public.mark_team_messages_read(p_sender uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
	UPDATE public.team_messages
	SET read_at = now()
	WHERE recipient_id = auth.uid()
		AND sender_id = p_sender
		AND read_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.mark_team_messages_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_team_messages_read(uuid) TO authenticated;

-- Canlı mesaj ve okunmamış rozetleri için Realtime
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_publication_tables
		WHERE pubname = 'supabase_realtime'
			AND schemaname = 'public'
			AND tablename = 'team_messages'
	) THEN
		ALTER PUBLICATION supabase_realtime ADD TABLE public.team_messages;
	END IF;
END;
$$;

-- Dosyalar: özel bucket, yol = {organization_id}/{gönderen}/{uuid}-{dosya}
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('team-files', 'team-files', false, 10485760)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS team_files_insert ON storage.objects;
CREATE POLICY team_files_insert ON storage.objects
	FOR INSERT TO authenticated
	WITH CHECK (
		bucket_id = 'team-files'
		AND (storage.foldername(name))[1] = public.current_organization_id()::text
		AND (storage.foldername(name))[2] = auth.uid()::text
	);

-- Dosyayı yalnızca ilgili mesajın tarafları açabilir
DROP POLICY IF EXISTS team_files_select ON storage.objects;
CREATE POLICY team_files_select ON storage.objects
	FOR SELECT TO authenticated
	USING (
		bucket_id = 'team-files'
		AND EXISTS (
			SELECT 1 FROM public.team_messages m
			WHERE m.attachment_path = storage.objects.name
				AND (m.sender_id = auth.uid() OR m.recipient_id = auth.uid())
		)
	);

-- Gönderim başarısız olursa yükleyen kendi dosyasını geri alabilir
DROP POLICY IF EXISTS team_files_delete_own ON storage.objects;
CREATE POLICY team_files_delete_own ON storage.objects
	FOR DELETE TO authenticated
	USING (
		bucket_id = 'team-files'
		AND (storage.foldername(name))[2] = auth.uid()::text
	);

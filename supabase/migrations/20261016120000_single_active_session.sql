-- Tek aktif oturum: bir hesaba yeni giriş yapılınca istemci diğer oturumları
-- iptal eder (auth.sessions satırları silinir). Eski cihazın access token'ı
-- süresi dolana kadar imza olarak geçerli kalır; bu kontrol her PostgREST
-- isteğinden önce çalışıp silinmiş oturumdan gelen istekleri 401 ile reddeder.

CREATE OR REPLACE FUNCTION public.enforce_active_session()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
	claims text := current_setting('request.jwt.claims', true);
	sid text;
BEGIN
	IF claims IS NULL OR claims = '' THEN
		RETURN;
	END IF;

	-- anon ve service_role token'larında session_id yoktur
	sid := claims::jsonb ->> 'session_id';
	IF sid IS NULL OR sid = '' THEN
		RETURN;
	END IF;

	IF NOT EXISTS (SELECT 1 FROM auth.sessions WHERE id = sid::uuid) THEN
		RAISE SQLSTATE 'PGRST' USING
			MESSAGE = json_build_object(
				'code', 'session_revoked',
				'message', 'Bu hesaba başka bir yerden giriş yapıldığı için oturum sonlandırıldı.'
			)::text,
			DETAIL = json_build_object('status', 401, 'headers', json_build_object())::text;
	END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_active_session() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_active_session() TO anon, authenticated, service_role;

ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.enforce_active_session';
NOTIFY pgrst, 'reload config';

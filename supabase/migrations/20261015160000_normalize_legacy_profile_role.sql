-- auth.users üzerindeki eski "yeni kullanıcı" tetikleyicisi profiles satırını
-- hâlâ role = 'user' ile ekliyor. RBAC migration'ı (20260411) bu değeri
-- profiles_role_check'ten kaldırdığı için kullanıcı oluşturma (kayıt ve admin
-- panelinden kullanıcı ekleme) "Database error creating new user" ile düşüyor.
-- Tetikleyici adından bağımsız olarak eski değeri uygulama varsayılanına çevir.
CREATE OR REPLACE FUNCTION public.normalize_legacy_profile_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF NEW.role IS NULL OR NEW.role = 'user' THEN
		NEW.role := 'manager';
	END IF;
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_normalize_legacy_role ON public.profiles;

CREATE TRIGGER profiles_normalize_legacy_role
	BEFORE INSERT OR UPDATE OF role ON public.profiles
	FOR EACH ROW
	EXECUTE FUNCTION public.normalize_legacy_profile_role();

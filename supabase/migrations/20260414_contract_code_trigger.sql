-- Otomatik sözleşme kodu (SZ-0001 formatı)
CREATE OR REPLACE FUNCTION public.generate_contract_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  seq int;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    SELECT COUNT(*) + 1 INTO seq
    FROM public.contracts
    WHERE organization_id = NEW.organization_id;
    NEW.code := 'SZ-' || LPAD(seq::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contracts_set_code ON public.contracts;
CREATE TRIGGER contracts_set_code
  BEFORE INSERT ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_contract_code();

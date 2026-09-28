-- Modül genişletmeleri: kod alanları, ekler, sözleşme-hakediş-fatura zinciri, rol etiketleri
-- Supabase SQL Editor'da çalıştırın veya CLI ile uygulayın.

-- 1. Organizasyon: rol görünen adları
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS role_labels jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Ticket kod + ekler
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS code text;

CREATE TABLE IF NOT EXISTS public.ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  size bigint NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT '',
  storage_path text NOT NULL,
  uploaded_by uuid NOT NULL,
  uploaded_by_name text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Sözleşme kod + fesih/tamamlanma + ekler
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS code text;

-- status: draft | active | expired | cancelled | terminated | completed
COMMENT ON COLUMN public.contracts.status IS 'draft, active, expired, cancelled, terminated, completed';

CREATE TABLE IF NOT EXISTS public.contract_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  size bigint NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT '',
  storage_path text NOT NULL,
  uploaded_by uuid NOT NULL,
  uploaded_by_name text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Hakediş → sözleşme bağlantısı
ALTER TABLE public.progress_payments
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL;

-- 5. Otomatik ticket kodu (opsiyonel trigger)
CREATE OR REPLACE FUNCTION public.generate_ticket_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  seq int;
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    SELECT COUNT(*) + 1 INTO seq
    FROM public.tickets
    WHERE organization_id = NEW.organization_id;
    NEW.code := 'TT-' || LPAD(seq::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tickets_set_code ON public.tickets;
CREATE TRIGGER tickets_set_code
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_ticket_code();

-- 6. RLS — ekler tabloları
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ticket_attachments_all ON public.ticket_attachments;
CREATE POLICY ticket_attachments_all ON public.ticket_attachments
  FOR ALL USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS contract_attachments_all ON public.contract_attachments;
CREATE POLICY contract_attachments_all ON public.contract_attachments
  FOR ALL USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());

-- 7. Storage bucket (Supabase Dashboard'dan da oluşturulabilir):
-- insert into storage.buckets (id, name, public) values ('module-files', 'module-files', false);

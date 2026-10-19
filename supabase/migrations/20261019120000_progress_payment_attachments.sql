-- Hakediş ekleri: ticket ve sözleşme ekleriyle aynı yapı, aynı module-files bucket'ı
CREATE TABLE IF NOT EXISTS public.progress_payment_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  progress_payment_id uuid NOT NULL REFERENCES public.progress_payments(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  size bigint NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT '',
  storage_path text NOT NULL,
  uploaded_by uuid NOT NULL,
  uploaded_by_name text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS progress_payment_attachments_payment_idx
  ON public.progress_payment_attachments (progress_payment_id);

ALTER TABLE public.progress_payment_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS progress_payment_attachments_all ON public.progress_payment_attachments;
CREATE POLICY progress_payment_attachments_all ON public.progress_payment_attachments
  FOR ALL USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());

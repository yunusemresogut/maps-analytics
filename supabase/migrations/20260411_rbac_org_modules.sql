-- Maps Analytics: organizations, roles, approvals, CRUD modules
-- Apply in Supabase SQL editor or via CLI

-- 1. Organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tax_number text,
  authorized_person text,
  phone text,
  address text,
  avatar_url text,
  role_permission_defaults jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS role_permission_defaults jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Profiles extensions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- Drop legacy role check BEFORE migrating values (old constraint only allows admin|user)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Migrate legacy role 'user' -> 'manager'
UPDATE public.profiles SET role = 'manager' WHERE role = 'user';

-- Allow all application roles
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (
    role = ANY (
      ARRAY[
        'admin'::text,
        'mechanical_engineer'::text,
        'electrical_engineer'::text,
        'architect'::text,
        'civil_engineer'::text,
        'manager'::text,
        'regional_manager'::text,
        'store_manager'::text,
        'accounting'::text
      ]
    )
  );

-- 3. Stores: org + approval fields
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS architectural_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS architectural_approved_by uuid,
  ADD COLUMN IF NOT EXISTS architectural_approved_by_name text,
  ADD COLUMN IF NOT EXISTS architectural_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS mechanical_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mechanical_approved_by uuid,
  ADD COLUMN IF NOT EXISTS mechanical_approved_by_name text,
  ADD COLUMN IF NOT EXISTS mechanical_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS electrical_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS electrical_approved_by uuid,
  ADD COLUMN IF NOT EXISTS electrical_approved_by_name text,
  ADD COLUMN IF NOT EXISTS electrical_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS project_opened boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS project_opened_by uuid,
  ADD COLUMN IF NOT EXISTS project_opened_by_name text,
  ADD COLUMN IF NOT EXISTS project_opened_at timestamptz;

-- 4. Tickets
CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id text REFERENCES public.stores(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  assignee_id uuid,
  assignee_name text,
  created_by uuid NOT NULL,
  created_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_by_name text,
  updated_at timestamptz
);

-- 5. Contracts
CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id text REFERENCES public.stores(id) ON DELETE SET NULL,
  title text NOT NULL,
  party_name text NOT NULL DEFAULT '',
  start_date date,
  end_date date,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  file_url text,
  created_by uuid NOT NULL,
  created_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_by_name text,
  updated_at timestamptz
);

-- 6. Progress payments (hakediş)
CREATE TABLE IF NOT EXISTS public.progress_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id text REFERENCES public.stores(id) ON DELETE SET NULL,
  title text NOT NULL,
  period_label text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL,
  created_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_by_name text,
  updated_at timestamptz
);

-- 7. Invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  store_id text REFERENCES public.stores(id) ON DELETE SET NULL,
  progress_payment_id uuid REFERENCES public.progress_payments(id) ON DELETE SET NULL,
  invoice_number text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  issued_at date,
  created_by uuid NOT NULL,
  created_by_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_by_name text,
  updated_at timestamptz
);

-- 8. Helper: current user's organization
CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid();
$$;

-- 9. RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_select ON public.organizations;
CREATE POLICY organizations_select ON public.organizations
  FOR SELECT USING (id = public.current_organization_id());

DROP POLICY IF EXISTS organizations_update ON public.organizations;
CREATE POLICY organizations_update ON public.organizations
  FOR UPDATE USING (
    id = public.current_organization_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS tickets_all ON public.tickets;
CREATE POLICY tickets_all ON public.tickets
  FOR ALL USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS contracts_all ON public.contracts;
CREATE POLICY contracts_all ON public.contracts
  FOR ALL USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS progress_payments_all ON public.progress_payments;
CREATE POLICY progress_payments_all ON public.progress_payments
  FOR ALL USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS invoices_all ON public.invoices;
CREATE POLICY invoices_all ON public.invoices
  FOR ALL USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());

-- Storage bucket for avatars (run separately if needed):
-- insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);

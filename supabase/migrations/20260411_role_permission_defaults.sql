-- Organization-level editable role permission templates
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS role_permission_defaults jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.organizations.role_permission_defaults IS
  'Per-role PermissionMatrix overrides. Keys are UserRole (except admin). Empty = use built-in code defaults.';

-- check_user_permission: flat (legacy) + modül matrisi (map.edit vb.) destekler
CREATE OR REPLACE FUNCTION public.check_user_permission(user_id uuid, perm text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_restricted boolean;
  v_permissions jsonb;
  v_flat boolean;
  v_module text;
  v_module_perm boolean;
BEGIN
  SELECT role, restricted, permissions
  INTO v_role, v_restricted, v_permissions
  FROM public.profiles
  WHERE id = user_id;

  IF NOT FOUND OR v_restricted THEN
    RETURN false;
  END IF;

  IF v_role = 'admin' THEN
    RETURN true;
  END IF;

  -- Legacy düz izinler: { "edit": true, "add": true, ... }
  v_flat := (v_permissions->>perm)::boolean;
  IF COALESCE(v_flat, false) THEN
    RETURN true;
  END IF;

  -- Modül matrisi: { "map": { "edit": true }, "stores": { ... } }
  IF jsonb_typeof(v_permissions) = 'object' THEN
    FOR v_module IN SELECT jsonb_object_keys(v_permissions)
    LOOP
      IF jsonb_typeof(v_permissions->v_module) = 'object' THEN
        v_module_perm := (v_permissions->v_module->>perm)::boolean;
        IF COALESCE(v_module_perm, false) THEN
          RETURN true;
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN false;
END;
$$;

-- UPDATE policy'lere WITH CHECK ekle (stores + store_* tabloları)
DROP POLICY IF EXISTS "Allow update stores based on permission" ON public.stores;
CREATE POLICY "Allow update stores based on permission"
  ON public.stores
  FOR UPDATE
  TO authenticated
  USING (check_user_permission(auth.uid(), 'edit'))
  WITH CHECK (check_user_permission(auth.uid(), 'edit'));

DROP POLICY IF EXISTS "Allow update materials based on permission" ON public.store_materials;
CREATE POLICY "Allow update materials based on permission"
  ON public.store_materials
  FOR UPDATE
  TO authenticated
  USING (check_user_permission(auth.uid(), 'edit'))
  WITH CHECK (check_user_permission(auth.uid(), 'edit'));

DROP POLICY IF EXISTS "Allow update work plan based on permission" ON public.store_work_plan;
CREATE POLICY "Allow update work plan based on permission"
  ON public.store_work_plan
  FOR UPDATE
  TO authenticated
  USING (check_user_permission(auth.uid(), 'edit'))
  WITH CHECK (check_user_permission(auth.uid(), 'edit'));

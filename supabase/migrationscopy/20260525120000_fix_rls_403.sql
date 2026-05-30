-- Fix 403 errors: restore EXECUTE on has_role for authenticated users
-- The previous migration revoked it too aggressively

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- Ensure user_roles SELECT policy works (needed for admin check in _authenticated layout)
-- A user should always be able to read their own roles
DROP POLICY IF EXISTS "View own roles" ON public.user_roles;
CREATE POLICY "View own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can see all roles
DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;
CREATE POLICY "Admins view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for reading admin_tenants links
-- Ensure superadmins can read all links and admins can read their own

BEGIN;

-- Superadmin: full read access on admin_tenants
CREATE POLICY "Superadmins can view all admin_tenants"
ON public.admin_tenants
FOR SELECT
USING (
  public.user_role() = 'superadmin'
);

-- Admin: read only own links (by matching auth.uid() to the user owning the link)
CREATE POLICY "Admins can view their admin_tenants"
ON public.admin_tenants
FOR SELECT
USING (
  public.user_role() = 'admin'
  AND EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = admin_tenants.user_id
      AND u.auth_user_id = auth.uid()
  )
);

COMMIT;
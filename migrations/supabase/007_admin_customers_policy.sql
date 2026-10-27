-- ==============================================================================
-- VivPay — Migration 007: Grant Administrator Visibility to Customers Table
-- File: migrations/supabase/007_admin_customers_policy.sql
-- ==============================================================================
-- Allows authenticated system administrators (where public.is_admin() = true)
-- to view all registered customer accounts in public.customers for user management
-- and staff provisioning in the Admin Portal.
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'customers' AND policyname = 'Admins can view all customer profiles'
    ) THEN
        CREATE POLICY "Admins can view all customer profiles"
            ON public.customers FOR SELECT
            USING (public.is_admin());
    END IF;
END $$;

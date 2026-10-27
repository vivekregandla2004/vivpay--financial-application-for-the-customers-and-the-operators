-- ==============================================================================
-- VivPay — Migration 006: Reconcile Missing Modules, Views, and Security Hardening
-- File: migrations/supabase/006_reconcile_missing_modules.sql
-- ==============================================================================
-- Final audited version addressing:
-- 1. Explicit authorization in match_document_chunks (eliminates current_user check)
-- 2. Non-recursive group_members UPDATE policy using SECURITY DEFINER role accessor
-- 3. Hardened SECURITY DEFINER functions with search_path, input validation, and restricted grants
-- 4. Non-destructive reconciliation for views/tables (preserves existing data)
-- 5. Complete TypeScript repository compatibility for expense_splits and document_embeddings
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Helper Functions & Security Definer Infrastructure
-- ------------------------------------------------------------------------------

-- Ensure handle_updated_at trigger function exists with safe search path
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

-- Secure is_group_member helper function
CREATE OR REPLACE FUNCTION public.is_group_member(lookup_group_id UUID, user_id UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER 
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
    IF lookup_group_id IS NULL OR user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = lookup_group_id AND customer_id = user_id
    );
END;
$$;

ALTER FUNCTION public.is_group_member(UUID, UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_group_member(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_group_member(UUID, UUID) TO authenticated, service_role;

-- Secure is_group_admin helper function
CREATE OR REPLACE FUNCTION public.is_group_admin(lookup_group_id UUID, user_id UUID)
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER 
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
    IF lookup_group_id IS NULL OR user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.collaborative_groups cg
        WHERE cg.id = lookup_group_id AND cg.created_by = user_id
    ) OR EXISTS (
        SELECT 1 FROM public.group_members gm
        WHERE gm.group_id = lookup_group_id AND gm.customer_id = user_id AND gm.role = 'admin'
    );
END;
$$;

ALTER FUNCTION public.is_group_admin(UUID, UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_group_admin(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_group_admin(UUID, UUID) TO authenticated, service_role;

-- Secure get_member_role helper function (prevents RLS recursion when validating role changes)
CREATE OR REPLACE FUNCTION public.get_member_role(p_group_id UUID, p_customer_id UUID)
RETURNS VARCHAR(16)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    m_role VARCHAR(16);
BEGIN
    IF p_group_id IS NULL OR p_customer_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT role INTO m_role
    FROM public.group_members
    WHERE group_id = p_group_id AND customer_id = p_customer_id;

    RETURN m_role;
END;
$$;

ALTER FUNCTION public.get_member_role(UUID, UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_member_role(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_member_role(UUID, UUID) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 2. Non-Destructive Reconciliation: Compatibility Views & Tables
-- ------------------------------------------------------------------------------

-- Reconciliation for financial_identities:
-- If view or non-existent, create/replace view with security_invoker.
-- If existing base table, preserve table and reconcile missing columns.
DO $$
DECLARE
    tbl_type text;
BEGIN
    SELECT table_type INTO tbl_type
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'financial_identities';

    IF tbl_type IS NULL OR tbl_type = 'VIEW' THEN
        CREATE OR REPLACE VIEW public.financial_identities 
        WITH (security_invoker = true) AS
        SELECT 
            customer_id,
            personal,
            employment,
            income,
            commitments,
            risk,
            behavior,
            health,
            completeness,
            timeline,
            created_at,
            updated_at
        FROM public.customer_identities;

        GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_identities TO authenticated, service_role;
    ELSIF tbl_type = 'BASE TABLE' THEN
        RAISE NOTICE 'Base table public.financial_identities exists. Preserving table and ensuring required columns.';
        ALTER TABLE public.financial_identities ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE;
        ALTER TABLE public.financial_identities ADD COLUMN IF NOT EXISTS personal JSONB NOT NULL DEFAULT '{}'::jsonb;
        ALTER TABLE public.financial_identities ADD COLUMN IF NOT EXISTS employment JSONB NOT NULL DEFAULT '{}'::jsonb;
        ALTER TABLE public.financial_identities ADD COLUMN IF NOT EXISTS income JSONB NOT NULL DEFAULT '{}'::jsonb;
        ALTER TABLE public.financial_identities ADD COLUMN IF NOT EXISTS commitments JSONB NOT NULL DEFAULT '{}'::jsonb;
        ALTER TABLE public.financial_identities ADD COLUMN IF NOT EXISTS risk JSONB NOT NULL DEFAULT '{}'::jsonb;
        ALTER TABLE public.financial_identities ADD COLUMN IF NOT EXISTS behavior JSONB NOT NULL DEFAULT '{}'::jsonb;
        ALTER TABLE public.financial_identities ADD COLUMN IF NOT EXISTS health JSONB NOT NULL DEFAULT '{}'::jsonb;
        ALTER TABLE public.financial_identities ADD COLUMN IF NOT EXISTS completeness JSONB NOT NULL DEFAULT '{}'::jsonb;
        ALTER TABLE public.financial_identities ADD COLUMN IF NOT EXISTS timeline JSONB NOT NULL DEFAULT '[]'::jsonb;
        ALTER TABLE public.financial_identities ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
        ALTER TABLE public.financial_identities ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
        ALTER TABLE public.financial_identities ENABLE ROW LEVEL SECURITY;
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_identities TO authenticated, service_role;
    END IF;
END $$;

-- Reconciliation for groups:
DO $$
DECLARE
    tbl_type text;
BEGIN
    SELECT table_type INTO tbl_type
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'groups';

    IF tbl_type IS NULL OR tbl_type = 'VIEW' THEN
        CREATE OR REPLACE VIEW public.groups 
        WITH (security_invoker = true) AS
        SELECT 
            id,
            name,
            description,
            created_by,
            created_at,
            updated_at
        FROM public.collaborative_groups;

        GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated, service_role;
    ELSIF tbl_type = 'BASE TABLE' THEN
        RAISE NOTICE 'Base table public.groups exists. Preserving table and ensuring required columns.';
        ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT gen_random_uuid();
        ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Group';
        ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS description TEXT;
        ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.customers(id) ON DELETE CASCADE;
        ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
        ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
        ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated, service_role;
    END IF;
END $$;

-- Reconciliation for document_embeddings:
DO $$
DECLARE
    tbl_type text;
BEGIN
    SELECT table_type INTO tbl_type
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'document_embeddings';

    IF tbl_type IS NULL OR tbl_type = 'VIEW' THEN
        CREATE OR REPLACE VIEW public.document_embeddings 
        WITH (security_invoker = true) AS
        SELECT 
            id,
            document_id,
            customer_id,
            chunk_index,
            title,
            content,
            metadata,
            embedding,
            created_at
        FROM public.document_chunks;

        REVOKE ALL ON public.document_embeddings FROM anon;
        GRANT SELECT ON public.document_embeddings TO authenticated, service_role;
    ELSIF tbl_type = 'BASE TABLE' THEN
        RAISE NOTICE 'Base table public.document_embeddings exists. Preserving table and ensuring required columns.';
        ALTER TABLE public.document_embeddings ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT gen_random_uuid();
        ALTER TABLE public.document_embeddings ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES public.statement_documents(id) ON DELETE CASCADE;
        ALTER TABLE public.document_embeddings ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE;
        ALTER TABLE public.document_embeddings ADD COLUMN IF NOT EXISTS chunk_index INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE public.document_embeddings ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
        ALTER TABLE public.document_embeddings ADD COLUMN IF NOT EXISTS content TEXT NOT NULL DEFAULT '';
        ALTER TABLE public.document_embeddings ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
        ALTER TABLE public.document_embeddings ADD COLUMN IF NOT EXISTS embedding vector(768);
        ALTER TABLE public.document_embeddings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
        ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;
        GRANT SELECT ON public.document_embeddings TO authenticated, service_role;
    END IF;
END $$;

-- Reconciliation for expense_splits:
-- Provides deterministic row ID, expense_id, group_id, customer_id, amount, share, and parent expense details
DO $$
DECLARE
    tbl_type text;
BEGIN
    SELECT table_type INTO tbl_type
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'expense_splits';

    IF tbl_type IS NULL OR tbl_type = 'VIEW' THEN
        CREATE OR REPLACE VIEW public.expense_splits 
        WITH (security_invoker = true) AS
        SELECT 
            md5(se.id::text || '_' || (split_elem->>'customerId'))::uuid AS id,
            se.id AS expense_id,
            se.group_id,
            (split_elem->>'customerId')::UUID AS customer_id,
            (split_elem->>'amount')::NUMERIC(14, 2) AS amount,
            (split_elem->>'share')::NUMERIC(8, 4) AS share,
            se.paid_by,
            se.split_type,
            se.category,
            se.date,
            se.is_settled,
            se.created_at
        FROM public.shared_expenses se,
        LATERAL jsonb_array_elements(se.splits) AS split_elem;

        REVOKE ALL ON public.expense_splits FROM anon;
        GRANT SELECT ON public.expense_splits TO authenticated, service_role;
    ELSIF tbl_type = 'BASE TABLE' THEN
        RAISE NOTICE 'Base table public.expense_splits exists. Preserving table and ensuring required columns.';
        ALTER TABLE public.expense_splits ADD COLUMN IF NOT EXISTS id UUID PRIMARY KEY DEFAULT gen_random_uuid();
        ALTER TABLE public.expense_splits ADD COLUMN IF NOT EXISTS expense_id UUID REFERENCES public.shared_expenses(id) ON DELETE CASCADE;
        ALTER TABLE public.expense_splits ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.collaborative_groups(id) ON DELETE CASCADE;
        ALTER TABLE public.expense_splits ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE;
        ALTER TABLE public.expense_splits ADD COLUMN IF NOT EXISTS amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00;
        ALTER TABLE public.expense_splits ADD COLUMN IF NOT EXISTS share NUMERIC(8, 4);
        ALTER TABLE public.expense_splits ADD COLUMN IF NOT EXISTS is_settled BOOLEAN NOT NULL DEFAULT false;
        ALTER TABLE public.expense_splits ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
        ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;
        GRANT SELECT ON public.expense_splits TO authenticated, service_role;
    END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 3. Granular Tables: goal_milestones, recurring_commitments, settlements
-- ------------------------------------------------------------------------------

-- Goal Milestones Table: Granular progress checkpoints for Financial Goals
CREATE TABLE IF NOT EXISTS public.goal_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL REFERENCES public.financial_goals(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_amount NUMERIC(14, 2) NOT NULL CHECK (target_amount > 0),
    target_date DATE,
    is_achieved BOOLEAN NOT NULL DEFAULT false,
    achieved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_milestones_goal_id ON public.goal_milestones(goal_id);
CREATE INDEX IF NOT EXISTS idx_milestones_customer_id ON public.goal_milestones(customer_id);

ALTER TABLE public.goal_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view their own goal milestones" ON public.goal_milestones;
CREATE POLICY "Customers can view their own goal milestones"
    ON public.goal_milestones FOR SELECT
    USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can insert their own goal milestones" ON public.goal_milestones;
CREATE POLICY "Customers can insert their own goal milestones"
    ON public.goal_milestones FOR INSERT
    WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can update their own goal milestones" ON public.goal_milestones;
CREATE POLICY "Customers can update their own goal milestones"
    ON public.goal_milestones FOR UPDATE
    USING (auth.uid() = customer_id)
    WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can delete their own goal milestones" ON public.goal_milestones;
CREATE POLICY "Customers can delete their own goal milestones"
    ON public.goal_milestones FOR DELETE
    USING (auth.uid() = customer_id);

DROP TRIGGER IF EXISTS trg_goal_milestones_updated_at ON public.goal_milestones;
CREATE TRIGGER trg_goal_milestones_updated_at
    BEFORE UPDATE ON public.goal_milestones
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

REVOKE ALL ON public.goal_milestones FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_milestones TO authenticated, service_role;


-- Recurring Commitments Table: Explicit tracking for EMIs, rent, SIPs, utilities
CREATE TABLE IF NOT EXISTS public.recurring_commitments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    category VARCHAR(32) NOT NULL CHECK (category IN ('rent', 'home_loan', 'vehicle_loan', 'personal_loan', 'credit_card', 'sip', 'insurance', 'utility', 'subscription', 'other')),
    description TEXT NOT NULL,
    expected_amount NUMERIC(14, 2) NOT NULL CHECK (expected_amount >= 0),
    frequency VARCHAR(16) NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
    due_day INTEGER CHECK (due_day >= 1 AND due_day <= 31),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_commitments_customer_id ON public.recurring_commitments(customer_id);
CREATE INDEX IF NOT EXISTS idx_commitments_category ON public.recurring_commitments(category);

ALTER TABLE public.recurring_commitments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view their own commitments" ON public.recurring_commitments;
CREATE POLICY "Customers can view their own commitments"
    ON public.recurring_commitments FOR SELECT
    USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can insert their own commitments" ON public.recurring_commitments;
CREATE POLICY "Customers can insert their own commitments"
    ON public.recurring_commitments FOR INSERT
    WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can update their own commitments" ON public.recurring_commitments;
CREATE POLICY "Customers can update their own commitments"
    ON public.recurring_commitments FOR UPDATE
    USING (auth.uid() = customer_id)
    WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can delete their own commitments" ON public.recurring_commitments;
CREATE POLICY "Customers can delete their own commitments"
    ON public.recurring_commitments FOR DELETE
    USING (auth.uid() = customer_id);

DROP TRIGGER IF EXISTS trg_recurring_commitments_updated_at ON public.recurring_commitments;
CREATE TRIGGER trg_recurring_commitments_updated_at
    BEFORE UPDATE ON public.recurring_commitments
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

REVOKE ALL ON public.recurring_commitments FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_commitments TO authenticated, service_role;


-- Settlements Table: Records executed debt-minimizing transfers between group members
CREATE TABLE IF NOT EXISTS public.settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.collaborative_groups(id) ON DELETE CASCADE,
    from_customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    to_customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
    settled_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_settlements_group_id ON public.settlements(group_id);
CREATE INDEX IF NOT EXISTS idx_settlements_from_customer ON public.settlements(from_customer_id);
CREATE INDEX IF NOT EXISTS idx_settlements_to_customer ON public.settlements(to_customer_id);

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members can view settlements" ON public.settlements;
CREATE POLICY "Group members can view settlements"
    ON public.settlements FOR SELECT
    USING (public.is_group_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Debtors or group admins can record settlements" ON public.settlements;
CREATE POLICY "Debtors or group admins can record settlements"
    ON public.settlements FOR INSERT
    WITH CHECK (
        public.is_group_member(group_id, auth.uid()) AND
        (auth.uid() = from_customer_id OR public.is_group_admin(group_id, auth.uid()))
    );

DROP POLICY IF EXISTS "Debtors, recipients, or group admins can update settlements" ON public.settlements;
CREATE POLICY "Debtors, recipients, or group admins can update settlements"
    ON public.settlements FOR UPDATE
    USING (
        auth.uid() = from_customer_id OR 
        auth.uid() = to_customer_id OR 
        public.is_group_admin(group_id, auth.uid())
    );

REVOKE ALL ON public.settlements FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlements TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 4. Group Member RLS Hardening: Fix Privilege Escalation & Prevent RLS Recursion
-- ------------------------------------------------------------------------------

-- INSERT Policy: Group admins can add any member; self-join restricted strictly to 'member' role
DROP POLICY IF EXISTS "Group admins or self can add group members" ON public.group_members;
CREATE POLICY "Group admins or self can add group members"
    ON public.group_members FOR INSERT
    WITH CHECK (
        public.is_group_admin(group_id, auth.uid()) OR
        (customer_id = auth.uid() AND role = 'member')
    );

-- UPDATE Policy: Avoids recursion by using SECURITY DEFINER public.get_member_role()
-- Group admins can update member roles; ordinary members can only update their own visibility
DROP POLICY IF EXISTS "Users can update their own visibility or admins can update member roles" ON public.group_members;
CREATE POLICY "Users can update their own visibility or admins can update member roles"
    ON public.group_members FOR UPDATE
    USING (
        customer_id = auth.uid() OR public.is_group_admin(group_id, auth.uid())
    )
    WITH CHECK (
        public.is_group_admin(group_id, auth.uid())
        OR
        (customer_id = auth.uid() AND role = public.get_member_role(group_id, auth.uid()))
    );

-- DELETE Policy: Member can remove themselves; group admin can remove any member
DROP POLICY IF EXISTS "Admins or members themselves can remove membership" ON public.group_members;
CREATE POLICY "Admins or members themselves can remove membership"
    ON public.group_members FOR DELETE
    USING (
        customer_id = auth.uid() OR public.is_group_admin(group_id, auth.uid())
    );


-- ------------------------------------------------------------------------------
-- 5. Hardening match_document_chunks RPC
-- Explicit authorization and range validation without relying on current_user
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.match_document_chunks (
    query_embedding vector(768),
    match_threshold float DEFAULT 0.40,
    match_count int DEFAULT 10,
    filter_customer_id uuid DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    document_id uuid,
    customer_id uuid,
    chunk_index int,
    title text,
    content text,
    metadata jsonb,
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    caller_role text := COALESCE(auth.role(), current_setting('request.jwt.claim.role', true), '');
    caller_uid uuid := auth.uid();
    target_customer_id uuid;
BEGIN
    -- 1. Input Validation: Vector and numeric range bounds
    IF query_embedding IS NULL THEN
        RAISE EXCEPTION 'query_embedding cannot be null.';
    END IF;

    IF match_threshold IS NULL OR match_threshold < 0.0 OR match_threshold > 1.0 THEN
        RAISE EXCEPTION 'Invalid match_threshold: %. Must be between 0.0 and 1.0.', match_threshold;
    END IF;

    IF match_count IS NULL OR match_count < 1 OR match_count > 100 THEN
        RAISE EXCEPTION 'Invalid match_count: %. Must be an integer between 1 and 100.', match_count;
    END IF;

    -- 2. Explicit Caller Authorization
    -- Route A: Service role (backend server operations)
    IF caller_role = 'service_role' THEN
        IF filter_customer_id IS NULL THEN
            RAISE EXCEPTION 'Service role must specify a non-null filter_customer_id.';
        END IF;
        target_customer_id := filter_customer_id;

    -- Route B: Authenticated end-user (JWT session)
    ELSIF caller_uid IS NOT NULL THEN
        IF filter_customer_id IS NOT NULL AND filter_customer_id <> caller_uid THEN
            RAISE EXCEPTION 'Access denied: Caller % cannot query chunks for customer %.', caller_uid, filter_customer_id;
        END IF;
        target_customer_id := caller_uid;

    -- Route C: Unauthenticated / anonymous caller
    ELSE
        RAISE EXCEPTION 'Authentication required: Anonymous callers cannot query document chunks.';
    END IF;

    -- 3. Scoped Vector Cosine Similarity Search
    RETURN QUERY
    SELECT
        dc.id,
        dc.document_id,
        dc.customer_id,
        dc.chunk_index,
        dc.title,
        dc.content,
        dc.metadata,
        (1 - (dc.embedding <=> query_embedding))::float AS similarity
    FROM public.document_chunks dc
    WHERE dc.customer_id = target_customer_id
      AND (1 - (dc.embedding <=> query_embedding)) >= match_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

ALTER FUNCTION public.match_document_chunks(vector, float, int, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.match_document_chunks(vector, float, int, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.match_document_chunks(vector, float, int, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.match_document_chunks(vector, float, int, uuid) TO authenticated, service_role;

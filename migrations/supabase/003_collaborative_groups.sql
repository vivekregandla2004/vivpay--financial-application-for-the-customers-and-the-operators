-- ==============================================================================
-- VivPay Collaborative Groups & Shared Expenses — Supabase PostgreSQL Schema
-- Migration: 003_collaborative_groups.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Collaborative Groups Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.collaborative_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_groups_created_by ON public.collaborative_groups(created_by);

ALTER TABLE public.collaborative_groups ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. Group Members Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.group_members (
    group_id UUID NOT NULL REFERENCES public.collaborative_groups(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    role VARCHAR(16) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    visibility VARCHAR(32) NOT NULL DEFAULT 'category_only' CHECK (visibility IN ('full', 'category_only', 'total_only', 'hidden')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (group_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_customer_id ON public.group_members(customer_id);

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 3. Shared Expenses Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shared_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES public.collaborative_groups(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    paid_by UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    split_type VARCHAR(16) NOT NULL DEFAULT 'equal' CHECK (split_type IN ('equal', 'custom', 'shares')),
    splits JSONB NOT NULL DEFAULT '[]'::jsonb,
    category TEXT NOT NULL DEFAULT 'General / Other',
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_settled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_shared_expenses_group_id ON public.shared_expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_shared_expenses_paid_by ON public.shared_expenses(paid_by);
CREATE INDEX IF NOT EXISTS idx_shared_expenses_date ON public.shared_expenses(date);

ALTER TABLE public.shared_expenses ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 4. RLS Security Policies for Groups, Members, and Expenses
-- ------------------------------------------------------------------------------

-- Helper security function to check group membership without recursion
CREATE OR REPLACE FUNCTION public.is_group_member(lookup_group_id UUID, user_id UUID)
RETURNS BOOLEAN SECURITY DEFINER STABLE AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.group_members
        WHERE group_id = lookup_group_id AND customer_id = user_id
    );
END;
$$ LANGUAGE plpgsql;

-- Group policies
CREATE POLICY "Users can view groups they are member of"
    ON public.collaborative_groups FOR SELECT
    USING (public.is_group_member(id, auth.uid()));

CREATE POLICY "Users can create collaborative groups"
    ON public.collaborative_groups FOR INSERT
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group creators or admins can update groups"
    ON public.collaborative_groups FOR UPDATE
    USING (
        auth.uid() = created_by OR
        EXISTS (
            SELECT 1 FROM public.group_members
            WHERE group_id = public.collaborative_groups.id
              AND customer_id = auth.uid()
              AND role = 'admin'
        )
    );

CREATE POLICY "Group creators can delete groups"
    ON public.collaborative_groups FOR DELETE
    USING (auth.uid() = created_by);

-- Member policies
CREATE POLICY "Members can view other members in their groups"
    ON public.group_members FOR SELECT
    USING (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Group admins or self can add group members"
    ON public.group_members FOR INSERT
    WITH CHECK (
        customer_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = group_id AND gm.customer_id = auth.uid() AND gm.role = 'admin'
        ) OR
        EXISTS (
            SELECT 1 FROM public.collaborative_groups cg
            WHERE cg.id = group_id AND cg.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can update their own visibility or admins can update member roles"
    ON public.group_members FOR UPDATE
    USING (
        customer_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = group_id AND gm.customer_id = auth.uid() AND gm.role = 'admin'
        )
    );

CREATE POLICY "Admins or members themselves can remove membership"
    ON public.group_members FOR DELETE
    USING (
        customer_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = group_id AND gm.customer_id = auth.uid() AND gm.role = 'admin'
        )
    );

-- Shared expenses policies
CREATE POLICY "Group members can view shared expenses"
    ON public.shared_expenses FOR SELECT
    USING (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Group members can record shared expenses"
    ON public.shared_expenses FOR INSERT
    WITH CHECK (
        public.is_group_member(group_id, auth.uid()) AND
        auth.uid() = paid_by
    );

CREATE POLICY "Expense payer or group admins can update shared expenses"
    ON public.shared_expenses FOR UPDATE
    USING (
        paid_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = shared_expenses.group_id AND gm.customer_id = auth.uid() AND gm.role = 'admin'
        )
    );

CREATE POLICY "Expense payer or group admins can delete shared expenses"
    ON public.shared_expenses FOR DELETE
    USING (
        paid_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.group_members gm
            WHERE gm.group_id = shared_expenses.group_id AND gm.customer_id = auth.uid() AND gm.role = 'admin'
        )
    );

-- Updated_at trigger for groups
DROP TRIGGER IF EXISTS trg_collaborative_groups_updated_at ON public.collaborative_groups;
CREATE TRIGGER trg_collaborative_groups_updated_at
    BEFORE UPDATE ON public.collaborative_groups
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

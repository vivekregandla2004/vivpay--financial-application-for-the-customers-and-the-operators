-- ==============================================================================
-- VivPay Unified User Model & Financial Intelligence — Supabase PostgreSQL Schema
-- Migration: 002_user_model_and_intelligence.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Helper trigger function for automatic updated_at timestamps
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 2. Customer Identities Table (Layer 2: Unified Financial Identity)
-- Stores canonical financial state, behavioral scoring, timeline, and health metrics
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_identities (
    customer_id UUID PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
    personal JSONB NOT NULL DEFAULT '{}'::jsonb,
    employment JSONB NOT NULL DEFAULT '{}'::jsonb,
    income JSONB NOT NULL DEFAULT '{}'::jsonb,
    commitments JSONB NOT NULL DEFAULT '{}'::jsonb,
    risk JSONB NOT NULL DEFAULT '{}'::jsonb,
    behavior JSONB NOT NULL DEFAULT '{}'::jsonb,
    health JSONB NOT NULL DEFAULT '{}'::jsonb,
    completeness JSONB NOT NULL DEFAULT '{}'::jsonb,
    timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_customer_identities_updated ON public.customer_identities(updated_at);

ALTER TABLE public.customer_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their own financial identity"
    ON public.customer_identities FOR SELECT
    USING (auth.uid() = customer_id);

CREATE POLICY "Customers can insert their own financial identity"
    ON public.customer_identities FOR INSERT
    WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can update their own financial identity"
    ON public.customer_identities FOR UPDATE
    USING (auth.uid() = customer_id)
    WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can delete their own financial identity"
    ON public.customer_identities FOR DELETE
    USING (auth.uid() = customer_id);

DROP TRIGGER IF EXISTS trg_customer_identities_updated_at ON public.customer_identities;
CREATE TRIGGER trg_customer_identities_updated_at
    BEFORE UPDATE ON public.customer_identities
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 3. Cognitive AI Profiles Table (Layer 3: Cognitive & Personalization Profile)
-- Stores financial literacy, decision style, biases, anxieties, preferences, and signals
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cognitive_profiles (
    customer_id UUID PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
    interaction_style VARCHAR(32) NOT NULL DEFAULT 'balanced' CHECK (interaction_style IN ('concise', 'detailed', 'analytical', 'coaching', 'balanced')),
    financial_literacy VARCHAR(32) NOT NULL DEFAULT 'intermediate' CHECK (financial_literacy IN ('beginner', 'intermediate', 'advanced', 'expert')),
    decision_making_style VARCHAR(32) NOT NULL DEFAULT 'deliberate' CHECK (decision_making_style IN ('impulsive', 'deliberate', 'risk_averse', 'growth_oriented', 'delegator')),
    cognitive_biases JSONB NOT NULL DEFAULT '[]'::jsonb,
    financial_anxieties JSONB NOT NULL DEFAULT '[]'::jsonb,
    stated_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    topics_to_avoid JSONB NOT NULL DEFAULT '[]'::jsonb,
    confidence_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
    signal_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.cognitive_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their own cognitive profile"
    ON public.cognitive_profiles FOR SELECT
    USING (auth.uid() = customer_id);

CREATE POLICY "Customers can insert their own cognitive profile"
    ON public.cognitive_profiles FOR INSERT
    WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can update their own cognitive profile"
    ON public.cognitive_profiles FOR UPDATE
    USING (auth.uid() = customer_id)
    WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can delete their own cognitive profile"
    ON public.cognitive_profiles FOR DELETE
    USING (auth.uid() = customer_id);

DROP TRIGGER IF EXISTS trg_cognitive_profiles_updated_at ON public.cognitive_profiles;
CREATE TRIGGER trg_cognitive_profiles_updated_at
    BEFORE UPDATE ON public.cognitive_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 4. Financial Goals Table
-- Relational storage of user financial goals for fast indexing, querying, and tracking
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.financial_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_amount NUMERIC(14, 2) NOT NULL CHECK (target_amount > 0),
    current_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (current_amount >= 0),
    target_date DATE NOT NULL,
    category VARCHAR(32) NOT NULL CHECK (category IN ('emergency_fund', 'debt_payoff', 'retirement', 'home_purchase', 'vehicle', 'education', 'vacation', 'custom')),
    priority VARCHAR(16) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    monthly_contribution NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (monthly_contribution >= 0),
    status VARCHAR(16) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'paused', 'abandoned')),
    feasibility_score NUMERIC(5, 2) DEFAULT NULL CHECK (feasibility_score IS NULL OR (feasibility_score >= 0 AND feasibility_score <= 100)),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_financial_goals_customer_id ON public.financial_goals(customer_id);
CREATE INDEX IF NOT EXISTS idx_financial_goals_target_date ON public.financial_goals(target_date);
CREATE INDEX IF NOT EXISTS idx_financial_goals_status ON public.financial_goals(status);

ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their own financial goals"
    ON public.financial_goals FOR SELECT
    USING (auth.uid() = customer_id);

CREATE POLICY "Customers can insert their own financial goals"
    ON public.financial_goals FOR INSERT
    WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can update their own financial goals"
    ON public.financial_goals FOR UPDATE
    USING (auth.uid() = customer_id)
    WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can delete their own financial goals"
    ON public.financial_goals FOR DELETE
    USING (auth.uid() = customer_id);

DROP TRIGGER IF EXISTS trg_financial_goals_updated_at ON public.financial_goals;
CREATE TRIGGER trg_financial_goals_updated_at
    BEFORE UPDATE ON public.financial_goals
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

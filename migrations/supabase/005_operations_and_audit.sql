-- ==============================================================================
-- VivPay Operations, RBAC, Investigations & Immutable Audit Logs — Supabase PostgreSQL Schema
-- Migration: 005_operations_and_audit.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. System Users Table (Admin & Employee Workspace Role Authority)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role VARCHAR(16) NOT NULL CHECK (role IN ('admin', 'employee', 'customer')),
    department TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
    last_active TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_system_users_role ON public.system_users(role);
CREATE INDEX IF NOT EXISTS idx_system_users_status ON public.system_users(status);

ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. RBAC Helper Functions
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS VARCHAR(16) SECURITY DEFINER STABLE AS $$
DECLARE
    user_role VARCHAR(16);
BEGIN
    SELECT role INTO user_role
    FROM public.system_users
    WHERE id = auth.uid() AND status = 'active';

    RETURN COALESCE(user_role, 'customer');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN SECURITY DEFINER STABLE AS $$
BEGIN
    RETURN public.get_current_role() = 'admin';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.is_employee_or_admin()
RETURNS BOOLEAN SECURITY DEFINER STABLE AS $$
BEGIN
    RETURN public.get_current_role() IN ('admin', 'employee');
END;
$$ LANGUAGE plpgsql;

-- System Users Policies
CREATE POLICY "Admins can view and manage all system users"
    ON public.system_users FOR ALL
    USING (public.is_admin());

CREATE POLICY "Users can view their own system role record"
    ON public.system_users FOR SELECT
    USING (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- 3. Operational Cases Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operational_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_number VARCHAR(32) NOT NULL UNIQUE,
    title TEXT NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    account_number_masked VARCHAR(32) NOT NULL,
    category VARCHAR(32) NOT NULL CHECK (category IN ('Dispute', 'KYC Verification', 'Suspected Fraud', 'Statement Inquiry', 'Limit Increase')),
    priority VARCHAR(16) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(16) NOT NULL CHECK (status IN ('open', 'investigating', 'escalated', 'resolved', 'closed')),
    assigned_to TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ops_cases_status ON public.operational_cases(status);
CREATE INDEX IF NOT EXISTS idx_ops_cases_customer_id ON public.operational_cases(customer_id);
CREATE INDEX IF NOT EXISTS idx_ops_cases_assigned_to ON public.operational_cases(assigned_to);

ALTER TABLE public.operational_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees and admins can view operational cases"
    ON public.operational_cases FOR SELECT
    USING (public.is_employee_or_admin());

CREATE POLICY "Employees and admins can insert operational cases"
    ON public.operational_cases FOR INSERT
    WITH CHECK (public.is_employee_or_admin());

CREATE POLICY "Employees and admins can update operational cases"
    ON public.operational_cases FOR UPDATE
    USING (public.is_employee_or_admin());

CREATE POLICY "Only admins can delete operational cases"
    ON public.operational_cases FOR DELETE
    USING (public.is_admin());

DROP TRIGGER IF EXISTS trg_operational_cases_updated_at ON public.operational_cases;
CREATE TRIGGER trg_operational_cases_updated_at
    BEFORE UPDATE ON public.operational_cases
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 4. Fraud Alerts Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fraud_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id VARCHAR(32) NOT NULL UNIQUE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    merchant TEXT NOT NULL,
    risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    trigger_reason TEXT NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    status VARCHAR(32) NOT NULL CHECK (status IN ('pending_review', 'flagged', 'cleared', 'blocked')),
    investigator_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_fraud_alerts_status ON public.fraud_alerts(status);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_risk_score ON public.fraud_alerts(risk_score);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_customer_id ON public.fraud_alerts(customer_id);

ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees and admins can view fraud alerts"
    ON public.fraud_alerts FOR SELECT
    USING (public.is_employee_or_admin());

CREATE POLICY "Employees and admins can update fraud alerts"
    ON public.fraud_alerts FOR UPDATE
    USING (public.is_employee_or_admin());

CREATE POLICY "Employees and admins can insert fraud alerts"
    ON public.fraud_alerts FOR INSERT
    WITH CHECK (public.is_employee_or_admin());

CREATE POLICY "Only admins can delete fraud alerts"
    ON public.fraud_alerts FOR DELETE
    USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 5. Investigation Records Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.investigations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_number VARCHAR(32) NOT NULL UNIQUE,
    title TEXT NOT NULL,
    target_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    target_customer_name TEXT NOT NULL,
    linked_alert_id VARCHAR(32),
    priority VARCHAR(16) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(16) NOT NULL CHECK (status IN ('open', 'investigating', 'escalated', 'resolved')),
    lead_investigator TEXT NOT NULL,
    evidence_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
    flagged_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (flagged_amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_investigations_status ON public.investigations(status);
CREATE INDEX IF NOT EXISTS idx_investigations_customer_id ON public.investigations(target_customer_id);

ALTER TABLE public.investigations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees and admins can view investigations"
    ON public.investigations FOR SELECT
    USING (public.is_employee_or_admin());

CREATE POLICY "Employees and admins can update investigations"
    ON public.investigations FOR UPDATE
    USING (public.is_employee_or_admin());

CREATE POLICY "Employees and admins can create investigations"
    ON public.investigations FOR INSERT
    WITH CHECK (public.is_employee_or_admin());

CREATE POLICY "Only admins can delete investigations"
    ON public.investigations FOR DELETE
    USING (public.is_admin());

DROP TRIGGER IF EXISTS trg_investigations_updated_at ON public.investigations;
CREATE TRIGGER trg_investigations_updated_at
    BEFORE UPDATE ON public.investigations
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 6. Immutable Append-Only Audit Logs Table
-- Enforces absolute write-only security: no UPDATE or DELETE permitted
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    actor_email TEXT NOT NULL,
    actor_role VARCHAR(16) NOT NULL CHECK (actor_role IN ('admin', 'employee', 'customer')),
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('SUCCESS', 'DENIED', 'FLAGGED'))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON public.audit_logs(status);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only Admins can inspect the audit trail
CREATE POLICY "Admins can view audit logs"
    ON public.audit_logs FOR SELECT
    USING (public.is_admin());

-- Any authenticated service or actor can record an audit event
CREATE POLICY "System can record audit logs"
    ON public.audit_logs FOR INSERT
    WITH CHECK (true);

-- NO UPDATE OR DELETE POLICIES CREATED.
-- RLS default deny guarantees append-only immutability.

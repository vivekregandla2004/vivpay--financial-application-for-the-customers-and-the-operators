-- ==============================================================================
-- VivPay Customer Model — Supabase PostgreSQL Schema & Security Policies
-- Migration: 001_initial_supabase_schema.sql
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. Customers Table (Profile extending auth.users)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);

-- Enable RLS on customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their own profile"
    ON public.customers FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Customers can update their own profile"
    ON public.customers FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Customers can insert their own profile"
    ON public.customers FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- 2. Accounts Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    account_name TEXT NOT NULL,
    account_number_masked VARCHAR(32) NOT NULL,
    account_type VARCHAR(32) NOT NULL CHECK (account_type IN ('checking', 'savings', 'credit_card', 'investment', 'loan')),
    institution_name TEXT NOT NULL,
    balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_accounts_customer_id ON public.accounts(customer_id);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their own accounts"
    ON public.accounts FOR SELECT
    USING (auth.uid() = customer_id);

CREATE POLICY "Customers can insert their own accounts"
    ON public.accounts FOR INSERT
    WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can update their own accounts"
    ON public.accounts FOR UPDATE
    USING (auth.uid() = customer_id);

CREATE POLICY "Customers can delete their own accounts"
    ON public.accounts FOR DELETE
    USING (auth.uid() = customer_id);

-- ------------------------------------------------------------------------------
-- 3. Transaction Categories Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transaction_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE, -- NULL for system categories
    name TEXT NOT NULL,
    slug VARCHAR(64) NOT NULL,
    icon VARCHAR(64) NOT NULL DEFAULT 'Tag',
    color VARCHAR(16) NOT NULL DEFAULT '#6366f1',
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_categories_customer_id ON public.transaction_categories(customer_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.transaction_categories(slug);

ALTER TABLE public.transaction_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view system and their own custom categories"
    ON public.transaction_categories FOR SELECT
    USING (is_system = true OR auth.uid() = customer_id);

CREATE POLICY "Users can create their own custom categories"
    ON public.transaction_categories FOR INSERT
    WITH CHECK (auth.uid() = customer_id AND is_system = false);

CREATE POLICY "Users can update their own custom categories"
    ON public.transaction_categories FOR UPDATE
    USING (auth.uid() = customer_id AND is_system = false);

CREATE POLICY "Users can delete their own custom categories"
    ON public.transaction_categories FOR DELETE
    USING (auth.uid() = customer_id AND is_system = false);

-- Seed Default System Categories
INSERT INTO public.transaction_categories (name, slug, icon, color, is_system)
VALUES 
    ('Income / Salary', 'income', 'Briefcase', '#10b981', true),
    ('Groceries & Dining', 'food-dining', 'Utensils', '#f59e0b', true),
    ('Housing & Rent', 'housing', 'Home', '#6366f1', true),
    ('Utilities & Bills', 'utilities', 'Zap', '#06b6d4', true),
    ('Transportation & Travel', 'transport', 'Car', '#3b82f6', true),
    ('Shopping & Retail', 'shopping', 'ShoppingBag', '#ec4899', true),
    ('Entertainment & Leisure', 'entertainment', 'Film', '#8b5cf6', true),
    ('Healthcare & Medical', 'health', 'HeartPulse', '#ef4444', true),
    ('Transfers & Payments', 'transfers', 'Repeat', '#64748b', true),
    ('Investments & Savings', 'investments', 'TrendingUp', '#14b8a6', true),
    ('General / Other', 'other', 'Tag', '#94a3b8', true)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------------
-- 4. Statement Documents Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.statement_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    storage_path TEXT, -- Path in Supabase Storage bucket 'statement-vault'
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    processing_status VARCHAR(32) NOT NULL CHECK (processing_status IN ('uploaded', 'processing', 'completed', 'partially_completed', 'failed')),
    extracted_count INTEGER NOT NULL DEFAULT 0,
    imported_count INTEGER NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    raw_text_preview TEXT, -- JSON cached preview of extracted rows
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_statements_customer_id ON public.statement_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_statements_account_id ON public.statement_documents(account_id);
CREATE INDEX IF NOT EXISTS idx_statements_checksum ON public.statement_documents(checksum);

ALTER TABLE public.statement_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their own statements"
    ON public.statement_documents FOR SELECT
    USING (auth.uid() = customer_id);

CREATE POLICY "Customers can insert their own statements"
    ON public.statement_documents FOR INSERT
    WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can update their own statements"
    ON public.statement_documents FOR UPDATE
    USING (auth.uid() = customer_id);

CREATE POLICY "Customers can delete their own statements"
    ON public.statement_documents FOR DELETE
    USING (auth.uid() = customer_id);

-- ------------------------------------------------------------------------------
-- 5. Transactions Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    statement_id UUID REFERENCES public.statement_documents(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    description TEXT NOT NULL,
    raw_description TEXT,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
    type VARCHAR(8) NOT NULL CHECK (type IN ('debit', 'credit')),
    category_id UUID NOT NULL REFERENCES public.transaction_categories(id),
    is_user_corrected BOOLEAN NOT NULL DEFAULT false,
    is_recurring BOOLEAN NOT NULL DEFAULT false,
    balance_after NUMERIC(14, 2),
    checksum VARCHAR(64) NOT NULL, -- SHA256(customer_id + account_id + date + amount + description)
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON public.transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_checksum ON public.transactions(checksum);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON public.transactions(category_id);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their own transactions"
    ON public.transactions FOR SELECT
    USING (auth.uid() = customer_id);

CREATE POLICY "Customers can insert their own transactions"
    ON public.transactions FOR INSERT
    WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can update their own transactions"
    ON public.transactions FOR UPDATE
    USING (auth.uid() = customer_id);

CREATE POLICY "Customers can delete their own transactions"
    ON public.transactions FOR DELETE
    USING (auth.uid() = customer_id);

-- ------------------------------------------------------------------------------
-- 6. Category Corrections Table (User-taught rules)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.category_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    merchant_pattern TEXT NOT NULL,
    category_id UUID NOT NULL REFERENCES public.transaction_categories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_corrections_customer ON public.category_corrections(customer_id);

ALTER TABLE public.category_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can manage their own category corrections"
    ON public.category_corrections FOR ALL
    USING (auth.uid() = customer_id);

-- ------------------------------------------------------------------------------
-- 7. Conversation Threads Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversation_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Financial Consultation',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_threads_customer_id ON public.conversation_threads(customer_id);

ALTER TABLE public.conversation_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can manage their own conversation threads"
    ON public.conversation_threads FOR ALL
    USING (auth.uid() = customer_id);

-- ------------------------------------------------------------------------------
-- 8. Chat Messages Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    thread_id UUID NOT NULL REFERENCES public.conversation_threads(id) ON DELETE CASCADE,
    role VARCHAR(16) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    groundings_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_messages_customer_id ON public.chat_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON public.chat_messages(thread_id);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can manage their own chat messages"
    ON public.chat_messages FOR ALL
    USING (auth.uid() = customer_id);

-- ------------------------------------------------------------------------------
-- 9. Supabase Storage Bucket Setup: 'statement-vault'
-- ------------------------------------------------------------------------------
-- Create private bucket for bank statements
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'statement-vault',
    'statement-vault',
    false, -- Private bucket: access requires authenticated token
    15728640, -- 15MB limit
    ARRAY['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/pdf', 'application/octet-stream']
) ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage RLS Policies: Customers can only access files in their own folder (folder name = customer auth.uid)
CREATE POLICY "Users can upload statements to their own folder"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'statement-vault' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Users can view statements from their own folder"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'statement-vault' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Users can update statements in their own folder"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'statement-vault' AND
        (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'statement-vault' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "Users can delete statements from their own folder"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'statement-vault' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

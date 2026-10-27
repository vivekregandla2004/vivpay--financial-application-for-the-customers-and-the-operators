-- ==============================================================================
-- VivPay Customer Model — Migration 001: Initial Relational Schema
-- Compatible with PostgreSQL (Supabase) and disk-persisted SQLite
-- ==============================================================================

-- 1. Customers / Users Table
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    currency TEXT NOT NULL DEFAULT 'USD',
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

-- 2. Sessions Table (Stateful Server Session Persistence)
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    customer_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_active_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    user_agent TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_customer_id ON sessions(customer_id);

-- 3. Accounts Table
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_number_masked TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK(account_type IN ('checking', 'savings', 'credit_card', 'investment', 'loan')),
    institution_name TEXT NOT NULL,
    balance REAL NOT NULL DEFAULT 0.0,
    currency TEXT NOT NULL DEFAULT 'USD',
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_accounts_customer_id ON accounts(customer_id);

-- 4. Transaction Categories Table
CREATE TABLE IF NOT EXISTS transaction_categories (
    id TEXT PRIMARY KEY,
    customer_id TEXT, -- NULL for system default categories
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'Tag',
    color TEXT NOT NULL DEFAULT '#6366f1',
    is_system INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_categories_customer_id ON transaction_categories(customer_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON transaction_categories(slug);

-- 5. Statement Documents Metadata Table
CREATE TABLE IF NOT EXISTS statement_documents (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    checksum TEXT NOT NULL,
    processing_status TEXT NOT NULL CHECK(processing_status IN ('uploaded', 'processing', 'completed', 'partially_completed', 'failed')),
    extracted_count INTEGER NOT NULL DEFAULT 0,
    imported_count INTEGER NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    raw_text_preview TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_statements_customer_id ON statement_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_statements_account_id ON statement_documents(account_id);
CREATE INDEX IF NOT EXISTS idx_statements_checksum ON statement_documents(checksum);

-- 6. Normalized Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    statement_id TEXT,
    date TEXT NOT NULL, -- YYYY-MM-DD
    description TEXT NOT NULL,
    raw_description TEXT,
    amount REAL NOT NULL CHECK(amount >= 0),
    type TEXT NOT NULL CHECK(type IN ('debit', 'credit')),
    category_id TEXT NOT NULL,
    is_user_corrected INTEGER NOT NULL DEFAULT 0,
    is_recurring INTEGER NOT NULL DEFAULT 0,
    balance_after REAL,
    checksum TEXT NOT NULL, -- SHA256(customer_id + account_id + date + amount + description) for deduplication
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (statement_id) REFERENCES statement_documents(id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES transaction_categories(id)
);

CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_checksum ON transactions(checksum);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);

-- 7. Category Corrections (User-taught merchant rules)
CREATE TABLE IF NOT EXISTS category_corrections (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    merchant_pattern TEXT NOT NULL,
    category_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES transaction_categories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_corrections_customer ON category_corrections(customer_id);
CREATE INDEX IF NOT EXISTS idx_corrections_pattern ON category_corrections(merchant_pattern);

-- 8. Conversation Threads Table
CREATE TABLE IF NOT EXISTS conversation_threads (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_threads_customer_id ON conversation_threads(customer_id);

-- 9. Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    groundings_json TEXT,
    created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (thread_id) REFERENCES conversation_threads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_customer_id ON chat_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON chat_messages(thread_id);

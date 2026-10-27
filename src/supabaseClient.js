import { createClient } from "@supabase/supabase-js";

// =============================================================================
// PASTE YOUR SUPABASE CREDENTIALS HERE
// =============================================================================

// 1. Paste your Supabase URL here:
const SUPABASE_URL = "https://qkuasaeecakwjfeymtwv.supabase.co/rest/v1/";

// 2. Paste your Supabase Public (Anon) Key here:
const SUPABASE_PUBLIC_KEY = "sb_publishable_b2cwolewlLhjdr5TzkJy8g__2q6iM_q";

// =============================================================================

// Normalize URL (strips /rest/v1/ if present so both project URL and REST URL work seamlessly)
const formattedUrl = SUPABASE_URL.replace(/\/rest\/v1\/?$/, "");

export const supabase = createClient(formattedUrl, SUPABASE_PUBLIC_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    flowType: 'pkce',
  },
});

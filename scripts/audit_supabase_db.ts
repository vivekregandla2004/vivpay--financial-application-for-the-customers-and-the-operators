import dotenv from 'dotenv';
dotenv.config();

import { getSupabaseAdmin } from '../src/server/db/supabase.ts';

async function main() {
  const supabase = getSupabaseAdmin();
  console.log('Testing queries on tables in live Supabase instance...\n');

  const tables = [
    'customers',
    'accounts',
    'transaction_categories',
    'statement_documents',
    'transactions',
    'category_corrections',
    'conversation_threads',
    'chat_messages',
    'customer_identities',
    'financial_identities',
    'cognitive_profiles',
    'financial_goals',
    'group_members',
    'collaborative_groups',
    'shared_expenses',
    'expense_splits',
    'settlements',
    'system_users',
    'operational_cases',
    'fraud_alerts',
    'investigations',
    'audit_logs'
  ];

  for (const table of tables) {
    try {
      const { data, count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact' })
        .limit(1);

      if (error) {
        console.log(`❌ Table 'public.${table}': Error - ${error.code}: ${error.message}`);
      } else {
        const columns = data && data.length > 0 ? Object.keys(data[0]) : '(empty table)';
        console.log(`✅ Table 'public.${table}': ${count} rows. Columns: ${Array.isArray(columns) ? columns.join(', ') : columns}`);
      }
    } catch (e: any) {
      console.log(`❌ Table 'public.${table}': Exception - ${e.message}`);
    }
  }

  // Also query auth.users if possible via admin API
  try {
    const { data: authData, error: authErr } = await supabase.auth.admin.listUsers();
    if (authErr) {
      console.log(`\n❌ auth.admin.listUsers() error:`, authErr.message);
    } else {
      console.log(`\n✅ auth.users: ${authData.users.length} users registered in Supabase Auth:`);
      for (const u of authData.users) {
        console.log(`   - ID: ${u.id} | Email: ${u.email} | Confirmed: ${Boolean(u.email_confirmed_at)} | Created: ${u.created_at}`);
      }
    }
  } catch (authEx: any) {
    console.log(`\n❌ auth.admin.listUsers() exception:`, authEx.message);
  }
}

main().catch(console.error);

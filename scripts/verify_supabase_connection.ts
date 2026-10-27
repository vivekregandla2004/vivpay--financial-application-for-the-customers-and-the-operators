/**
 * Real Supabase connection verification script
 * Queries PostgREST OpenAPI schema and test table endpoints
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://qkuasaeecakwjfeymtwv.supabase.co'
).trim();

const SUPABASE_KEY = (
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_b2cwolewlLhjdr5TzkJy8g__2q6iM_q'
).trim();

async function verifyConnectivity() {
  console.log('=== VIVPAY SUPABASE LIVE CONNECTION AUDIT ===');
  console.log(`Endpoint: ${SUPABASE_URL}`);
  console.log(`Key Prefix: ${SUPABASE_KEY.slice(0, 15)}... (Length: ${SUPABASE_KEY.length})`);

  // 1. Check HTTP connectivity & PostgREST OpenAPI spec
  try {
    const openApiUrl = `${SUPABASE_URL}/rest/v1/`;
    console.log(`\n1. Fetching PostgREST schema from ${openApiUrl}...`);
    const resp = await fetch(openApiUrl, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    console.log(`HTTP Status: ${resp.status} ${resp.statusText}`);
    if (resp.ok) {
      const spec = await resp.json();
      console.log('Schema Title:', spec?.info?.title || 'PostgREST API');
      console.log('API Version:', spec?.info?.version || 'Unknown');

      const definitions = Object.keys(spec?.definitions || {});
      const paths = Object.keys(spec?.paths || {}).map((p) => p.replace(/^\//, ''));

      console.log(`\nExposed Tables / Endpoints count: ${paths.length}`);
      if (paths.length > 0) {
        console.log('Found tables in database:');
        paths.forEach((table) => console.log(`  - ${table}`));
      } else {
        console.log('Notice: 0 public tables exposed yet (migrations have not been executed in SQL Editor).');
      }
    } else {
      const errText = await resp.text();
      console.log('PostgREST response payload:', errText);
    }
  } catch (err: any) {
    console.error('Network / Fetch error:', err.message);
  }

  // 2. Test Client Query via supabase-js
  try {
    console.log('\n2. Testing Supabase-js client SDK query...');
    const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });

    // Harmless select on customers table with limit 1
    const { data, error, count } = await client
      .from('customers')
      .select('id', { count: 'exact', head: true });

    if (error) {
      console.log(`Query on 'customers' table returned: code=${error.code}, message="${error.message}"`);
      if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
        console.log("Confirmed: 'customers' table does not exist yet in public schema.");
      } else if (error.code === 'PGRST301' || error.message.includes('JWT') || error.message.includes('apikey')) {
        console.log("Auth warning: Key issue or JWT format.");
      }
    } else {
      console.log(`Query succeeded on 'customers'! Row count: ${count}`);
    }

    // Harmless select on system_users table
    const sysResp = await client
      .from('system_users')
      .select('id', { count: 'exact', head: true });

    if (sysResp.error) {
      console.log(`Query on 'system_users' table returned: code=${sysResp.error.code}, message="${sysResp.error.message}"`);
    } else {
      console.log(`Query succeeded on 'system_users'! Row count: ${sysResp.count}`);
    }
  } catch (sdkErr: any) {
    console.error('SDK query error:', sdkErr.message);
  }

  console.log('\n=== AUDIT COMPLETE ===');
}

verifyConnectivity();

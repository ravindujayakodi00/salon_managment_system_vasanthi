import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Missing Supabase environment variables - functionality will be limited');
}

// Browser client that syncs auth tokens to cookies so server actions can read the session.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Supabase SSR client that automatically uses Next.js cookies for the user session.
 * Used only in server actions/routes where we need the authenticated caller.
 */
export async function getSupabaseServerClient() {
    const cookieStore = await cookies();
    return createServerClient(supabaseUrl, anonKey, {
        cookies: {
            get(name: string) {
                return cookieStore.get(name)?.value ?? null;
            },
            set(name: string, value: string, options: any) {
                cookieStore.set({ name, value, ...options });
            },
            remove(name: string) {
                cookieStore.delete(name);
            },
        },
    });
}


import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey);
};

// Cliente para uso no Frontend e Server Components básicos (opcional)
export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any;

// Cliente administrativo para o Backend (API Routes)
export const getSupabaseAdmin = () => {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase is not configured in environment variables');
    }
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing in environment variables');
    }
    return createClient(supabaseUrl, serviceRoleKey);
};

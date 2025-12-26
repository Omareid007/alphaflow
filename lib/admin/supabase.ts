import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create a null-safe client that will work even without Supabase configured
let adminSupabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseKey) {
  adminSupabase = createClient(supabaseUrl, supabaseKey);
}

export { adminSupabase };

export type Database = {
  public: {
    Tables: {
      admin_providers: {
        Row: {
          id: string;
          type: string;
          name: string;
          base_url: string | null;
          status: string;
          tags: string[];
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['admin_providers']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['admin_providers']['Insert']>;
      };
    };
  };
};

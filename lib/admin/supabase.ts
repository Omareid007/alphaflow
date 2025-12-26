import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const adminSupabase = createClient(supabaseUrl, supabaseKey);

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

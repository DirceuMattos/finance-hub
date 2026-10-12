import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = "https://tabjmrdsadodghvqoqcp.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_eGkMsSSEp9zbibsm0AsMAw_O6IhSv8n";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

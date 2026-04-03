import { createClient } from '@supabase/supabase-js';

// Retrieve keys from Vite environment variables (.env files)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholdersupabaseurl-replace-me.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder_anon_key_replace_me_in_dotenv';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

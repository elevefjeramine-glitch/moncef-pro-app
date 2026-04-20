import { createClient } from '@supabase/supabase-js'

// Les valeurs sont insérées en dur pour s'assurer que Next.js le charge correctement côté client
const supabaseUrl = 'https://ggnwtszeitrrfhedgipv.supabase.co';
const supabaseAnonKey = 'sb_publishable_he8qnS-M5-uDmTVGkinzWw_39yD0BOO';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

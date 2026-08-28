import { createClient } from '@supabase/supabase-js'

// Les valeurs sont lues depuis les variables Netlify (NEXT_PUBLIC_*), avec le
// literal en repli : le comportement est donc identique a avant si les variables
// sont absentes, mais une rotation de clé Supabase se fait desormais en un seul
// endroit (Netlify) au lieu de devoir re-patcher ce fichier puis re-deployer.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ggnwtszeitrrfhedgipv.supabase.co';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_he8qnS-M5-uDmTVGkinzWw_39yD0BOO';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

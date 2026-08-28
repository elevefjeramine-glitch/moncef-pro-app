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

export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // `pkce` est indispensable pour la connexion Google/Microsoft/Apple/GitHub :
    // sans ce réglage, supabase-js reste sur l'ancien flux « implicite », qui ne sait
    // pas échanger le `code` que renvoie le fournisseur. Le retour OAuth échouait donc
    // en silence, et l'access_token se retrouvait collé dans l'URL (visible dans
    // l'historique du navigateur). Avec PKCE, la page /auth/callback termine l'échange.
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Les retours d'échec OAuth.
 *
 * Contrairement au succès (qui repasse par /auth/callback), Supabase renvoie les ÉCHECS
 * sur `site_url` tout court, c'est-à-dire la racine du site, avec trois paramètres :
 *
 *   https://proappmoncef.netlify.app?error=invalid_request
 *     &error_code=bad_oauth_state
 *     &error_description=OAuth+state+parameter+is+invalid
 *
 * (forme mesurée le 2026-08-28 en envoyant un faux code à /auth/v1/callback → HTTP 303
 *  avec ce `Location`). La racine est la page vitrine : sans prise en charge, l'utilisateur
 *  reste sur la vitrine sans rien comprendre. D'où ce module, utilisé par la vitrine
 *  (pour renvoyer vers /auth) et par /auth (pour afficher le message).
 */

export type OAuthErrorParams = {
  error: string | null;
  errorCode: string | null;
  errorDescription: string | null;
};

/** Vrai si la query contient un signal d'échec OAuth. */
export function hasOAuthError(search: string): boolean {
  const { error, errorCode, errorDescription } = readOAuthError(search);
  return Boolean(error || errorCode || errorDescription);
}

export function readOAuthError(search: string): OAuthErrorParams {
  let p: URLSearchParams;
  try {
    p = new URLSearchParams(search);
  } catch {
    return { error: null, errorCode: null, errorDescription: null };
  }
  return {
    error: p.get('error'),
    errorCode: p.get('error_code'),
    errorDescription: p.get('error_description'),
  };
}

/**
 * Message lisible pour l'écran de connexion. `error_description` est déjà une phrase
 * côté Supabase ; on la décode (elle arrive en %20/+ dans l'URL) et on ajoute le code
 * technique entre parenthèses, utile pour toi quand tu me rapportes une erreur.
 */
export function oauthErrorMessage(search: string, fallback?: string): string | null {
  const { error, errorCode, errorDescription } = readOAuthError(search);
  if (!error && !errorCode && !errorDescription) return null;
  const parts: string[] = [];
  if (errorDescription) {
    try {
      parts.push(decodeURIComponent(errorDescription.replace(/\+/g, ' ')));
    } catch {
      parts.push(errorDescription);
    }
  } else if (error) {
    parts.push(error);
  }
  const code = errorCode || (error !== 'invalid_request' ? error : null);
  if (code) parts.push(`(${code})`);
  const msg = parts.join(' ');
  return msg || fallback || null;
}

/** L'URL vers laquelle renvoyer depuis la vitrine, en gardant les paramètres. */
export function authUrlWithError(search: string): string {
  return `/auth${search.startsWith('?') ? search : search ? `?${search}` : ''}`;
}

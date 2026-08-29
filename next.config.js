/** @type {import('next').NextConfig} */
// Aucun réglage `typescript.ignoreBuildErrors` ici, VOLONTAIREMENT (retiré le 28/08/2026
// après la fin du chantier de typage : 457 erreurs héritées -> 0). Next typecheck donc le
// projet à chaque build — si une erreur de type revient, le déploiement échoue, c'est le but.
//
// Piège historique à connaître : un `next.config.mjs` VIDE masquait ce fichier (Next résout
// .mjs AVANT .js), donc tout réglage placé ici n'était peut-être jamais lu. Le doublon est
// supprimé. Garde-fous locaux : `npm run typecheck` et `npm run check:i18n`.
const nextConfig = {
  // `/api/health` aimerait dire QUEL build tourne. Ces variables sont reprises de
  // l'environnement AU BUILD et figées dans le bundle — ce qui est le bon régime pour
  // une information sur le build, pas une mesure faite à la demande.
  //
  // Piège où je suis tombé (28-29/08/2026) : ces valeurs ne sont lues CORRECTEMENT
  // que si la route les reference EN TOUTES LETTRES. Mon premier essai passait par
  // `process.env[nom]` avec une clé calculée — Next ne substitue pas là, donc la
  // fonction relisait un environnement d'exécution où ces variables n'existent pas,
  // et tout rentrait à `null`. J'en avais conclu que « Netlify ne pose pas COMMIT_REF
  // », c'était faux : avec les références littérales, la preview 6a92d023042d renvoie
  // `commit 33c719e · branch pull/7/head · context deploy-preview`. La plateforme les
  // fournit donc bien ; seul mon mode de lecture était cassé. La page /status
  // continue de n'afficher la ligne que si le champ est non vide.
  // En-têtes de sécurité. Trois sont posés, deux sont ABSOLUMENT absents :
  //   - `X-Frame-Options` et une `frame-ancestors` restrictive ne sont pas ici, à dessein :
  //     l'aperçu de ce projet s'affiche dans un <iframe> sur un hôte tiers. Un de ces deux
  //     en-têtes rendrait l'aperçu aveugle — et le diagnostic ferait croire à une panne de
  //     l'application. À poser le jour où le site n'est plus jamais encadré.
  //   - pas de Content-Security-Policy non plus pour l'instant : la page pose du CSS en
  //     ligne (<style> pour la couleur d'accent) et le HTML des réponses IA passe par
  //     DOMPurify ; une CSP stricte exige d'abord d'inventorier les `unsafe-inline`, sinon
  //     elle casse la mise en page au premier chargement. Chiffrée, elle est proposée.
  // Mesuré localement (curl -I sur `next start`) : les trois en-têtes ci-dessous sortent
  // sur toutes les routes, HTML comme chunks JS.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // le navigateur ne doit jamais deviner un type MIME : sans ça, un upload
          // renommé .html peut être exécuté comme du script dans l'origine du site
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // l'URL complète (avec jeton de reset, id de compte dans /app/comm) ne doit
          // pas fuiter vers les sites liés par l'élève
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // aucune de ces API n'est utilisée par le site : les couper supprime la
          // surface d'un script tiers qui y parviendrait quand même
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), fullscreen=(self)' },
          // les lecteurs PDF/Flash tiers ne doivent pas charger nos ressources
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
        ],
      },
    ]
  },
  env: {
    NEXT_PUBLIC_BUILD_COMMIT: process.env.COMMIT_REF ?? '',
    NEXT_PUBLIC_BUILD_BRANCH: process.env.BRANCH ?? '',
    NEXT_PUBLIC_BUILD_CONTEXT: process.env.CONTEXT ?? '',
    NEXT_PUBLIC_BUILD_ID: process.env.BUILD_ID ?? '',
  },
}

module.exports = nextConfig

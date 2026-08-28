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
  // ATTENTION, mesuré le 28/08/2026 sur le déploiement Netlify 6a92039d5fac : les
  // quatre champs reviennent vides là-bas (`deployment.commit: null`), c'est-à-dire
  // que ce mode de build ne pose pas COMMIT_REF dans son environnement. Le mécanisme
  // est vérifié localement (COMMIT_REF passé à la main -> `commit dd6b6f7 ·
  // docs/corps-requete · production` dans le JSON). Donc : ici ça marche quand la
  // variable existe, et sur cette plateforme ça ne marche pas. La page /status
  // n'affiche la ligne que si le champ est non vide — aucun chiffre n'est inventé.
  env: {
    NEXT_PUBLIC_BUILD_COMMIT: process.env.COMMIT_REF ?? '',
    NEXT_PUBLIC_BUILD_BRANCH: process.env.BRANCH ?? '',
    NEXT_PUBLIC_BUILD_CONTEXT: process.env.CONTEXT ?? '',
    NEXT_PUBLIC_BUILD_ID: process.env.BUILD_ID ?? '',
  },
}

module.exports = nextConfig

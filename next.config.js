/** @type {import('next').NextConfig} */
// Aucun réglage `typescript.ignoreBuildErrors` ici, VOLONTAIREMENT (retiré le 28/08/2026
// après la fin du chantier de typage : 457 erreurs héritées -> 0). Next typecheck donc le
// projet à chaque build — si une erreur de type revient, le déploiement échoue, c'est le but.
//
// Piège historique à connaître : un `next.config.mjs` VIDE masquait ce fichier (Next résout
// .mjs AVANT .js), donc tout réglage placé ici n'était peut-être jamais lu. Le doublon est
// supprimé. Garde-fous locaux : `npm run typecheck` et `npm run check:i18n`.
const nextConfig = {
  // `/api/health` aimerait dire QUEL build tourne. Ces variables sont posées par
  // Netlify au moment du build, mais pas forcément au moment de l'exécution de la
  // fonction — mesuré sur la preview du 28/08/2026 : `deployment.commit` renvoyait
  // `null`, donc la page affichait rien. `env` fige les valeurs dans le bundle au
  // build, ce qui est exactement ce qu'on veut : c'est une information sur le build,
  // pas une mesure faite à la demande.
  env: {
    NEXT_PUBLIC_BUILD_COMMIT: process.env.COMMIT_REF ?? '',
    NEXT_PUBLIC_BUILD_BRANCH: process.env.BRANCH ?? '',
    NEXT_PUBLIC_BUILD_CONTEXT: process.env.CONTEXT ?? '',
    NEXT_PUBLIC_BUILD_ID: process.env.BUILD_ID ?? '',
  },
}

module.exports = nextConfig

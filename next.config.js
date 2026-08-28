/** @type {import('next').NextConfig} */
// Aucun réglage `typescript.ignoreBuildErrors` ici, VOLONTAIREMENT (retiré le 28/08/2026
// après la fin du chantier de typage : 457 erreurs héritées -> 0). Next typecheck donc le
// projet à chaque build — si une erreur de type revient, le déploiement échoue, c'est le but.
//
// Piège historique à connaître : un `next.config.mjs` VIDE masquait ce fichier (Next résout
// .mjs AVANT .js), donc tout réglage placé ici n'était peut-être jamais lu. Le doublon est
// supprimé. Garde-fous locaux : `npm run typecheck` et `npm run check:i18n`.
const nextConfig = {}

module.exports = nextConfig

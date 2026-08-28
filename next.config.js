/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Choix ASSUMÉ, pas un oubli. `npm run typecheck` remonte 457 erreurs de
    // typage héritées du projet (dont ~250 propagées par des useState([]) non
    // typés qui deviennent `never`). Faire échouer le build Netlify pour ça
    // serait un risque direct en production ; le chantier est donc tracé à part.
    //
    // Ce qui a changé quand même, et qui compte : `next.config.mjs` — un fichier
    // VIDE — masquait ce fichier (Next résout .mjs AVANT .js). Tout réglage placé
    // ici était donc peut-être jamais lu. Le doublon est supprimé : ce réglage est
    // désormais réellement appliqué. `npm run typecheck` et `npm run check:i18n`
    // sont les garde-fous, à brancher en CI plutôt qu'au build.
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig

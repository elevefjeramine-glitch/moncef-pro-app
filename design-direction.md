# Direction artistique — Moncef IA landing (raffinement 19/10/2026)

Patterns extraits de l'étude (MotionSites, Awwwards SOTD 2025-2026, enrichr.dev, hontran.dev) :

1. **Zéro easing par défaut** : partout `cubic-bezier(.16,1,.3,1)` ou springs avec overshoot — jamais `ease`/`ease-in-out` CSS.
2. **Motion scroll-owned** : les timelines sont drivée par le scroll (scrub), pas par des autoplay fixes — le visiteur contrôle le rythme.
3. **Type oversize** : titres à 10vw+, tracking serré (-0.05em), mots fantômes en outline derrière les sections.
4. **Marquee bands** : bandeaux de texte en boucle infinie comme séparateurs de rythme entre sections.
5. **CTA vivants** : bordure en dégradé animé, balayage de brillance au survol, flèche qui glisse, physique d'appui 3D + magnétique.
6. **Grain de film** : overlay de bruit SVG subtil sur toute la page — sépare "template" de "premium".
7. **Stickers** : badges flottants façon autocollant (rotation + flottement) autour du hero.
8. **Cartes tactiles** : au survol — lift, lueur de bordure, reflet qui traverse (glare).
9. **Rythme de sections** : numéros fantômes géants, alternance de densités, séparateurs avec personnalité.
10. **WebGL en atmosphère** (leçon d'Iventions) : la 3D éclaire et habille, elle ne fait pas le spectacle seule.
11. **Micro-détails** : couleur de sélection custom, scrollbar stylée, focus visibles soignés.
12. **Discipline perf** : tout ce qui est décoratif est CSS/SVG pur — aucun nouveau poids WebGL.
13. **Règle anti-générique** (Amine) : aucun élément décoratif "par défaut" — chaque forme est intentionnelle ou supprimée.
14. **Zéro contenu factice** : chaque chiffre/texte affiché est réel et traduit (5 langues, RTL OK).
15. **Réduction gracieuse** : `prefers-reduced-motion` et mobile faible → version statique, jamais de page cassée.

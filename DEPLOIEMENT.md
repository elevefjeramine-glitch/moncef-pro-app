# Déployer, vérifier, revenir en arrière

Ce fichier existe parce qu'une promotion faite à la main dans une interface ne laisse
aucune trace mesurable. Tout ce qui est écrit ci-dessous a été joué dans cette atelier ;
les lignes qui n'ont pas pu être jouées le disent.

## L'état, aujourd'hui

| | |
| --- | --- |
| Site | `proappmoncef.netlify.app` |
| Déploiement publié | `6a934a48b8459d146876faaf` (lot A : import `events-import`, filet de crédits `0006` refusé, contraste, aiguilles) |
| Attendu en ligne et absent | `/api/agenda` → **404** vérifié par requête HTTP directe ; les commits `d539854`, `70ef993`, `f28a7f7` sont poussés sur GitHub mais **non promotionnés** |
| Base | Supabase `ggnwtszeitrrfhedgipv` ; migration `0014_agenda_prive.sql` **appliquée** (table `public.agenda_tokens`, RLS `auth.uid() = user_id`, `REVOKE` pour `anon`/`authenticated`, index unique sur `jeton`, 0 ligne) |
| Builds sur push | désactivés de fait : le build Netlify répond `Skipped due to account credit usage exceeded` — ce n'est pas une configuration à corriger, c'est le quota du compte |

## 1 · Faire arriver un commit en production

Deux voies, selon ce que le compte permet :

```bash
# Voie A — build à la demande, puis promotion du brouillon (API, relue)
netlify link && netlify build                       # produit un déploiement « ready » non publié
JETON=$(security-find-the-token-elsewhere) \
DEPLOY=<id-du-brouillon> bash tests/promotion.sh    # restore + relû + toises sur le domaine nu

# Voie B — quand les builds sur push fonctionnent de nouveau
git push origin master && sleep 180 && bash tests/promotion.sh
```

`tests/promotion.sh` ne considère la promotion comme faite **que** si l'API rend
`published_deploy.id == DEPLOY` **et** que les toises passent sur le domaine public.
Il se teste sans jeton :

```bash
SANS_RESTORE=1 BASE=http://127.0.0.1:3114 SK=$(cat /tmp/.sk) PAT=<sbp_…> bash tests/promotion.sh
```

Résultat mesuré de cette commande, joué ici : `45 vérifications passées · 0 échecs`
(`tests/agenda-verif.py`) et `30 vérifications passées · 0 échecs`
(`tests/plan-fiches-verif.py`), contre un `next start` local branché sur la base de
production. La branche « restore » du script, elle, **n'a pas pu être jouée ici** : plus
aucun jeton Netlify dans l'atelier (`~/.config/netlify/config.json`, 81 octets, sans
`access_token`).

## 2 · Ce que les toises regardent

- `tests/agenda-verif.py` — le lien `.ics` par compte créé depuis une vraie session, le
  `text/calendar`, un `VEVENT` par ligne, les `RRULE …INTERVAL=2` des semaines A/B, le
  pliage à 75 octets, l'échappement `Maths\;`, `X-PUBLISHED-TTL`, l'`ETag` et le `304` à
  corps vide, deux lectures espacées comparées octet à octet, le `404` uniforme (jeton
  inconnu = traversée de chemin = lien retiré), le `401` sans session, la mort immédiate
  de l'ancien lien après régénération, et **zéro résidu** en base à la fin (filet
  `atexit`, éprouvé par `VERIF_ECHEC_DES_LE_DEBUT=1`).
- `tests/plan-fiches-verif.py` — le plan de révision à `cout: 0`, le budget de minutes
  appliqué, les bornes 240 min / 21 jours, le **solde de crédits lu en SQL identique
  avant/après**, les marqueurs d'interface retrouvés dans tous les `/_next/*.js` servis,
  les classes dans la feuille publiée, et le `decouper` qui répond 503 sans débiter ni
  écrire quand aucune clé de modèle n'est configurée.

## 3 · Environnement (jamais dans le dépôt)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
(celle-là ne sort pas du serveur : la route `/api/agenda/[jeton]` est la seule à s'en
servir, pour lire par jeton sans session), `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`,
`GEMINI_API_KEY` ou `GROQ_API_KEY`. Variables d'environnement Netlify : seulement par
CLI (`netlify env:set SITE_CLE <valeur>`) — l'API v1 n'expose pas `/env` sur ce compte
(`404` mesuré). Aucun secret n'est écrit dans un commit, une migration, ni un `cron.job`.

## 4 · Revenir en arrière

```bash
JETON=… DEPLOY=6a934a48b8459d146876faaf bash tests/promotion.sh   # retablit le lot A
```

Repli de base de données : aucune migration de ce lot ne détruit une colonne ; `0014`
crée `agenda_tokens`. Pour annuler son effet sans la retirer :

```sql
delete from public.agenda_tokens;   # coupe tous les liens d'abonnement d'un coup
```

## 5 · Mesurer ici, localement

```bash
npm run build
(nohup env NEXT_PUBLIC_SUPABASE_URL=https://ggnwtszeitrrfhedgipv.supabase.co \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_… \
  SUPABASE_SERVICE_ROLE_KEY=<service> \
  npx next start -p 3113 -H 0.0.0.0 &)
BASE=http://127.0.0.1:3113 SK=<service> PAT=<sbp_…> python3 tests/agenda-verif.py
```

Le `0.0.0.0` n'est pas un détail : `next start` n'écoute que `127.0.0.1` par défaut, et
les toises python tournent dans le même espace de noms. Pour arrêter, tuer le PID lu dans
`ss -ltnp` — jamais `pkill -f "next start"`, qui tue le shell qui le prononce.

## 6 · Gates

| Commande | Ce qu'elle garde |
| --- | --- |
| `npm run build` | **le vrai gate du dépôt** — `tsc --noEmit` laisse passer des choses que Next refuse (un handler qui renvoie `Promise<NextResponse \| null>`, un client Supabase construit au niveau module) |
| `npx vitest run` | 106 tests (agenda 26, plan 13, fiches 18, i18n 7, imports, thunder, révision) |
| `npx eslint src/app/auth/page.tsx src/app/app/schedule/page.tsx` | 0 problème depuis `f28a7f7`-suivant ; **19 restent ailleurs** dans `src`, préexistants, dans des fichiers que ce lot ne touche pas |
| `npx tsc --noEmit` | les specs Playwright et les routes typées |
| `npm run verif:agenda` / `verif:plan-fiches` / `verif:promo` | les toises live, locales ou sur le domaine nu |

# Notes de sécurité (28/08/2026)

## Ce dossier contient
- `supabase/security-fix-rls.sql` — à coller dans **Supabase → SQL Editor → Run**.
  Bloque l'auto-promotion au rôle `founder`/`modérateur`.

## À faire de toute urgence
1. **Changer le mot de passe du compte fondateur** (`aminefjer@…`).
   Il était en clair dans `setup-founder.mjs`, publié sur une repo **public**.
   Retiré du dépôt par le commit qui ajoute ce fichier — mais l'historique git le
   contient toujours, donc le mot de passe doit être considéré compromis.
2. Exécuter le SQL ci-dessus (ferme l'élévation de privilèges).
3. Régénérer les clés API qui ont circulé en clair : Gemini, Groq, Anthropic,
   puis `netlify env:set <CLE> "<nouvelle valeur>"`.

## Ce qui reste ouvert
`supabase_schema.sql` contient toujours :
```sql
CREATE POLICY "Users are readable by everyone" ON public.users FOR SELECT USING (true);
```
Tout compte connecté peut donc lire `email`, `role` et `tokens` de tous les
utilisateurs. Corriger côté base (restreindre le SELECT + vue `users_public_profile`)
**et** côté app (faire lire la vue là où l'affichage est public) — sinon l'app casse.


## Historique des correctifs appliqués (base de données)
- 28/08/2026 — trigger `trg_guard_privileged_columns`, politique UPDATE avec
  `WITH CHECK`, SELECT restreint à sa propre ligne, vue
  `users_public_profile` (`security_invoker`), `REVOKE DELETE/TRUNCATE/
  REFERENCES/INSERT`. Détail + preuves de contrôle : `supabase/security-fix-rls.sql`.
- Code adapté dans le même commit : `comm/page.tsx` (3 lectures via la vue),
  `auth/page.tsx` (fin de l'upsert sur des colonnes inexistantes).

## Ce qui reste à faire (hors base de données)
- Changer le mot de passe du compte fondateur (publié dans l'historique git
  via le commit 32abf5f) ou passer le dépôt en privé.
- Régénérer les clés Gemini / Groq / Anthropic qui ont circulé en clair.

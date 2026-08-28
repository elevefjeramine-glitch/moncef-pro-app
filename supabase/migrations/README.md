# Migrations SQL (archives)

Scripts **historiques** appliqués au projet `ggnwtszeitrrfhedgipv`. Déplacés depuis la
racine, contenu inchangé (sha256 en en-tête de chaque fichier). Rien ne les exécute :
`supabase/` n'est pas branché sur la CLI.

| Fichier | Rôle |
|---|---|
| `0001_user_profile.sql` | colonnes de profil (`theme_color`, `status`, `language`, …) |
| `0002_events.sql` | table `events` |
| `0003_homework.sql` | devoirs |
| `0004_messaging.sql` | conversations & messages |
| `0005_performance_indexes.sql` | index |
| `0006_cron_credits.sql` | régénération des crédits |
| `0007_fix_rls_policies_OBSOLETE.sql` | ⛔ remplacé, ne pas exécuter |

**Source de vérité pour la sécurité : `../security-fix-rls.sql`** (état réellement
appliqué en base le 28/08/2026 : privilèges par colonne, trigger anti-escalade,
vue `users_public_profile`).

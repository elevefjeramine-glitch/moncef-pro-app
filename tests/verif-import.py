# -*- coding: utf-8 -*-
"""Relit les trois compteurs de la séance d'import, côté SQL, et les énonce.

Le test lui-même est `tests/import-live.test.ts` (vitest) : c'est là que le code de
production tourne. Ce petit script sert seulement à dire, en clair, ce qui a été écrit.
"""
import json
import os
import subprocess
import sys

PAT = os.environ.get("PAT", "")
UID = os.environ.get("UID_TEST", "")
if not PAT:
    print("   PAT requis (jeton d'administration de l'infra Supabase).")
    sys.exit(2)


def sql(q):
    r = subprocess.run(["curl", "-s", "--max-time", "90", "-X", "POST",
                        "https://api.supabase.com/v1/projects/ggnwtszeitrrfhedgipv/database/query",
                        "-H", "Authorization: Bearer " + PAT, "-H", "Content-Type: application/json",
                        "-d", json.dumps({"query": q})], capture_output=True, text=True)
    return r.stdout.strip()


print("── sources du compte de test, longueur relue en base ──")
print(sql("select titre, longueur, left(texte,8) as debut from public.thunder_sources order by created_at desc limit 6"))
print("── reste-t-il une trace d'une séance interrompue ? ──")
print(sql("select count(*)::int as orphelines from public.thunder_sources t where not exists (select 1 from auth.admin_users a where a.id = t.user_id)"))

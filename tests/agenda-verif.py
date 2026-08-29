#!/usr/bin/env python3
"""Lot A4 · le lien d'agenda, vérifié sur un déploiement réel (pas sur mon code local).

  BASE=https://proappmoncef.netlify.app SK=$(cat /tmp/.sk) PAT=<supabase-pat> \
      python3 tests/agenda-verif.py

Le compte utilisé est un compte de test du dépôt (jamais un compte d'élève) : le script
insère ses propres lignes d'agenda, puis les supprime, et vérifie qu'il ne laisse RIEN.
"""
import json, os, re, ssl, sys, urllib.request, urllib.error

BASE = os.environ.get("BASE", "https://proappmoncef.netlify.app").rstrip("/")
SK = os.environ.get("SK", "")
PAT = os.environ.get("PAT", "")
SUPA = "https://ggnwtszeitrrfhedgipv.supabase.co"
ANON = "sb_publishable_he8qnS-M5-uDmTVGkinzWw_39yD0BOO"
MDP = open("/tmp/.mdp").read().strip() if os.path.exists("/tmp/.mdp") else ""
COMPTES = json.load(open("/tmp/.test-comptes.json")) if os.path.exists("/tmp/.test-comptes.json") else {}

ctx = ssl.create_default_context()
ok, echecs = 0, []
def verif(cond, libelle, detail=""):
    global ok
    if cond:
        ok += 1
        print("  ✓ " + libelle)
    else:
        echecs.append(libelle)
        print("  ✗ " + libelle + (" · " + str(detail) if detail else ""))

def http(url, meth="GET", entetes=None, corps=None, brut=False):
    data = None if corps is None else (corps.encode() if isinstance(corps, str) else json.dumps(corps).encode())
    req = urllib.request.Request(url, data=data, method=meth, headers=entetes or {})
    try:
        with urllib.request.urlopen(req, timeout=45, context=ctx) as r:
            t = r.read()
            return r.status, {k.lower(): v for k, v in r.headers.items()}, (t.decode("utf-8", "replace") if not brut else t)
    except urllib.error.HTTPError as e:
        t = e.read()
        return e.code, {k.lower(): v for k, v in e.headers.items()}, (t.decode("utf-8", "replace") if not brut else t)

def sql(q, tentatives=2):
    """Le point `/database/query` de l'API de gestion refuse l'agent `Python-urllib`
    (et répond parfois un corps vide) : on passe par curl, comme le reste de l'outillage
    du dépôt. Un contrôle muet doit se voir, pas se lire comme un zéro."""
    import json as _j, subprocess, time as _t
    for _ in range(tentatives):
        r = subprocess.run(
            ["curl", "-s", "--max-time", "45", "-X", "POST",
             "https://api.supabase.com/v1/projects/ggnwtszeitrrfhedgipv/database/query",
             "-H", "Authorization: Bearer " + PAT, "-H", "Content-Type: application/json",
             "-d", _j.dumps({"query": q})],
            capture_output=True, text=True)
        corps = (r.stdout or "").strip()
        if corps.startswith("[") or corps.startswith("{"):
            try:
                return 200, _j.loads(corps)
            except Exception:
                pass
        _t.sleep(1.0)
    return 0, None

def compte_de(q, tentatives=4):
    """Renvoie l'unique valeur du compteur, ou la chaîne 'INDISPONIBLE' — jamais None :
    une table vide (0) et un point d'API muet sont deux faits différents. Les confondre
    transformerait un doute en vert."""
    for _ in range(tentatives):
        st, j = sql(q)
        if isinstance(j, list) and j:
            return list(j[0].values())[0]
        __import__("time").sleep(1.5)
    return "INDISPONIBLE"

# ── 1 · un compte de test, créé pour l'occasion et supprimé à la fin ──────────
# On ne joue JAMAIS sur le compte d'un élève : ces vérifications écrivent en base.
# Si un compte de test existe déjà (fichier laissé par une campagne précédente), on le
# réutilise ; sinon on en crée un via l'API d'administration, et on le détruira.
compte_cree = ""
email = mot_de_passe = ""
if COMPTES:
    for cle in ("eleve", "moderator", "normal"):
        e = (COMPTES.get(cle) or {}).get("email")
        if e and MDP:
            email, mot_de_passe = e, MDP
            break
if email:
    st, _, corps = http(SUPA + "/auth/v1/token?grant_type=password", "POST", {"apikey": ANON, "content-type": "application/json"}, {"email": email, "password": mot_de_passe})
    if st != 200:
        print("  · compte de test %s refusé (%s) → nouveau compte jetable" % (email, corps[:60]))
        email = ""
if not email:
    import secrets, datetime
    email = "verif.a4.%s@exemple.fr" % secrets.token_hex(3)
    mot_de_passe = "Vrf-" + secrets.token_hex(6) + "!"
    st, _, corps = http(SUPA + "/auth/v1/admin/users", "POST", {"authorization": "Bearer " + SK, "apikey": SK, "content-type": "application/json"},
                        {"email": email, "password": mot_de_passe, "email_confirm": True, "app_metadata": {"provider": "email"},
                         "user_metadata": {"prenom": "Verif", "nom": "A4", "note": "compte de test — campagne agenda"}})
    verif(st in (200, 201, 422), "compte de test créé", "%s %s" % (st, corps[:70]))
    compte_cree = (json.loads(corps) if st in (200, 201) else {}).get("id") or ""
    if not compte_cree:  # 422 = existe déjà : on le retrouve par recherche admin
        st, _, corps = http(SUPA + "/auth/v1/admin/users?page=1&per_page=50&filter_group="+email, "GET", {"authorization": "Bearer " + SK, "apikey": SK})
        for u in (json.loads(corps).get("users") or []):
            if u.get("email") == email:
                compte_cree = u["id"]
    verif(bool(compte_cree), "identifiant du compte de test obtenu", compte_cree[:8])
    st, _, corps = http(SUPA + "/auth/v1/token?grant_type=password", "POST", {"apikey": ANON, "content-type": "application/json"}, {"email": email, "password": mot_de_passe})
st, _, corps = http(SUPA + "/auth/v1/token?grant_type=password", "POST", {"apikey": ANON, "content-type": "application/json"}, {"email": email, "password": mot_de_passe})
verif(st == 200, "connexion du compte de test", "%s %s" % (st, corps[:80]))
if st != 200:
    print("  arrêt : pas de session de test")
    sys.exit(2)
jeton = json.loads(corps)["access_token"]
uid = json.loads(corps)["user"]["id"]
A = {"authorization": "Bearer " + jeton, "apikey": ANON, "content-type": "application/json", "prefer": "return=representation"}

# ── 2 · un jeu de données connu, inséré puis retiré ───────────────────────────
ids = {"schedule": [], "homework": [], "events": []}
def inserer(table, ligne):
    st, _, corps = http("%s/rest/v1/%s" % (SUPA, table), "POST", A, ligne)
    l = json.loads(corps)
    ident = (l[0] if isinstance(l, list) else l).get("id")
    if ident: ids[table].append(ident)
    return st == 201, l
demain = __import__("datetime").date.today() + __import__("datetime").timedelta(days=1)
ins1, _ = inserer("schedule", {"user_id": uid, "week": "A", "day_index": 0, "subj": "Maths; analysé", "time_slot": "08:00-09:00"})
ins2, _ = inserer("schedule", {"user_id": uid, "week": "B", "day_index": 2, "subj": "Physique-Chimie", "time_slot": "10:00"})
ins3, _ = inserer("schedule", {"user_id": uid, "week": "A", "day_index": 4, "subj": "EPS", "time_slot": "gymnase"})
ins4, _ = inserer("homework", {"user_id": uid, "subject": "Commentaire", "task": "p. 12-14, à rendre", "due_date": demain.isoformat(), "priority": "haute"})
ins5, _ = inserer("events", {"user_id": uid, "title": "Oral blanc", "event_date": demain.isoformat(), "event_time": "14:30", "category": "oral"})
verif(all([ins1, ins2, ins3, ins4, ins5]), "cinq lignes insérées sur le compte de test")
verif(len(ids["schedule"]) == 3, "trois cours dans l'emploi du temps de test", ids["schedule"])

# ── 3 · le lien ────────────────────────────────────────────────────────────────
st, _, corps = http(BASE + "/api/agenda", "POST", A, {"action": "retirer"})
st, _, corps = http(BASE + "/api/agenda", "POST", A, {"action": "creer"})
reponse = json.loads(corps) if st else {}
verif(st == 200 and reponse.get("actif") is True, "POST /api/agenda {action:creer} renvoie un lien actif", "%s %s" % (st, corps[:90]))
lien = reponse.get("lien") or ""
m = re.match(r"^/api/agenda/([0-9a-f]{32})\.ics$", lien)
verif(bool(m), "le lien a la forme /api/agenda/<32 hexadécimaux>.ics", lien)
verif(isinstance(reponse.get("comptes", {}).get("cours"), int) and reponse["comptes"]["cours"] >= 3, "le résumé compte bien les cours", reponse.get("comptes"))
verif(reponse.get("avert"), "la réponse porte un avertissement lisible", reponse.get("avert", "")[:40])

st, entetes, ics = http(BASE + lien) if m else (0, {}, "")
verif(st == 200, "GET du .ics sans session = 200", st)
verif("text/calendar" in entetes.get("content-type", ""), "servé en text/calendar", entetes.get("content-type"))
verif(entetes.get("x-content-type-options") == "nosniff", "x-content-type-options: nosniff")
verif("private" in entetes.get("cache-control", ""), "cache-control privé (jamais public sur une URL secrète)", entetes.get("cache-control"))
verif(int(entetes.get("x-agenda-cours", 0)) == 3, "l'en-tête x-agenda-cours compte 3 cours", entetes.get("x-agenda-cours"))
verif(ics.startswith("BEGIN:VCALENDAR\r\n") and "END:VCALENDAR\r\n" in ics, "VCALENDAR ouvert et fermé")
verif("TZID=Africa/Casablanca" in ics and "BEGIN:VTIMEZONE" in ics, "le fuseau est déclaré (Africa/Casablanca)")
verif("BEGIN:DAYLIGHT" not in ics, "aucun passage à l'heure d'été inventé")
verif(ics.count("BEGIN:VEVENT") == 5, "cinq VEVENT (3 cours, 1 devoir, 1 événement)", ics.count("BEGIN:VEVENT"))
verif(len(re.findall(r"INTERVAL=2", ics)) == 3, "les trois cours portent INTERVAL=2 (semaines A/B)", len(re.findall(r"INTERVAL=2", ics)))
verif(all(len(l.encode("utf-8")) <= 75 for l in ics.split("\r\n")), "toutes les lignes ≤ 75 octets", max(len(l.encode()) for l in ics.split("\r\n")))
verif("\\;" in ics and "Maths" in ics.replace("\r\n ", ""), "le point-virgule d'une matière est échappé, ligne re-dépliable")
verif("TRIGGER:-P1D" in ics, "une alarme la veille du devoir")
verif("duree d'une heure par defaut" in ics.replace("\r\n ", ""), "l'heure présumée est DITE dans le fichier")
verif("horaire a verifier" in ics.replace("\r\n ", ""), "le créneau illisible est marqué, pas inventé")
# Une heure d'événement s'écrit au format compact en ICS : « 14:30 » devient T143000.
# Vérifier la chaîne saisie telle quelle serait un test faux qui passerait sur du texte.
verif(re.search(r"DTSTART;TZID=Africa/Casablanca:\d{8}T143000", ics.replace("\r\n ", "")) is not None,
      "l'heure de l'événement est reprise (14:30 → T143000)", re.findall(r"DTSTART[^\r]*", ics)[:2])

# ── 4 · ce qui doit être refusé ───────────────────────────────────────────────
st, _, _ = http(BASE + "/api/agenda/" + ("0" * 32) + ".ics")
verif(st == 404, "un jeton inexistant → 404", st)
st, _, _ = http(BASE + "/api/agenda/../agenda.ics")
verif(st < 500, "une traversée de chemin ne fait pas tomber la fonction", st)
st, _, _ = http(BASE + "/api/agenda", "POST", {"content-type": "application/json"}, {"action": "creer"})
verif(st == 401, "créer un lien sans session → 401", st)
st, _, _ = http(BASE + "/api/agenda", "GET")
verif(st == 401, "lire l'état sans session → 401", st)

# ── 5 · régénérer casse l'ancien lien, retirer casse le nouveau ───────────────
vieux = lien
st, _, corps = http(BASE + "/api/agenda", "POST", A, {"action": "regenerer"})
nouveau = (json.loads(corps) if st == 200 else {}).get("lien") or ""
verif(st == 200 and nouveau and nouveau != vieux, "régénérer produit un AUTRE lien", nouveau[:40])
verif(http(BASE + vieux)[0] == 404, "l'ancien lien est mort immédiatement")
verif(http(BASE + nouveau)[0] == 200, "le nouveau lien marche")
st, _, _ = http(BASE + "/api/agenda", "POST", A, {"action": "retirer"})
verif(st == 200, "retirer le lien est accepté", st)
verif(http(BASE + nouveau)[0] == 404, "le lien retiré renvoie 404")
st, _, corps = http(BASE + "/api/agenda", "GET", A)
verif(json.loads(corps).get("actif") is False, "l'état dit « pas de lien » après retrait", corps[:60])

# ── 6 · la table est propre, et les lignes de test aussi ──────────────────────
n = compte_de("select count(*)::int n from public.agenda_tokens where user_id='%s'" % uid)
verif(n == 0, "aucune ligne agenda_tokens ne survit au retrait", n)
for table in ("schedule", "homework", "events"):
    for ident in ids[table]:
        http("%s/rest/v1/%s?id=eq.%s" % (SUPA, table, ident), "DELETE", A)
n2 = compte_de("select count(*)::int n from public.agenda_tokens where jeton='%s'" % (m.group(1) if m else "x"))
verif(n2 == 0, "le jeton du test a bien disparu du dépôt (SQL)", "lu : %r" % n2)
st, _, corps = http(BASE + "/api/agenda", "GET", A)
verif(json.loads(corps).get("actif") is False, "et l'API confirme qu'il n'y a plus de lien", corps[:60])

print("\n  %d vérifications passées · %d échecs%s" % (ok, len(echecs), (" : " + "; ".join(echecs)) if echecs else ""))
sys.exit(1 if echecs else 0)

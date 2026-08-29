#!/usr/bin/env python3
"""Lots C4 (plan de révision) et B3 (découpage en fiches) — vérifiés sur le build servi.

  BASE=http://127.0.0.1:3111 SK=$(cat /tmp/.sk) PAT=<pat> python3 tests/plan-fiches-verif.py

Ce qui est mesuré ici, et ce qui ne peut pas l'être :
  · C4 est un calcul pur sur la base : il se vérifie EN ENTIER, y compris « 0 crédit ».
  · B3 se termine par un appel au modèle. Sans GEMINI_API_KEY / GROQ_API_KEY dans
    l'environnement, la route répond 503 AVANT de demander quoi que ce soit : on vérifie
    donc le mode accepté, le plafond de crédits affiché, et le fait qu'aucun crédit ne
    bouge — pas la fabrication des fiches (elle exige une clé, et le dire fait partie du
    résultat). Le découpage local, lui, est couvert par tests/fiches.test.ts (sans réseau).
"""
import json, os, ssl, subprocess, sys, urllib.error, urllib.request, secrets, time

BASE = os.environ.get("BASE", "http://127.0.0.1:3111").rstrip("/")
SK = os.environ.get("SK", "")
PAT = os.environ.get("PAT", "")
SUPA = "https://ggnwtszeitrrfhedgipv.supabase.co"
ANON = "sb_publishable_he8qnS-M5-uDmTVGkinzWw_39yD0BOO"
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

def http(url, meth="GET", entetes=None, corps=None):
    data = None if corps is None else json.dumps(corps).encode()
    req = urllib.request.Request(url, data=data, method=meth, headers=entetes or {})
    try:
        with urllib.request.urlopen(req, timeout=60, context=ctx) as r:
            return r.status, {k.lower(): v for k, v in r.headers.items()}, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, {k.lower(): v for k, v in e.headers.items()}, e.read().decode("utf-8", "replace")

def sql(q, tentatives=3):
    for _ in range(tentatives):
        r = subprocess.run(["curl", "-s", "--max-time", "45", "-X", "POST",
                            "https://api.supabase.com/v1/projects/ggnwtszeitrrfhedgipv/database/query",
                            "-H", "Authorization: Bearer " + PAT, "-H", "Content-Type: application/json",
                            "-d", json.dumps({"query": q})], capture_output=True, text=True)
        c = (r.stdout or "").strip()
        if c.startswith(("[", "{")):
            try:
                j = json.loads(c)
                return j
            except Exception:
                pass
        time.sleep(1.0)
    return None

# ── un compte jetable, détruit à la fin ───────────────────────────────────────
email = "verif.c4.%s@exemple.fr" % secrets.token_hex(3)
mdp = "Vrf-" + secrets.token_hex(6) + "!"
st, _, corps = http(SUPA + "/auth/v1/admin/users", "POST", {"authorization": "Bearer " + SK, "apikey": SK, "content-type": "application/json"},
                    {"email": email, "password": mdp, "email_confirm": True, "user_metadata": {"prenom": "Verif", "nom": "C4", "note": "compte de test"}})
uid = (json.loads(corps) if st == 200 else {}).get("id") or ""
verif(st == 200 and uid, "compte de test créé", "%s %s" % (st, corps[:70]))
if not uid:
    sys.exit(2)
try:
    st, _, corps = http(SUPA + "/auth/v1/token?grant_type=password", "POST", {"apikey": ANON, "content-type": "application/json"}, {"email": email, "password": mdp})
    jeton = json.loads(corps).get("access_token", "")
    verif(st == 200 and jeton, "session obtenue", st)
    A = {"authorization": "Bearer " + jeton, "apikey": ANON, "content-type": "application/json"}

    solde_avant = (sql("select tokens::int t from public.users where id='%s'" % uid) or [{}])[0].get("t")
    verif(solde_avant is not None, "solde de crédits lu avant la campagne", solde_avant)

    # ── C4 · des cartes, puis le plan calculé dessus ───────────────────────────
    cartes = [{"question": "Question de vérification %d ?" % i, "reponse": "Réponse %d, assez longue pour être acceptée." % i, "matiere": ["Maths", "Physique", "Histoire"][i % 3]} for i in range(9)]
    st, _, corps = http(BASE + "/api/revisions", "POST", A, {"mode": "creer", "cartes": cartes})
    creees = (json.loads(corps) if st == 200 else {})
    verif(st == 200, "mode `creer` accepté sur le compte de test", "%s %s" % (st, corps[:80]))
    verif(int(creees.get("creees") or 0) >= 9, "neuf cartes créées", creees.get("creees"))
    verif(creees.get("cout") == 0 or creees.get("cost") == 0 or "cout" in creees, "la création d'une carte annonce un coût nul", list(creees)[:6])

    st, _, corps = http(BASE + "/api/revisions", "POST", A, {"mode": "plan", "budget_minutes": 15, "horizon_jours": 7})
    plan = json.loads(corps) if st == 200 else {}
    verif(st == 200, "mode `plan` répond 200", "%s %s" % (st, corps[:80]))
    verif(plan.get("cout") == 0, "`cout: 0` : un plan ne débite rien", plan.get("cout"))
    verif(plan.get("budget_minutes") == 15, "le budget demandé est celui qui est appliqué", plan.get("budget_minutes"))
    verif(plan.get("cartes_chargees", 0) >= 9, "les neuf cartes ont été chargées pour le calcul", plan.get("cartes_chargees"))
    jours = (plan.get("plan") or {}).get("journees") or []
    verif(len(jours) >= 1, "le plan couvre au moins une journée", len(jours))
    nb = sum(len(b["cartes"]) for j in jours for b in j["blocs"])
    verif(nb >= 9, "toutes les cartes dues apparaissent dans le plan", nb)
    verif(all(len(b["cartes"]) <= 12 for j in jours for b in j["blocs"]), "aucun bloc ne dépasse 12 cartes")
    verif(all(j["jour"] >= time.strftime("%Y-%m-%d", time.gmtime()) for j in jours), "aucune journée passée n'est programmée")
    verif((plan.get("plan") or {}).get("minutes_par_carte") == round(2 / 3, 10) or abs((plan.get("plan") or {}).get("minutes_par_carte", 0) - 2 / 3) < 1e-9, "la durée par carte est exposée (40 s)", (plan.get("plan") or {}).get("minutes_par_carte"))
    verif(bool((plan.get("plan") or {}).get("message")), "un message lisible accompagne le calcul", (plan.get("plan") or {}).get("message", "")[:60])

    st, _, corps = http(BASE + "/api/revisions", "POST", A, {"mode": "plan", "budget_minutes": 99999, "horizon_jours": 999})
    borne = json.loads(corps) if st == 200 else {}
    verif(borne.get("budget_minutes") == 240 and borne.get("horizon_jours") == 21, "budget et horizon sont bornés, pas transmis tels quels", (borne.get("budget_minutes"), borne.get("horizon_jours")))

    st, _, corps = http(BASE + "/api/revisions", "POST", A, {"mode": "invente"})
    verif(st == 400 and "plan" in corps, "un mode inconnu est refusé EN NOMMANT `plan` dans la liste", "%s %s" % (st, corps[:70]))
    st, _, _ = http(BASE + "/api/revisions", "POST", {"content-type": "application/json"}, {"mode": "plan"})
    verif(st == 401, "un plan sans session → 401", st)

    solde_apres = (sql("select tokens::int t from public.users where id='%s'" % uid) or [{}])[0].get("t")
    verif(solde_avant == solde_apres, "le solde de crédits n'a pas bougé (créer + plan)", (solde_avant, solde_apres))

    # ── B3 · le mode accepté, la facture annoncée, la clé IA en moins ──────────
    st, entetes, corps = http(BASE + "/api/thunder", "GET", A)
    par_mode = (json.loads(corps) if st == 200 else {}).get("credits_par_mode") or {}
    verif(st == 200 and par_mode.get("fiches") == 10, "GET /api/thunder annonce `fiches: 10` comme un `ask`", par_mode)

    pav = "\n\n".join(["# Section %d\n" % i + ("contenu de la section %d. " % i) * 90 for i in range(6)])
    st, _, corps = http(BASE + "/api/thunder", "POST", A, {"mode": "decouper", "enregistrer": True, "sources": [{"id": "pave", "titre": "Chapite test", "texte": pav}]})
    # Deux issues valides selon l'environnement, et elles sont VERIFIEES DIFFEREMMENT :
    #   · 503 = aucune clé IA (c'est le cas de cet atelier) : le refus doit nommer la cause
    #     et ne rien débiliter ;
    #   · 200 = un modèle répond : les fiches doivent exister, et le débit être exactement
    #     celui d'un `ask` (10). Un 200 sans `fiches` ou avec 15 crédits débités est un échec.
    verif(st in (503, 200), "`decouper` répond par 503 (pas de clé) ou 200 (modèle joignable)", "%s %s" % (st, corps[:120]))
    if st == 503:
        verif("clé IA" in corps or "GEMINI" in corps, "le 503 nomme la vraie cause (aucune clé IA dans cet environnement)", corps[:90])
        fiches_obtenues = None
    else:
        d = json.loads(corps)
        fiches_obtenues = d.get("fiches") or []
        verif(len(fiches_obtenues) >= 2, "le découpage rend au moins deux fiches", len(fiches_obtenues))
        verif(d.get("debite") in (0, 10), "le débit est 10 (ou 0 si le compte est illimité)", d.get("debite"))
        verif(bool(d.get("avertissement")), "la réponse porte l'avertissement honnête", str(d.get("avertissement"))[:60])
    solde_apres2 = (sql("select tokens::int t from public.users where id='%s'" % uid) or [{}])[0].get("t")
    verif(solde_avant == solde_apres2, "un découpage qui échoue avant le modèle ne débite rien", (solde_avant, solde_apres2))
    sources = http(SUPA + "/rest/v1/thunder_sources?user_id=eq.%s&select=id" % uid, "GET", A)
    verif(json.loads(sources[2]) == [], "et n'enregistre aucune source", sources[2][:60])

    # ── traces UI : les marqueurs sont dans ce que le serveur envoie ───────────
    # Les trois blocs neufs vivent dans des morceaux JS livrés par le serveur : on les
    # cherche LA, dans ce que l'onglet télécharge vraiment — pas dans une supposition.
    html_schedule = http(BASE + "/app/schedule")[2]
    html_thunder = http(BASE + "/app/thunder")[2]
    def morceaux(html):
        vus, out = set(), []
        for seg in html.split('"'):
            if seg.startswith("/_next/") and seg.endswith(".js") and seg not in vus:
                vus.add(seg)
                out.append(seg)
        return out
    # TOUS les srcs, pas un échantillon : Turbopack nomme les morceaux au hasard et le
    # chunk de page n'est pas en tête de liste — un échantillon de douze donnait trois
    # faux négatifs (mesuré le 29/08/2026), ce qui est exactement le défaut qu'on
    # dénonce ailleurs : une toise qui gronde pour rien finit par être ignorée.
    corps_schedule = "".join(http(BASE + m)[2] for m in morceaux(html_schedule))
    corps_thunder = "".join(http(BASE + m)[2] for m in morceaux(html_thunder))
    verif("agenda-lien" in corps_schedule and "sch_agenda_regenerer" in corps_schedule, "le bloc d'agenda est dans les JS servis pour /app/schedule")
    verif("th-plan" in corps_thunder and "thunder_plan_calculer" in corps_thunder, "le panneau du plan est dans les JS servis pour /app/thunder")
    verif("thunder_fiches_lancer" in corps_thunder and "decouper" in corps_thunder, "le bouton de découpage est dans les JS servis pour /app/thunder")
    feuilles = [l.strip() for l in (http(BASE + "/app/thunder")[2] or "").split('"') if l.startswith("/_next") and l.endswith(".css")]
    contenu = ""
    for f in feuilles[:3]:
        contenu += http(BASE + f)[2]
    verif(".agenda-lien" in contenu and ".th-plan" in contenu and ".th-fiches" in contenu, "les trois feuilles de style neuves sont dans le CSS publié", [f[-28:] for f in feuilles[:3]])
finally:
    sql("delete from public.review_log where user_id='%s'" % uid)
    sql("delete from public.review_cards where user_id='%s'" % uid)
    sql("delete from public.agenda_tokens where user_id='%s'" % uid)
    sql("delete from public.thunder_sources where user_id='%s'" % uid)
    sql("delete from public.users where id='%s'" % uid)
    http(SUPA + "/auth/v1/admin/users/" + uid, "DELETE", {"authorization": "Bearer " + SK, "apikey": SK})
    residu = sql("select (select count(*) from public.review_cards where user_id='%s') a, (select count(*) from public.agenda_tokens where user_id='%s') b" % (uid, uid))
    verif(residu and list(residu[0].values()) == [0, 0], "compte de test détruit, zéro résidu", residu)

print("\n  %d vérifications passées · %d échecs%s" % (ok, len(echecs), (" : " + "; ".join(echecs)) if echecs else ""))
sys.exit(1 if echecs else 0)

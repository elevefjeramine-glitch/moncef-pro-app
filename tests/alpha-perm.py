# -*- coding: utf-8 -*-
"""Matrice de droits du panneau ALPHA, mesurée et rejouable :
    npm run verif:alpha
Règle écrite le 29/08/2026 : un modérateur n'a plus la console IA et ne peut
supprimer personne — ni toucher les rôles ni les crédits. Le fondateur garde tout.

Deux étages, parce que les deux se vérifient différemment :
  1. le code (toujours) : les gardes existent, ils sont posés AVANT les écritures,
     et l'interface ne promet plus ce que le serveur refuse ;
  2. le réseau (si BASE, TOK_FONDATEUR et TOK_MODERATEUR sont dans l'environnement) :
     chaque action est réellement appelée avec chaque session, et on exige le code
     HTTP attendu. Sans ces variables, l'étage 2 s'affiche comme « non joué », pas
     comme « réussi » — un test qui félicite ce qu'il n'a pas vérifié est pire
     qu'un test absent.
"""
import io
import json
import os
import re
import sys
import urllib.error
import urllib.request

ok = ko = non_joue = 0


def nom(label, cond, detail=""):
    global ok, ko
    if cond:
        ok += 1
        print("   OK  %s%s" % (label, ("  → " + str(detail)) if detail else ""))
    else:
        ko += 1
        print("   RATÉ %s%s" % (label, ("  → " + str(detail)) if detail else ""))


def lu(chemin):
    return io.open(chemin, encoding="utf-8").read()


ROUTE = lu("src/app/api/alpha/route.ts")
ASSIST = lu("src/app/api/alpha/assistant/route.ts")
PAGE = lu("src/app/app/alpha/page.tsx")
I18N = lu("src/utils/i18n.tsx")
DOCS = lu("src/app/api-docs/page.tsx")

print("════ le garde est là, et il est bien placé ════")
i_garde = ROUTE.find("RESERVE_FONDATEUR")
i_switch = ROUTE.find("switch (action)")
nom("la liste des actions réservées au fondateur existe", i_garde > 0)
bloc = ROUTE[i_garde:ROUTE.find(";", i_garde) + 1] if i_garde > 0 else ""
for a in ["UPDATE_USER", "DELETE_USER", "RESET_TOKENS", "PURGE_DUE_DELETIONS"]:
    nom("%s est réservée au fondateur" % a, a in bloc, a)
nom("le garde s'exécute AVANT le switch (donc avant toute écriture)", 0 < i_garde < i_switch,
    "garde ligne %d, switch ligne %d" % (ROUTE[:i_garde].count("\n") + 1, ROUTE[:i_switch].count("\n") + 1))
i_role = ROUTE.find("['founder', 'moderator']")
nom("le refus d'accès général reste posé avant (un compte normal ne passe pas)", 0 < i_role < i_garde)

print("\n════ les vieilles tolérances ont disparu ════")
nom("plus de « les modérateurs ne peuvent supprimer que les comptes normaux »",
    "ne peuvent supprimer que les comptes" not in ROUTE)
nom("plus de « les modérateurs ne peuvent modifier que les comptes normaux »",
    "ne peuvent modifier que les comptes" not in ROUTE)
nom("la purge de la file des suppressions est derrière le garde",
    0 < i_garde < ROUTE.find("purgeDueDeletions(admin)"))
nom("RESET_TOKENS est bien Listé dans le garde (c'était la porte sans contrôle)",
    "RESET_TOKENS" in bloc)

print("\n════ la console IA ════")
nom("/api/alpha/assistant n'accepte plus que le fondateur",
    re.search(r'!==\s*"founder"', ASSIST) is not None)
nom("le message dit ce que le modérateur garde", "dashboard" in ASSIST and "devoirs" in ASSIST)
nom("donner_credits exige le fondateur",
    re.search(r'if \(!estFondateur\) return \{ erreur: "seul un fondateur touche le solde', ASSIST) is not None)
nom("proposer_suppression exige le fondateur (déjà vrai, vérifié)",
    "seul un fondateur peut demander une suppression" in ASSIST)

print("\n════ l'interface ne promet plus ce que le serveur refuse ════")
onglet = re.search(r"\.\.\.\(userRole === 'founder' \? \[\{ id: 'ai'.*?\}\] : \[\]\)", PAGE, re.S)
nom("l'onglet Console IA est conditionné au rôle fondateur", onglet is not None)
nom("aucun bouton d'écriture (crayon, corbeille) ne reste pour un modérateur",
    "(userRole === 'moderator' && u.role === 'normal')" not in PAGE)
nom("la page bascule hors de l'onglet IA si le rôle change",
    "tab === 'ai' && userRole !== 'founder'" in PAGE)
nom("le modérateur lit pourquoi : la notice existe dans les 5 langues",
    I18N.count("alpha_readonly_admin") == 5)
MARQUES = {"fr": "réservée au fondateur", "en": "reserved for the founder", "es": "reservada al fundador",
           "ar": "مخصّصة للمؤسس", "zh": "仅限创始人"}
manquantes = [l for l, m in MARQUES.items() if m not in DOCS]
nom("la règle est écrite dans la documentation de l'API, dans les 5 langues",
    not manquantes, "manque : " + ", ".join(manquantes) if manquantes else "5/5")

# ── étage 2 : le réseau ────────────────────────────────────────────────────────
BASE = os.environ.get("BASE", "").rstrip("/")
TOKS = {"fondateur": os.environ.get("TOK_FONDATEUR", ""), "modérateur": os.environ.get("TOK_MODERATEUR", "")}
print("\n════ appelé pour de vrai ════")
if not (BASE and all(TOKS.values())):
    non_joue = 1
    print("   NON JOUÉ  BASE / TOK_FONDATEUR / TOK_MODERATEUR absents de l'environnement")
else:
    def alpha(action, tok, payload=None):
        corps = json.dumps({"action": action, "authToken": tok, "payload": payload or {}}).encode()
        req = urllib.request.Request(BASE + "/api/alpha", data=corps, method="POST", headers={
            "content-type": "application/json", "user-agent": "python-urllib/3.11"})
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                return r.status, json.loads(r.read().decode() or "{}")
        except urllib.error.HTTPError as e:
            return e.code, json.loads((e.read().decode() or "{}") if e.headers.get("content-type", "").startswith("application/json") else "{}")
        except Exception as e:
            return -1, {"error": str(e)[:120]}

    def assistant(tok):
        corps = json.dumps({"authToken": tok, "messages": [{"role": "user", "content": "passe test@exemple.fr en modératrice"}]}).encode()
        req = urllib.request.Request(BASE + "/api/alpha/assistant", data=corps, method="POST", headers={
            "content-type": "application/json", "user-agent": "python-urllib/3.11"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.status, json.loads(r.read().decode() or "{}")
        except urllib.error.HTTPError as e:
            return e.code, {"error": e.read().decode()[:120]}
        except Exception as e:
            return -1, {"error": str(e)[:120]}

    # La cible des quatre appels à risque est DONNÉE par l'environnement, et jamais
    # choisie dans la liste des comptes : un test qui vérifierait « le modérateur ne
    # peut pas supprimer » sur le premier compte normal venu supprimerait un vrai
    # élève le jour où le garde saute. Sans CIBLE_ID, ces checks sont « non joués ».
    cible = os.environ.get("CIBLE_ID", "").strip()
    if not cible:
        non_joue += 1
        print("   NON JOUÉ  CIBLE_ID absent : aucun compte réel ne sera utilisé comme cible")
    for action, attendu_mod in [("UPDATE_USER", 403), ("DELETE_USER", 403), ("RESET_TOKENS", 403), ("PURGE_DUE_DELETIONS", 403)]:
        if not cible:
            break
        st, reponse = alpha(action, TOKS["modérateur"], {"userId": cible, "updates": {"tokens": 5}, "amount": 5})
        nom("modérateur · %s" % action, st == attendu_mod, "HTTP %s · %s" % (st, str(reponse.get("error"))[:64]))
    for action in ["GET_STATS", "GET_USERS", "GET_ALL_HOMEWORK"]:
        st, _ = alpha(action, TOKS["modérateur"])
        nom("modérateur · %s reste en lecture" % action, st == 200, "HTTP %s" % st)
    st, _ = assistant(TOKS["modérateur"])
    nom("modérateur · console IA refusée", st == 403, "HTTP %s" % st)
    st, _ = assistant(TOKS["fondateur"])
    nom("fondateur · console IA toujours ouverte", st == 200, "HTTP %s" % st)
    if cible:
        solde_avant = None
        _, listing = alpha("GET_USERS", TOKS["fondateur"])
        for u in (listing.get("data") or []):
            if u.get("id") == cible:
                solde_avant = u.get("tokens")
        st, _ = alpha("UPDATE_USER", TOKS["fondateur"], {"userId": cible, "updates": {"tokens": 700}})
        nom("fondateur · UPDATE_USER passe (le pouvoir n'est pas retiré, il est déplacé)", st == 200, "HTTP %s" % st)

print("\n   ═══ %d critères réussis, %d échec(s)%s ═══" % (
    ok, ko, ", %d étage(s) non joué(s)" % non_joue if non_joue else ""))
sys.exit(1 if ko else 0)

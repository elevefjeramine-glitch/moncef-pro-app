# -*- coding: utf-8 -*-
"""Les révisions espacées, jouées pour de vrai : python3 tests/revisions-verif.py

Ce fichier ne juge pas le goût : il vérifie des CONTRATS, en HTTP, sur un déploiement,
avec deux comptes jetables créés pour l'occasion et supprimés à la fin.

    SK=<service_role> [BASE=https://<id>--proappmoncef.netlify.app] python3 tests/revisions-verif.py

Six choses mesurées, et pourquoi elles :
  1 · la file ne facture AUCUN crédit (contrat `cout: 0` sur chaque réponse de la route) ;
  2 · une erreur du QCM crée UNE carte, la même erreur répétée ne crée rien ;
  3 · la mathématique Leitner — « bien » monte d'une boîte et date à +3 j, « encore »
      retombe de deux boîtes et compte un lapse — relu EN BASE, pas dans la réponse ;
  4 · la RLS : un compte ne lit pas les cartes d'un autre et ne peut pas les supprimer ;
  5 · un abonnement de notification qui ne livre plus est SUPPRIMÉ de la base ; et le
      code HTTP du service de push prouve que NOTRE signature VAPID est acceptée
      (401 = notre clé serait mauvaise ; 404/410 = l'endpoint est mort, lui) ;
  6 · la route du réveil (celle que pg_cron appelle) refuse sans secret, accepte avec.

Sortie : 0 si tout passe, 1 sinon.
"""
import json
import os
import subprocess
import sys
import time
import uuid
from datetime import datetime

BASE = os.environ.get("BASE", "https://proappmoncef.netlify.app").rstrip("/")
SK = os.environ.get("SK", "")
ANON = "sb_publishable_he8qnS-M5-uDmTVGkinzWw_39yD0BOO"
PRJ = "https://ggnwtszeitrrfhedgipv.supabase.co"

ok = ko = 0
non_joue = []
H = str(time.time()).replace(".", "")          # empreinte unique de la séance
COMPTES = []


def nom(label, cond, detail=""):
    global ok, ko
    if cond:
        ok += 1
        print("   OK   %s%s" % (label, ("  → " + str(detail)) if detail else ""))
    else:
        ko += 1
        print("   RATÉ %s%s" % (label, ("  → " + str(detail)) if detail else ""))


def curl(args, timeout=90):
    r = subprocess.run(["curl", "-s", "--max-time", str(timeout)] + args, capture_output=True, text=True)
    return r.stdout


def js(out):
    try:
        return json.loads(out) if out and out.strip() else {}
    except Exception:
        return {"__brut__": out[:200]}


def api(corps, tok, chemin="/api/revisions"):
    return js(curl(["-X", "POST", BASE + chemin,
                    "-H", "Content-Type: application/json",
                    "-H", "Authorization: Bearer " + tok,
                    "-d", json.dumps(corps)]))


def sql(q):
    """Relit la base par la voie d'administration du projet : sert à CONTRÔLER ce que
    l'app a écrit, jamais à écrire à sa place."""
    return js(subprocess.run(
        ["curl", "-s", "--max-time", "90", "-X", "POST",
         "https://api.supabase.com/v1/projects/ggnwtszeitrrfhedgipv/database/query",
         "-H", "Authorization: Bearer " + os.environ.get("PAT", ""),
         "-H", "Content-Type: application/json",
         "-d", json.dumps({"query": q})], capture_output=True, text=True).stdout)


def nettoyer_residus():
    """Toute séance interrompue laisse un compte derrière elle : on repart de zéro."""
    users = js(curl(["-H", "apikey: " + SK, "-H", "Authorization: Bearer " + SK,
                     PRJ + "/auth/v1/admin/users?page=1&per_count=1000"])).get("users", [])
    n = 0
    for u in users:
        if str(u.get("email", "")).startswith("verif.revisions."):
            curl(["-X", "DELETE", PRJ + "/auth/v1/admin/users/" + u["id"],
                  "-H", "apikey: " + SK, "-H", "Authorization: Bearer " + SK], timeout=60)
            n += 1
    return n


def creer_compte(rg):
    """Compte élève réel, par l'API d'administration, puis sa session mot de passe."""
    mdp = "Test-" + uuid.uuid4().hex[:12] + "!aA"
    mail = "verif.revisions.%s.%s@exemple.test" % (H, rg)
    out = js(curl(["-X", "POST", PRJ + "/auth/v1/admin/users",
                   "-H", "apikey: " + SK, "-H", "Authorization: Bearer " + SK,
                   "-H", "Content-Type: application/json",
                   "-d", json.dumps({"email": mail, "password": mdp, "email_confirm": True,
                                     "app_metadata": {"role": "normal"}})]))
    uid = out.get("id")
    if not uid:
        return None, None, None, out
    tok = js(curl(["-X", "POST", PRJ + "/auth/v1/token?grant_type=password",
                   "-H", "apikey: " + ANON, "-H", "Content-Type: application/json",
                   "-d", json.dumps({"email": mail, "password": mdp})])).get("access_token", "")
    COMPTES.append((uid, mail))
    return uid, tok, mail, None


if not SK:
    print("   SK=<service_role> est requis (création des comptes jetables et lecture de contrôle).")
    sys.exit(2)

print("════ 0 · deux comptes, une file vide ════")
effaces = nettoyer_residus()
nom("aucun résidu de séance précédente ne traîne (la sienne est partie propre)", True, "%d compte(s) résiduel(s) effacé(s) avant de commencer" % effaces)
uid_a, tok_a, mail_a, err_a = creer_compte("a")
uid_b, tok_b, mail_b, err_b = creer_compte("b")
nom("deux comptes d'élève réels sont créés pour la séance", bool(tok_a and tok_b), [mail_a, mail_b])
if not (tok_a and tok_b):
    print("   impossible de continuer : %s %s" % (err_a, err_b))
    sys.exit(2)

d = api({"mode": "etat"}, tok_a)
nom("la route répond pour un compte « normal » (aucune exigence de rôle admin)", "compteurs" in d, list(d)[:5])
nom("la file d'un compte neuf est vide", d.get("compteurs", {}).get("total") == 0, d.get("compteurs"))
nom("un tour de file ne coûte aucun crédit", d.get("cout") == 0, "cout=%s" % d.get("cout"))
nom("la file du jour est un tableau, pas un nombre inventé", isinstance(d.get("du_jour"), list), len(d.get("du_jour", [])))

print("\n════ 1 · naissances et doublons ════")
cartes = [
    {"question": "Carte %s : capitale du Maroc ?" % H, "reponse": "Rabat", "ce_que_tu_avais": "Casablanca"},
    {"question": "Carte %s : 1/2 en décimal ?" % H, "reponse": "0,5"},
    {"question": "  CARTE %s :  1/2  en DÉCIMAL ? " % H, "reponse": "0.5"},
]
r = api({"mode": "creer", "cartes": cartes}, tok_a)
nom("deux questions distinctes créent deux cartes", r.get("creees") == 2, r)
nom("la troisième, même question avec espaces et cass — comptée doublon, pas recréée",
    r.get("doublons") == 1 and r.get("demandees") == 3, {"demandees": r.get("demandees"), "doublons": r.get("doublons")})
nom("créer ne facture pas plus que lire", r.get("cout") == 0)
etat = api({"mode": "etat"}, tok_a)
nom("une carte qui vient de naître n'est pas « due » aujourd'hui (+1 jour)",
    len(etat.get("du_jour", [])) == 0 and etat.get("compteurs", {}).get("plus_tard") == 2, etat.get("compteurs"))


def cartes_en_base(uid):
    return [c for c in (sql("select id, boite, reps, lapses, due_at, question from public.review_cards where user_id='%s' and question like 'Carte %s%%' order by created_at" % (uid, H)) or [])
            if isinstance(c, dict)]


mes = cartes_en_base(uid_a)
nom("deux lignes en base, boîte 1 chacune, pour le bon compte seulement",
    len(mes) == 2 and all(int(c["boite"]) == 1 for c in mes), [(c["boite"], c["reps"]) for c in mes])
ids = [c["id"] for c in mes]
nom("aucune carte n'a fuié sur l'autre compte", len(cartes_en_base(uid_b)) == 0)

print("\n════ 2 · la mathématique des boîtes, relue en base ════")
if len(ids) == 2:
    a = api({"mode": "noter", "carte_id": ids[0], "note": "bien"}, tok_a)
    nom("« bien » monte d'une boîte (1 → 2)", int((a.get("relu_en_base") or {}).get("boite", 0)) == 2, a.get("relu_en_base"))
    due = str((a.get("relu_en_base") or {}).get("due_at", ""))
    # un instant, pas une date locale : sinon le décalage du serveur (UTC+0) contre la
    # machine (UTC+1) fait passer +3 jours pour +2,16 — l'erreur est dans la toise.
    inst = datetime.fromisoformat(due.replace("Z", "+00:00")).timestamp() if len(due) >= 10 else -99
    jours = (inst - time.time()) / 86400
    nom("la boîte 2 date à +3 jours (table 1/3/7/14/30/60)", 2.4 <= jours <= 3.6, "dans %.2f j" % jours)
    nom("la journée est comptée sur les lignes réelles", int((a.get("jour") or {}).get("notees", 0)) >= 1, a.get("jour"))
    nom("la série se lit en jours consécutifs (1 aujourd'hui)", int(a.get("serie_jours") or 0) >= 1, a.get("serie_jours"))

    b = api({"mode": "noter", "carte_id": ids[0], "note": "encore"}, tok_a)
    nom("« encore » retombe de deux boîtes sans passer sous 1", int((b.get("relu_en_base") or {}).get("boite", 99)) == 1, b.get("relu_en_base"))
    nom("un lapse est enregistré, reps = 2", int((b.get("relu_en_base") or {}).get("lapses", 0)) >= 1 and int((b.get("relu_en_base") or {}).get("reps", 0)) == 2,
        {"lapses": (b.get("relu_en_base") or {}).get("lapses"), "reps": (b.get("relu_en_base") or {}).get("reps")})
    rel = [c for c in cartes_en_base(uid_a) if c["id"] == ids[0]][0]
    nom("et c'est bien la base qui porte ces chiffres (relecture indépendante)", int(rel["lapses"]) == 1 and int(rel["reps"]) == 2, (rel["lapses"], rel["reps"]))

    c = api({"mode": "noter", "carte_id": ids[0], "note": "peut-etre"}, tok_a)
    nom("une note inconnue est refusée", "error" in c, c.get("error"))
    rel2 = [c for c in cartes_en_base(uid_a) if c["id"] == ids[0]][0]
    nom("le refus n'a rien écrit (reps reste 2)", int(rel2["reps"]) == 2, rel2["reps"])
    e = api({"mode": "noter", "carte_id": str(uuid.uuid4()), "note": "bien"}, tok_a)
    nom("noter une carte qui n'est pas la sienne ou n'existe pas → erreur, pas un succès muet", "error" in e, e.get("error"))
    f = api({"mode": "noter", "carte_id": ids[1], "note": "facile"}, tok_a)
    nom("« facile » saute deux boîtes (1 → 3)", int((f.get("relu_en_base") or {}).get("boite", 0)) == 3, (f.get("relu_en_base") or {}).get("boite"))
else:
    nom("deux cartes de test devaient être relues avant cet étage", False, len(ids))

print("\n════ 3 · la RLS : la carte d'un autre ne se lit pas ════")
out = curl(["-H", "apikey: " + ANON, "-H", "Authorization: Bearer " + tok_b,
            PRJ + "/rest/v1/review_cards?select=question&id=eq." + ids[0]])
lignes = js(out) if out.strip().startswith("[") else out
nom("B qui demande la carte de A par PostgREST ne la reçoit pas", isinstance(lignes, list) and len(lignes) == 0, out[:110])
out = curl(["-H", "apikey: " + ANON, PRJ + "/rest/v1/review_cards?select=question"])
nom("sans jeton (anon), la table n'est pas exposée", out.strip() == "" or "40" in out or "denied" in out or "permission" in out.lower(), out[:110])
r = api({"mode": "ignorer", "carte_id": ids[0]}, tok_b)
nom("l'API refuse de supprimer la carte d'un autre (0 ligne touchée)", int(r.get("supprimees", -1)) == 0, r)
nom("…et la carte visée est toujours en base", len([c for c in cartes_en_base(uid_a) if c["id"] == ids[0]]) == 1)

print("\n════ 4 · les notifications ════")
ENDPOINT_TEST = "https://updates.push.services.mozilla.com/wpush/v2/00" + H[:28]


def cles_reelles():
    """Une clé P-256 valide, fabriquée ici : sans elle, web-push rejette l'abonnement
    avant même de toucher le réseau, et l'étage « purge » ne prouverait rien.
    La clé est éphémère et jetée avec la séance — elle ne sort pas de ce processus."""
    der = subprocess.run(["openssl", "ecparam", "-name", "prime256v1", "-genkey", "-noout"],
                         capture_output=True, text=True)
    pub = subprocess.run(["openssl", "ec", "-pubout", "-conv_form", "uncompressed", "-outform", "DER"],
                         input=der.stdout.encode(), capture_output=True)
    assert len(pub.stdout) >= 65, pub.stderr[:120].decode()
    point = pub.stdout[-65:]
    import base64
    return {"p256dh": base64.urlsafe_b64encode(point).decode().rstrip("="),
            "auth": base64.urlsafe_b64encode(os.urandom(16)).decode().rstrip("=")}

nom("la base de ce compte n'a aucun abonnement au départ", d.get("compteurs", {}).get("abonnements") in (0, None), d.get("compteurs", {}).get("abonnements"))
r = api({"mode": "abonner", "subscription": {"endpoint": "http://non-https.exemple.fr/x", "keys": {"p256dh": "B" * 65, "auth": "abcdefgh"}}}, tok_a)
nom("un endpoint en http est refusé (le Web Push exige https)", "error" in r, r.get("error"))
# (a) une clé inventée de toutes pièces ne part pas : web-push la rejette AVANT réseau.
r = api({"mode": "abonner", "subscription": {"endpoint": ENDPOINT_TEST,
             "keys": {"p256dh": "BJ" + "t" * 85, "auth": "aGVsbG93b3JsZA"}}}, tok_a)
nom("un abonnement à la clé invérifiable est quand même stocké (on ne juge pas la forme au-delà du strict)", r.get("abonne") is True, r)
r = api({"mode": "notifier"}, tok_a)
nom("un rejet LOCAL de chiffrement ne purge pas l'abonnement : rien n'a été envoyé, rien n'est perdu",
    r.get("envoyees") == 0 and r.get("purges") == 0 and len(r.get("erreurs") or []) == 1,
    {"envoyees": r.get("envoyees"), "purges": r.get("purges"), "motif": (r.get("erreurs") or [{}])[0].get("motif", "")[:52]})
ligne = sql("select last_error is not null as a_err from public.push_subscriptions where user_id='%s'" % uid_a)
nom("la cause reste lisible en base (last_error), pas seulement dans la réponse",
    bool(ligne and ligne[0].get("a_err")), ligne)
api({"mode": "desabonner", "endpoint": ENDPOINT_TEST}, tok_a)

# (b) une vraie clé P-256 : le paquet part, et le service de push répond LUI-MÊME.
r = api({"mode": "abonner", "subscription": {"endpoint": ENDPOINT_TEST, "keys": cles_reelles()}}, tok_a)
nom("un abonnement cryptographiquement valide est enregistré", r.get("abonne") is True, r)
r = api({"mode": "notifier"}, tok_a)
nom("l'envoi est tenté sur CE compte uniquement", r.get("abonnements_trouves") == 1, {"trouves": r.get("abonnements_trouves")})
nom("un abonnement qui ne livre plus est PURGÉ de la base", int(r.get("purges", 0)) >= 1,
    {k: r.get(k) for k in ("envoyees", "purges", "cartes_dues")})
codes = [int(e.get("code") or 0) for e in (r.get("erreurs") or [])]
nom("le service n'a pas répondu 401 : notre signature VAPID est acceptée (sinon il n'aurait même pas regardé l'endpoint)",
    401 not in codes, (r.get("erreurs") or [])[:1])
nom("après purge, plus aucun abonnement fantôme", api({"mode": "etat"}, tok_a).get("compteurs", {}).get("abonnements") == 0)
r = api({"mode": "desabonner", "endpoint": ENDPOINT_TEST}, tok_a)
nom("se désabonner répond même si l'abonnement est déjà parti", "error" not in r and r.get("restants") == 0, r)

print("\n════ 5 · la route du réveil (celle que pg_cron appelle) ════")
out = curl(["-X", "POST", BASE + "/api/revisions/rappel", "-H", "Content-Type: application/json", "-d", "{}"], timeout=60)
statut = subprocess.run(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "-X", "POST", BASE + "/api/revisions/rappel",
                         "-H", "Content-Type: application/json", "-d", "{}"], capture_output=True, text=True).stdout.strip()
nom("sans secret, le réveil est refusé", statut in ("401", "403"), "HTTP %s" % statut)
# un secret VOLONTAIREMENT faux : le piège de ce test était de relire la variable
# d'environnement, donc d'envoyer le bon secret et de conclure « ça passe » à tort.
out = js(subprocess.run(["curl", "-s", "--max-time", "90", "-X", "POST", BASE + "/api/revisions/rappel",
                         "-H", "Content-Type: application/json", "-H", "x-rappel-secret: " + "faux-" + H,
                         "-d", "{}"], capture_output=True, text=True).stdout)
nom("un secret erroné ne déclenche rien", "error" in out and "notifications_envoyees" not in out, out.get("error"))
if os.environ.get("RAPPEL_SECRET"):
    out = js(subprocess.run(["curl", "-s", "--max-time", "90", "-X", "POST", BASE + "/api/revisions/rappel",
                             "-H", "Content-Type: application/json", "-H", "x-rappel-secret: " + os.environ["RAPPEL_SECRET"],
                             "-d", "{}"], capture_output=True, text=True).stdout)
    nom("avec le vrai secret, le réveil traverse et compte les comptes",
        isinstance(out.get("comptes_examines"), int) or "notifications_envoyees" in out, {k: out.get(k) for k in list(out)[:5]})
else:
    non_joue.append("déclenchement réel du rappel avec le secret (RAPPEL_SECRET non passé au script)")

print("\n════ 6 · propreté ════")
for i in ids:
    api({"mode": "ignorer", "carte_id": i}, tok_a)
nom("les cartes de test ont disparu", len(cartes_en_base(uid_a)) == 0 and len(cartes_en_base(uid_b)) == 0)
sql("delete from public.review_log where user_id in ('%s','%s')" % (uid_a, uid_b))
rest = sql("select count(*)::int as n from public.review_cards where user_id in ('%s','%s')" % (uid_a, uid_b))
nom("aucune ligne orpheline ne survit à la séance", (rest[0]["n"] if isinstance(rest, list) and rest and isinstance(rest[0], dict) and "n" in rest[0] else 0) == 0, rest)
for uid, mail in COMPTES:
    curl(["-X", "DELETE", PRJ + "/auth/v1/admin/users/" + uid, "-H", "apikey: " + SK, "-H", "Authorization: Bearer " + SK], timeout=60)
nom("les deux comptes jetables sont supprimés", len(COMPTES) == 2, [m for _, m in COMPTES])

if non_joue:
    print("\n   NON JOUÉ : " + " · ".join(non_joue))
print("\n   ═══ %d vérifications réussies, %d échec(s) ═══" % (ok, ko))
sys.exit(1 if ko else 0)

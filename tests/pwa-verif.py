# -*- coding: utf-8 -*-
"""Le PWA et l'en-tête qui va avec, vérifiés sur le site réellement servi.

    BASE=https://<id>--proappmoncef.netlify.app python3 tests/pwa-verif.py

Ce que ça juge, et pourquoi ces lignes-là plutôt que « ça a l'air bon » :

  1 · le manifeste est SERVI EN `application/manifest+json` — avec `nosniff` sur tout le
      site, un manifeste en `octet-stream` est rejeté et l'installation n'est jamais
      proposée (c'est le défaut exact trouvé sur le brouillon du lot A) ;
  2 · chaque URL que le service worker précharge répond 200, sinon l'install échoue en
      silence sur le téléphone de l'élève ;
  3 · le worker ne doit PAS être cacheable longtemps : un `immutable` sur /sw-offline.js
      condamne le site à servir le même hors-ligne pour toujours ;
  4 · les en-têtes qui governent ces fonctions : `microphone=(self)` (sinon notre propre
      Permissions-Policy bloque la dictée) et `camera=()` (rien ne filme) ;
  5 · `theme-color` est dans le HTML — Next a déplacé ce champ hors de `metadata`, et
      l'avoir laissé dans `metadata` produit un build propre et un meta ABSENT ;
  6 · les modules du lot A sont dans le bundle publié (voix, dictée, import), et les
      classes CSS correspondantes dans la feuille publiée ;
  7 · les noms de caches écrits dans `src/lib/hors-ligne.ts` sont bien les mêmes que dans
      le fichier de worker publié (dérive = le worker vide un cache que personne n'écrit).

Sortie : 0 si tout passe, 1 sinon.
"""
import json
import os
import re
import subprocess
import sys

BASE = os.environ.get("BASE", "https://proappmoncef.netlify.app").rstrip("/")
RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ok = ko = 0
non_joue = []


def nom(label, cond, detail=""):
    global ok, ko
    if cond:
        ok += 1
        print("   OK   %s%s" % (label, ("  → " + str(detail)) if detail else ""))
    else:
        ko += 1
        print("   RATÉ %s%s" % (label, ("  → " + str(detail)) if detail else ""))


def tete(chemin):
    out = subprocess.run(["curl", "-s", "-D", "-", "-o", "/tmp/.corps", "--max-time", "60", BASE + chemin], capture_output=True, text=True).stdout
    corps = open("/tmp/.corps", "rb").read()
    h = {}
    statut = "?"
    # `-D -` rend CRLF ou LF selon le terminal : splitlines est le seul truc honnête.
    for ligne in out.splitlines():
        if ligne.upper().startswith("HTTP/"):
            statut = ligne.split()[1]
        elif ":" in ligne:
            k, v = ligne.split(":", 1)
            h.setdefault(k.strip().lower(), []).append(v.strip())
    return statut, h, corps


def un(heures, cle):
    return (heures.get(cle) or [""])[0]


print("════ 1 · le manifeste ════")
statut, h, corps = tete("/manifest.webmanifest")
nom("il répond", statut == "200", "HTTP %s" % statut)
type_manifeste = un(h, "content-type")
nom("en `application/manifest+json` (sinon nosniff le rejette)", type_manifeste.startswith("application/manifest+json"), type_manifeste)
try:
    m = json.loads(corps.decode("utf-8"))
    parse = True
except Exception as e:
    m, parse = {}, False
    print("     parsing : %s" % e)
nom("c'est du JSON valide avec les quatre champs qui comptent",
    parse and all(m.get(k) for k in ("name", "start_url", "scope", "display")), {k: m.get(k) for k in ("start_url", "scope", "display")})
types = sorted({i.get("purpose", "any") for i in m.get("icons", [])})
nom("au moins deux icônes, dont une maskable (sinon Android rogne le logo)", len(m.get("icons", [])) >= 2 and "maskable" in types, types)
ratées = []
for ic in m.get("icons", []):
    s2, _, c2 = tete(ic["src"])
    if s2 != "200" or len(c2) < 400:
        ratées.append(ic["src"])
for sc in m.get("shortcuts", []):
    s2, _, _ = tete(sc["url"])
    if s2 not in ("200", "307", "308"):
        ratées.append(sc["url"])
nom("chaque ressource citée par le manifeste existe vraiment", not ratées, ratées or "icônes et raccourcis tous en 200")
if m.get("theme_color"):
    nom("theme_color du manifeste = la couleur de l'app", m["theme_color"] == "#0b1f13", m["theme_color"])

print("\n════ 2 · le HTML de la racine ════")
s3, _, html = tete("/")
html = html.decode("utf-8", "replace")
nom('Next lie le manifeste tout seul (<link rel="manifest">)', 'rel="manifest"' in html, re.findall(r'<link rel="manifest"[^>]*>', html)[:1])
meta = re.findall(r'<meta name="theme-color" content="([^"]+)"', html)
nom("theme-color présent dans le HTML (l'export `viewport`, pas `metadata`)", meta == ["#0b1f13"], meta or "aucun meta")
nom("et une seule fois (deux metas = deux couleurs selon le navigateur)", len(meta) == 1, len(meta))

print("\n════ 3 · le service worker ════")
s4, h4, sw = tete("/sw-offline.js")
sw_txt = sw.decode("utf-8", "replace")
nom("le worker est servi", s4 == "200", "HTTP %s · %d octets" % (s4, len(sw)))
nom("avec un type JavaScript", "javascript" in un(h4, "content-type"), un(h4, "content-type"))
cache = un(h4, "cache-control")
nom("pas `immutable` : un worker figé ne se mettrait plus jamais à jour", "immutable" not in cache, cache or "aucun Cache-Control")
for m2 in ("moncef-statique-v1", "moncef-pages-v1", "moncef-fiches-v1"):
    if m2 not in sw_txt:
        nom("le cache %s est nommé dans le worker" % m2, False, "absent")
        break
else:
    lib = open(os.path.join(RACINE, "src", "lib", "hors-ligne.ts"), encoding="utf-8").read()
    noms = re.findall(r'"(moncef-[a-zé-]+-v\d+)"', lib)
    nom("les noms de caches du module et du worker sont les mêmes (pas de dérive)", all(n in sw_txt for n in noms), noms)
nom("le worker refuse de mettre en cache une écriture", 'method !== "GET"' in sw_txt, [l.strip() for l in sw_txt.splitlines() if 'method !==' in l][:1])
pre = list(dict.fromkeys(re.findall(r'"(/[a-z0-9./_-]*)"', sw_txt[sw_txt.find("PRECHARGE") : sw_txt.find("NOTRE_FAMILLE")])))
mauvaises = []
for u in pre:
    s5, _, _ = tete(u)
    if s5 not in ("200", "307", "308"):
        mauvaises.append("%s→%s" % (u, s5))
nom("tout ce que le worker précharge répond (%d URL testées)" % len(pre), bool(pre) and not mauvaises, mauvaises or "200 partout")

print("\n════ 4 · les en-têtes qui gouvernent ces fonctions ════")
for chemin in ("/", "/app/thunder"):
    _, hh, _ = tete(chemin)
    pp = un(hh, "permissions-policy")
    nom("microphone autoriser pour le site (dictée) sur %s" % chemin, "microphone=(self)" in pp, pp[:66])
    nom("camera toujours coupé sur %s" % chemin, "camera=()" in pp, "…" if pp else "aucun en-tête")
    nom("nosniff tenu sur %s" % chemin, un(hh, "x-content-type-options") == "nosniff", un(hh, "x-content-type-options"))

print("\n════ 5 · le worker PDF du bouton « glisse ton cours » ════")
s6, h6, pdfw = tete("/pdf.worker.min.mjs")
nom("le worker de lecture PDF est servi", s6 == "200", "HTTP %s · %.1f Mo" % (s6, len(pdfw) / 1e6))
nom("en JavaScript (un .mjs en octet-stream serait refusé par nosniff)", "javascript" in un(h6, "content-type"), un(h6, "content-type"))
try:
    version = json.load(open(os.path.join(RACINE, "node_modules", "pdfjs-dist", "package.json")))["version"]
    nom("et il porte le millésime de la bibliothèque", version in pdfw.decode("latin-1")[:2_600_000], "pdfjs v%s" % version)
except Exception as e:
    non_joue.append("millésime du worker (node_modules absent : %s)" % type(e).__name__)

print("\n════ 6 · le lot A est-il dans le bundle publié ? ════")
s7, _, page = tete("/app/thunder")
page = page.decode("utf-8", "replace")
chunks = sorted(set(re.findall(r'/_next/static/[^"]+\.js', page)))
marque = {"th-depot-zone": "la zone de dépôt", "thunder_voix": "le bouton d'écoute", "speechSynthesis": "l'appel à la synthèse vocale", "webkitSpeechRecognition": "la détection de la dictée", "sw-offline.js": "l'enregistrement du worker"}
trouves = {k: False for k in marque}
for c in chunks:
    _, _, corps_c = tete(c)
    txt = corps_c.decode("utf-8", "replace")
    for k in marque:
        if k in txt:
            trouves[k] = True
manquants = [v for k, v in marque.items() if not trouves[k]]
nom("les cinq pièces du lot A sont dans les chunks livrés (%d chunks lus)" % len(chunks), not manquants, manquants or "toutes")
css = sorted(set(re.findall(r'/_next/static/[^"]+\.css', page)))
classes = ["th-depot", "th-depot-zone", "th-depot-erreur", "th-depot-rapport", "th-bouton--parle", "th-bouton--dicte", "th-voix-note", "hp-barre", "hp-barre-bouton"]
vu = set()
for c in css:
    _, _, cc = tete(c)
    for k in classes:
        if ("." + k) in cc.decode("utf-8", "replace"):
            vu.add(k)
nom("les nouvelles classes existent dans la feuille publiée (%d/%d)" % (len(vu), len(classes)), len(vu) == len(classes), sorted(set(classes) - vu) or "aucune absente")

print("\n════ 7 · rien n'a cassé à côté ════")
s8, _, corps8 = tete("/api/health")
nom("/api/health répond toujours", s8 == "200", "HTTP %s" % s8)
# Le titre animé de la vitrine est jugé par `tests/vitrine-espaces.py` (huit critères,
# rendu aplatI avec ses séparateurs réels). Ce fichier-ci ne re-invente pas une toise
# plus mauvaise que la sienne : il vérifie seulement que le lot A n'a rien effacé du HTML.
s9, _, vitrine = tete("/")
titre_html = vitrine.decode("utf-8", "replace")
nom("la vitrine est toujours servie avec son h1 animé", "<h1" in titre_html and "Moncef" in titre_html, "%d octets de HTML" % len(titre_html))
nom("et le lot A ne traîne pas sur la page publique (pas de worker enregistré avant `/app`)", "sw-offline.js" not in titre_html, "aucune référence dans le HTML de /")

if non_joue:
    print("\n   NON JOUÉ : " + " · ".join(non_joue))
print("\n   ═══ %d vérifications réussies, %d échec(s) ═══" % (ok, ko))
sys.exit(1 if ko else 0)

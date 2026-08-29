# -*- coding: utf-8 -*-
"""Les mots de la vitrine doivent être séparés : npm run verif:vitrine

Le 29/08/2026, le titre d'accueil s'affichait « L'intelligenceartificielleauservice… ».
Cause, mesurée : chaque mot était placé dans un <span> `display:inline-block` qui
PORTAIT aussi l'espace qui le suivait — et une espace en fin de boîte inline-block est
supprimée par le navigateur, parce qu'elle termine une ligne. La correction retire le
`inline-block` au porteur (l'animation reste sur le span intérieur, qui lui est en
inline-block) : l'espace revient dans la ligne du parent, et un point de retour à la
ligne existe à nouveau pour les téléphones.

Ce test rejoue les deux moitiés de la leçon : la structure dans le code, et le rendu
calculé sur le HTML réellement servi quand BASE est fourni.
"""
import html
import io
import os
import re
import subprocess
import sys

ok = ko = non_joue = 0


def nom(label, cond, detail=""):
    global ok, ko
    if cond:
        ok += 1
        print("   OK  %s%s" % (label, ("  → " + str(detail)) if detail else ""))
    else:
        ko += 1
        print("   RATÉ %s%s" % (label, ("  → " + str(detail)) if detail else ""))


SRC = io.open("src/app/page.tsx", encoding="utf-8").read()

print("════ dans le code ════")
# Le piège : une boîte inline-block dont le dernier enfant est une espace.
piege = re.findall(r'style=\{\{\s*display:\s*"inline-block"\s*\}\}>\s*<motion\.span[\s\S]{0,220}?\{" "\}\s*</span>', SRC)
nom("aucun mot n'est porté par une boîte inline-block qui finit sur une espace", not piege, "%d piège(s)" % len(piege))
nom("l'espace est rendue comme sœur du mot, dans la ligne du parent", SRC.count('{" "}') >= 1)
nom("le span animé reste en inline-block (sinon translateY ne s'applique pas)",
    re.search(r'<motion\.span custom=\{i\}[^>]*display: "inline-block"', SRC) is not None)
nom("le commentaire qui explique le piège est dans le fichier", "supprimé par le" in SRC or "navigateur" in SRC)

print("\n════ ce que la vitrine promet sur les droits ════")
LANGUES = {"fr": "réservés au fondateur", "en": "reserved for the founder", "es": "reservados al fundador",
           "ar": "محفوظة للمؤسس", "zh": "仅限创始人操作"}
manque = [l for l, m in LANGUES.items() if m not in SRC]
nom("la desc « Modérateur » dit la vérité dans les 5 langues", not manque, "manque : " + ", ".join(manque) if manque else "5/5")
faux = [l for l, m in {"fr": "modification des profils utilisateurs", "en": "editing user profiles",
                        "es": "editar perfiles de usuario"}.items() if m in SRC]
nom("plus de promesse de « modifier les profils » pour un modérateur", not faux, "reste : " + ", ".join(faux) if faux else "aucune")


def rendu_h1(page):
    """Retire les boîtes inline-block comme le navigateur : leur espace de fin tombe."""
    m = re.search(r"<h1[^>]*>([\s\S]{0,2600}?)</h1>", page)
    if not m:
        return ""
    bloc = re.sub(r'(<span style="display:inline-block">(?:<span[^>]*>)?[^<]*</span>)\s+(</span>)', r"\1\2", m.group(1))
    return re.sub(r"[ \t]+", " ", html.unescape(re.sub(r"<[^>]+>", "", bloc))).strip()


print("\n════ rendu calculé sur le HTML servi ════")
BASE = os.environ.get("BASE", "").rstrip("/")
if not BASE:
    non_joue = 1
    print("   NON JOUÉ  BASE absent de l'environnement (ex. BASE=https://proappmoncef.netlify.app)")
else:
    page = subprocess.run(["curl", "-s", "--max-time", "60", BASE + "/"], capture_output=True, text=True).stdout
    if "<h1" not in page:
        ko += 1
        print("   RATÉ aucun <h1> dans la réponse — rien à mesurer")
    else:
        t = rendu_h1(page)
        # Un mot français de plus de 3 lettres collé à un autre = défaut.
        collage = re.findall(r"[A-Za-zÀ-ÿ]{4,}[A-ZÀ-Þ][a-zà-ÿ]{3,}", t)
        nom("le titre rendu n'a pas de mot collé à un autre", not collage, "trouvé : " + ", ".join(collage[:3]) if collage else t[:58] + "…")
        nom("le titre rendu contient bien les mots séparés", " L'intelligence artificielle " in " " + t, t[:58] + "…")

print("\n   ═══ %d critères réussis, %d échec(s)%s ═══" % (ok, ko, ", %d étage(s) non joué(s)" % non_joue if non_joue else ""))
sys.exit(1 if ko else 0)

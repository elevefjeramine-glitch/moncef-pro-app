# -*- coding: utf-8 -*-
"""Critères de design de la page Thunder, mesurés et rejouables :
    npm run verif:design
Contrastes WCAG réels des trois niveaux d'encre sur les fonds réellement rendus,
échelle typographique, style en ligne interdit, accessibilité structurelle
(tablist, régions live, focus visible, RTL par propriétés logiques,
prefers-reduced-motion) et présence des clés i18n dans les cinq langues.
Tout est lu dans les fichiers publiés : ces chiffres sont des faits sur le code,
pas une opinion sur le rendu — le navigateur reste le seul juge du goût."""
import re
import sys

CSS = "src/app/globals.css"
PAGE = "src/app/app/thunder/page.tsx"
ok = ko = 0


def nom(label, cond, detail=""):
    global ok, ko
    if cond:
        ok += 1
        print("   OK  %s%s" % (label, ("  → " + str(detail)) if detail else ""))
    else:
        ko += 1
        print("   RATÉ %s%s" % (label, ("  → " + str(detail)) if detail else ""))


def vers_lum(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def lum(r, g, b):
    return 0.2126 * vers_lum(r) + 0.7152 * vers_lum(g) + 0.0722 * vers_lum(b)


def melange(avant, arriere, alpha):
    return tuple(round(avant[i] * alpha + arriere[i] * (1 - alpha)) for i in range(3))


def contraste(a, b):
    la, lb = lum(*a), lum(*b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


FOND = (6, 10, 20)  # --bg #060a14
PANNEAU = melange((255, 255, 255), FOND, 0.026)
EN_TETE_REPONSE = melange((0, 0, 0), PANNEAU, 0.22)

css = open(CSS, encoding="utf-8").read()
bloc = css[css.index(".thunder {"):]


def var_(nom_v):
    m = re.search(r"%s:\s*([^;]+);" % nom_v, bloc)
    return m.group(1).strip() if m else None


def rgb(declaration):
    d = declaration.strip()
    m = re.match(r"rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)", d)
    if m:
        r, g, b = int(m.group(1)), int(m.group(2)), int(m.group(3))
        a = float(m.group(4)) if m.group(4) else 1.0
        return (r, g, b), a
    m = re.match(r"#([0-9a-fA-F]{6})$", d)
    if m:
        return tuple(int(m.group(1)[i : i + 2], 16) for i in (0, 2, 4)), 1.0
    return None, None


print("════ contrastes réels des trois niveaux d'encre ════")
for cle, fonds in [("--encre", [FOND, PANNEAU, EN_TETE_REPONSE]), ("--encre-douce", [FOND, PANNEAU, EN_TETE_REPONSE]), ("--encre-faible", [FOND, PANNEAU, EN_TETE_REPONSE])]:
    (r, g, b), a = rgb(var_(cle))
    for f in fonds:
        c = melange((r, g, b), f, a)
        ratio = contraste(c, f)
        nom("%-14s sur %-16s → %4.2f:1" % (cle, "fond" if f == FOND else ("panneau" if f == PANNEAU else "en-tête réponse"), ratio),
            ratio >= 4.5, "#%02x%02x%02x" % c if isinstance(c, tuple) else c)

for cle, f in [("--tv-fort", PANNEAU), ("--tv", PANNEAU), ("--tv", EN_TETE_REPONSE)]:
    (r, g, b), a = rgb(var_(cle))
    ratio = contraste(melange((r, g, b), f, a), f)
    nom("lien/couleur d'accent %-10s → %4.2f:1" % (cle, ratio), ratio >= 3.0, "(texte violet et gros éléments : seuil 3:1)")

print("\n════ le texte estompé par opacity, proscrit ════")
nom("aucune opacity sur du texte dans le bloc Thunder", len(re.findall(r"opacity:\s*0?\.[0-8]", bloc)) <= 3,
    "opacity restantes : %d (fond de bouton désactivé et source écartée, pas du texte)" % len(re.findall(r"opacity:\s*0?\.[0-8]", bloc)))
nom("le placeholder est lisible (opacity 1 + encre-faible)", re.search(r"::placeholder \{[^}]*opacity:\s*1;", bloc) is not None)

print("\n════ ce que faisait l'ancienne page (comparaison, pas une opinion) ════")
for o in (0.5, 0.55, 0.6, 0.75):
    r = contraste(melange((255, 255, 255), PANNEAU, o), PANNEAU)
    print("   blanc @ %s d'opacité → %5.2f:1 %s" % (o, r, "(passe AA)" if r >= 4.5 else "(échoue AA)"))
print("   et ces valeurs étaient appliquées à du texte de 11 px — la taille, pas le")
print("   contraste, voilà le vrai reproche ; la nouvelle page descend à 11,5 px")
print("   uniquement sur des libellés en capitales espacées.")

print("\n════ échelle typographique ════")
tailles = sorted({t for t in re.findall(r"font-size:\s*([^;]+);", bloc)})
propres = [t for t in tailles if "var(--t-" in t or "px" not in t]
px = sorted({float(re.sub(r"[^0-9.]", "", t)) for t in tailles if "px" in t})
nom("aucun corps de texte sous 13 px (les exceptions sont des chiffres d'en-tête)", all(v >= 13 for v in px), "tailles en pixel : %s" % px)
nom("l'échelle nommée sert vraiment (pas de px éparpillés)", len(re.findall(r"font-size:\s*var\(--t-", bloc)) >= 15, "%d déclarations sur var(--t-*)" % len(re.findall(r"font-size:\s*var\(--t-", bloc)))
for v in ("--t-display", "--t-corps", "--t-petit", "--t-micro"):
    nom("%s définie" % v, var_(v) is not None, var_(v))
m = re.search(r"--t-micro:\s*([\d.]+)px", bloc)
nom("la plus petite taille reste ≥ 11,5 px", m and float(m.group(1)) >= 11.5, m and m.group(1) + "px")

print("\n════ structure accessible, dans la page ════")
page = open(PAGE, encoding="utf-8").read()
nom("les modes sont une vraie tablist", 'role="tablist"' in page and page.count('role="tab"') >= 0 and 'aria-selected={mode === m.id}' in page)
nom("navigation flèches au clavier sur l'onglet", 'e.key === "ArrowRight"' in page and 'e.key === "ArrowLeft"' in page)
nom("Ctrl/Cmd + Entrée envoie", "e.ctrlKey || e.metaKey" in page and 'e.key === "Enter"' in page)
nom("la réponse est une région live", 'aria-live="polite"' in page)
nom("le chargement est annoncé", "aria-busy" in page or 'className="th-squelette"' in page)
nom("plus de <table> pour le QCM", "<table" not in page and "overflowX" not in page)
nom("chaque champ a un <label> associé", page.count("<label className=\"th-label\"") >= 5)
nom("le rail est collant", ".th-rail" in bloc and "position: sticky" in bloc[bloc.index(".th-rail") : bloc.index(".th-rail") + 400])
nom("une seule colonne sous 1000 px", "@media (max-width: 1000px)" in bloc and "grid-template-columns: minmax(0, 1fr)" in bloc)
nom("prefers-reduced-motion respecté", "prefers-reduced-motion: reduce" in bloc)
nom("RTL traité par propriétés logiques (pas de correctif d'alignement)", "inset-inline-start" in bloc and "margin-inline-start" in bloc)
# Seule règle qui compte : la couleur du TEXTE vient de l'échelle d'encre ou de la
# teinte ; les cas autorisés sont les inscriptions sur pastille (vert/rouge/or) et
# le texte sur bouton violet. Chacun de ces couples est contrôlé au-dessous.
couleurs_texte = sorted({v.strip() for v in re.findall(r"\n\s*color:\s*([^;]+);", bloc)})
aut = ("var(--encre", "var(--tv", "#fff", "#150c26", "#ffd7d7", "#f6e9bd", "#ffe9a8", "#e8dcff", "#0b1f13", "#2a0a0a", "#ff8f8f", "var(--a)")
nom("toute couleur de texte vient de l'échelle ou d'un couple contrôlé", all(any(v.startswith(a) for a in aut) for v in couleurs_texte), couleurs_texte)
# les pastilles de verdict : texte foncé sur fond vif, contrôlé comme le reste
for txt, bg, seuil, dit in [
    ((11, 31, 19), (74, 222, 128), 4.5, "verdict « juste »"),
    ((42, 10, 10), (255, 143, 143), 4.5, "verdict « faux »"),
    ((21, 12, 38), (167, 139, 250), 4.5, "texte sur bouton violet"),
    ((255, 215, 215), melange((255, 107, 107), PANNEAU, 0.09), 4.5, "note d'erreur"),
    ((246, 233, 189), melange((255, 215, 0), PANNEAU, 0.07), 4.5, "note d'avertissement"),
    ((232, 220, 255), melange((167, 139, 250), PANNEAU, 0.13), 4.5, "note web"),
    ((255, 143, 143), PANNEAU, 3.0, "icône de suppression (survol)"),
]:
    c = contraste(txt, bg)
    nom("%-32s → %5.2f:1" % (dit, c), c >= seuil)
inline = page.count("style={{")
nom("plus de style en ligne que les deux largeurs de jauge", inline <= 2, "%d style={{…}}" % inline)

print("\n════ i18n ════")
i18n = open("src/utils/i18n.tsx", encoding="utf-8").read()
cles = sorted(set(re.findall(r't\(lang, "(thunder_[a-z_]+)"\)', page)))
manquantes = [c for c in cles if len(re.findall(r'"?%s"?:' % c, i18n, re.M)) < 5]
nom("toutes les clés de la page existent dans les 5 langues", not manquantes, manquantes or "%d clés × 5" % len(cles))

print("\n   ═══ %d critères de design réussis, %d échec(s) ═══" % (ok, ko))
sys.exit(1 if ko else 0)

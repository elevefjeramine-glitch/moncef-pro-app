# -*- coding: utf-8 -*-
"""Aperçu statique de la page Thunder refaite : le VRAI CSS (extrait de
globals.css, rien d'inventé) + la structure réelle du composant, avec du contenu
de démonstration. Ce n'est pas une capture du site : les nombres viennent d'une
séance de test, la mise en page et les couleurs sont celles qui sont publiées."""
import io
import os
import re

# Les chemins sont relatifs à la racine du dépôt ; sortie hors du dépôt par défaut.
SRC = os.environ.get("CSS_SRC", "src/app/globals.css")
SORTIE = os.environ.get("SORTIE", "../apercu-thunder.html")

css_source = io.open(SRC, encoding='utf-8').read()


def bloc_depart(chaine, debut):
    """Une règle et ses imbriquées, en comptant les accolades."""
    i = chaine.index(debut)
    n = 0
    for j in range(i, len(chaine)):
        if chaine[j] == '{':
            n += 1
        elif chaine[j] == '}':
            n -= 1
            if n == 0:
                return chaine[i : j + 1]
    raise AssertionError('bloc non fermé : ' + debut)


morceaux = ["""
  :root {
    --bg: #060a14;
    --p: #5982FF;
    --a: #00D2B6;
    --gold: #FFD700;
    --muted-foreground: #b6bdcd;
    --border: rgba(255, 255, 255, 0.09);
    --font2: ui-sans-serif, system-ui, sans-serif;
  }
"""]
# tout le système Thunder, du premier bloc .thunder { jusqu'à la section suivante
i = css_source.index('.thunder {')
suite = css_source[i:]
fin = len(suite)
for m in re.finditer(r'\n/\* ═+\n\s+\d+[a-z]*\.', suite):
    fin = m.start()
    break
morceaux.append(suite[:fin])
# 3) les règles markdown que la réponse réutilise
for regle in re.findall(r'\n(\.ai-markdown[^{]*\{[^}]*\})', css_source):
    morceaux.append(regle)
for regle in re.findall(r'\n(\.thunder \.th-corps-reponse[^{]*\{[^}]*\})', css_source):
    morceaux.append(regle)

THUNDER = "\n".join(morceaux)
assert 'th-rail' in THUNDER and 'prefers-reduced-motion' in THUNDER, "le système Thunder n'est pas extrait"

ICONE = {
    "zap": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14 12 3l2 7h6l-8 11-2-7z"/></svg>',
    "book": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h6v18H6a2 2 0 0 1-2-2z"/><path d="M20 5a2 2 0 0 0-2-2h-6v18h6a2 2 0 0 0 2-2z"/></svg>',
    "plus": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    "send": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="m4 12 16-8-6 16-2-6z"/></svg>',
    "list": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg>',
    "link": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 15 15 9"/><path d="M11 6.5 13 4.5a4 4 0 1 1 6 6l-2 2"/><path d="M13 17.5 11 19.5a4 4 0 1 1-6-6l2-2"/></svg>',
    "globe": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.4 3 14.6 0 18M12 3c-3 3.4-3 14.6 0 18"/></svg>',
    "bot": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 14h.01M15 14h.01"/></svg>',
    "copy": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 5H6a2 2 0 0 0-2 2v9"/></svg>',
    "check": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="m4 13 5 5L20 6"/></svg>',
    "trash": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    "shield": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3l8 3v6c0 4.6-3.2 7.9-8 9-4.8-1.1-8-4.4-8-9V6z"/><path d="M12 9v4M12 16h.01"/></svg>',
    "arrow": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 12h15m-5-5 5 5-5 5"/></svg>',
}


def icone(nom, taille=16):
    return '<span style="width:%dpx;height:%dpx;display:inline-flex;flex:none">%s</span>' % (taille, taille, ICONE[nom])


SOURCE = """
        <li class="th-source" data-retenu="{retenu}">
          <input type="checkbox" {coche} />
          <span class="th-source-nom">{titre}</span>
          <span class="th-source-matiere">{matiere}</span>
          <span class="th-source-long">{longueur}</span>
          <button type="button" class="th-vider">{poubelle}</button>
        </li>"""

sources = "".join(
    SOURCE.format(retenu="oui", coche="checked", titre=t, matiere=m, longueur=l, poubelle=icone("trash", 14))
    for t, m, l in [
        ("Chapitre 4 — Photosynthèse", "SVT", "12 480"),
        ("Fiche d'énergie cinétique", "Physique", "3 106"),
        ("Glossaire cellulaire", "SVT", "1 902"),
    ]
)

reponse = """
      <article class="th-reponse">
        <div class="th-reponse-tete">
          <span class="th-pastille th-pastille--violet">Question</span>
          <span class="th-pastille">4 · passages cités</span>
          <span class="th-pastille">4 · pages lues</span>
          <button type="button" class="th-bouton th-bouton--fantome th-bouton--mini th-pousser">{copie} Copier la réponse</button>
        </div>
        <div class="th-corps-reponse"><div class="ai-markdown">
          <p>La photosynthèse capte l'énergie lumineuse dans les chloroplastes et la convertit en énergie chimique <strong>[S1]</strong>. L'eau et le dioxyde de carbone donnent du glucose, et le dioxygène est rejeté <strong>[S1]</strong>.</p>
          <p>Ton cours ajoute que la chlorophylle <em>a</em> absorbe surtout le rouge et le bleu, et réfléchit le vert — c'est ce qui explique la couleur des feuilles <strong>[S3]</strong>.</p>
          <ul><li>Phase claire : l'énergie produit l'ATP <strong>[S1]</strong></li><li>Phase sombre : le CO₂ est fixé <strong>[S1][S4]</strong></li></ul>
        </div></div>
        <details class="th-citations" open>
          <summary>4 · passages cités</summary>
          <ol class="th-liste-nue">
            <li class="th-cite">
              <span class="th-cite-n">S1</span>
              <span><a href="#">Photosynthèse</a><span class="th-pastille th-pastille--violet">web</span>
                <blockquote>La photosynthèse est le processus bioénergétique qui permet à des organismes de biosynthétiser de la matière organique en utilisant l'énergie lumineuse…</blockquote></span>
            </li>
            <li class="th-cite th-cite--cours">
              <span class="th-cite-n">S3</span>
              <span><span class="th-cite-titre">Chapitre 4 — Photosynthèse</span>
                <blockquote>La chlorophylle a absorbe les longueurs d'onde autour de 430 nm et 662 nm ; le vert est réfléchi.</blockquote></span>
            </li>
            <li class="th-cite">
              <span class="th-cite-n">S4</span>
              <span><a href="#">Métabolisme acide crassulacéen</a><span class="th-pastille th-pastille--violet">web</span><span class="th-pastille">extrait seul, page non ouverte</span>
                <blockquote>Certaines plantes fixent le CO₂ la nuit pour limiter la perte d'eau.</blockquote></span>
            </li>
          </ol>
        </details>
        <div class="th-pied-quiz th-pied-quiz--reponse">
          <button type="button" class="th-bouton th-bouton--fantome th-bouton--mini">Renvoyer la même question</button>
        </div>
      </article>""".format(copie=icone("copy", 13))

quiz = """
      <section class="th-panneau">
        <h2 class="th-etiquette"><i aria-hidden="true"></i>{liste} QCM<b>3/5</b></h2>
        <div class="th-jauge">
          <span class="th-jauge-barre"><i style="width:60%"></i></span>
          <b>60 % · questions répondues</b>
        </div>
        <ol class="th-quiz">
          <li class="th-question" data-etat="juste">
            <div class="th-question-tete"><span class="th-question-n">1</span><p class="th-question-e">Où se déroule la phase claire de la photosynthèse ?</p><span class="th-verdict" data-sens="juste">juste</span></div>
            <label class="th-choix" data-bonne="oui"><input type="radio" name="q0" checked /><span>Dans les thylakoïdes, à la lumière</span></label>
            <label class="th-choix"><input type="radio" name="q0" /><span>Dans le stroma, la nuit</span></label>
            <div class="th-explication"><strong>[S1]</strong> La phase claire utilise l'eau et la lumière ; l'ATP est produit dans la membrane des thylakoïdes.</div>
          </li>
          <li class="th-question" data-etat="faux">
            <div class="th-question-tete"><span class="th-question-n">2</span><p class="th-question-e">Que rejette la plante pendant la photosynthèse ?</p><span class="th-verdict" data-sens="faux">faux</span></div>
            <label class="th-choix" data-rejetee="oui"><input type="radio" name="q1" checked /><span>Du dioxyde de carbone</span></label>
            <label class="th-choix" data-bonne="oui"><input type="radio" name="q1" /><span>Du dioxygène</span></label>
            <div class="th-explication"><strong>[S3]</strong> Le CO₂ est consommé, pas rejeté ; c'est O₂ qui sort des stomates.</div>
          </li>
          <li class="th-question">
            <div class="th-question-tete"><span class="th-question-n">3</span><p class="th-question-e">À quelle longueur d'onde la chlorophylle a absorbe-t-elle le plus ?</p></div>
            <label class="th-choix"><input type="radio" name="q2" /><span>Environ 430 nm et 662 nm</span></label>
            <label class="th-choix"><input type="radio" name="q2" /><span>Environ 520 nm</span></label>
          </li>
        </ol>
        <div class="th-pied-quiz">
          <span class="th-score">Score <b>1/2</b></span>
          <span class="th-aide">2 questions sans réponse</span>
          <button type="button" class="th-bouton th-bouton--fantome th-bouton--mini th-pousser">Corriger</button>
        </div>
      </section>""".format(liste=icone("list", 13))

histo = """
      <section class="th-panneau">
        <h2 class="th-etiquette"><i aria-hidden="true"></i>Progression<b>4 · 68 %</b></h2>
        <ul class="th-histo-liste">
          <li><span>29 août, 14:02</span><span>lycée</span><b>4/5</b><span class="th-mini-jauge"><i style="width:80%"></i></span></li>
          <li><span>28 août, 19:41</span><span>lycée</span><b>3/5</b><span class="th-mini-jauge"><i style="width:60%"></i></span></li>
          <li><span>26 août, 08:12</span><span>terminale</span><b>5/6</b><span class="th-mini-jauge"><i style="width:83%"></i></span></li>
        </ul>
      </section>"""

notes = """
      <div class="th-notes">
        <div class="th-note" data-niveau="web"><ul style="list-style:none;padding-inline-start:0;margin-top:0"><li>4 pages lues · 4 pages demandées</li></ul></div>
        <div class="th-note" data-niveau="alerte">
          <p class="th-note-tete">{bouclier} Avertissements</p>
          <ul><li>Cette réponse s'appuie sur 4 page(s) du web (Photosynthèse, Chlorophylle, Métabolisme acide crassulacéen, Photosynthèse artificielle) — pas uniquement sur tes documents.</li><li>web : ta page « 127.0.0.1 » n'a pas pu être lue (port explicite refusé)</li></ul>
        </div>
      </section>""".replace("</section>", "</div>").format(bouclier=icone("shield", 14))

liens = """
      <section class="th-panneau">
        <h2 class="th-etiquette"><i aria-hidden="true"></i>{chaine} Liens de recherche</h2>
        <ul class="th-liens">
          <li class="th-lien"><b>Adapter la photosynthèse aux serres urbaines</b>
            <a class="th-bouton th-bouton--fantome th-bouton--mini" href="#">YouTube</a>
            <a class="th-bouton th-bouton--fantome th-bouton--mini" href="#">Web</a></li>
          <li class="th-lien"><b>Pourquoi les feuilles rougissent en automne</b>
            <a class="th-bouton th-bouton--fantome th-bouton--mini" href="#">YouTube</a>
            <a class="th-bouton th-bouton--fantome th-bouton--mini" href="#">Web</a></li>
        </ul>
      </section>""".format(chaine=icone("link", 13))

html = """<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Aperçu — page Thunder refaite</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; }
  body {
    background: var(--bg, #060a14);
    color: #fff;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    padding: 26px clamp(14px, 4vw, 54px) 70px;
  }
  .note-bas { max-width: 1180px; margin: 26px auto 0; font-size: 12.5px; color: rgba(233,236,245,.66); line-height: 1.6; }
  svg { width: 100%; height: 100%; }
  a { color: inherit; text-decoration: none; }
  /* ═══ CSS copié de repo/src/app/globals.css (système .thunder), sans retouche ═══ */
__CSS__

  /* Puis, seulement ici, deux retouches pour l'aperçu : la page réelle est dans un
     conteneur qui défile, l'aperçu non. Elles sont posées APRÈS le CSS copié pour
     le gagner en cascade, et elles ne changent que la caisse, pas le design. */
  .thunder { height: auto; overflow: visible; padding: 0; max-width: 1180px; margin: 0 auto; }
</style>
</head>
<body>
<div class="thunder">
  <header class="th-head">
    <div class="th-tete">
      <span class="th-glyphe">__ZAP__</span>
      <div>
        <h1 class="th-nom">Thunder — l'assistant qui ne lit que tes cours</h1>
        <p class="th-sous-titre">Il répond d'après tes documents — et d'après les pages du web que TU demandes. Chaque phrase porte sa référence.</p>
      </div>
    </div>
    <div class="th-compteurs">
      <div class="th-compteur"><b>690</b><span>crédits restants</span></div>
      <div class="th-compteur"><b>3</b><span>Sources</span></div>
      <div class="th-compteur"><b>17 488</b><span>caractères indexés</span></div>
      <div class="th-compteur"><b>15</b><span>dépensés dans cette session</span></div>
    </div>
  </header>

  <div class="th-grille">
    <aside class="th-rail" aria-label="Sources utilisées">
      <section class="th-panneau">
        <h2 class="th-etiquette"><i aria-hidden="true"></i>__BOOK__ Sources<b>3/3</b></h2>
        <ul class="th-sources">__SOURCES__</ul>
        <div class="th-fila">
          <button type="button" class="th-bouton th-bouton--fantome th-bouton--mini">Toutes</button>
          <button type="button" class="th-bouton th-bouton--fantome th-bouton--mini">Aucune</button>
        </div>
      </section>
      <details class="th-panneau">
        <summary class="th-etiquette"><i aria-hidden="true"></i>__PLUS__ Ajouter une source</summary>
        <div class="th-file">
          <div><label class="th-label">Titre de la fiche</label><input class="th-champ" value="Chapitre 5 — Respiration cellulaire" /></div>
          <div><label class="th-label">Matière</label><input class="th-champ" value="SVT" /></div>
          <div><label class="th-label">Texte</label><textarea class="th-champ th-champ--zone">La mitochondrie oxyde le glucose…</textarea><p class="th-aide">4 210 / 400 000 · caractères indexés</p></div>
          <button type="button" class="th-bouton">Ajouter</button>
        </div>
      </details>
    </aside>

    <div class="th-colonne">
      <section class="th-panneau th-panneau--travail">
        <div class="th-modes" role="tablist">
          <button type="button" class="th-mode" role="tab" aria-selected="true">__SEND__ Question</button>
          <button type="button" class="th-mode" role="tab" aria-selected="false">__LIST__ QCM</button>
          <button type="button" class="th-mode" role="tab" aria-selected="false">__LINK__ Liens</button>
        </div>
        <div class="th-bloc">
          <label class="th-switch"><input type="checkbox" checked />__GLOBE__ Chercher sur le web</label>
          <div class="th-bloc"><label class="th-label">Une URL par ligne, si tu veux imposer la page (facultatif)</label><textarea class="th-champ th-champ--urls">https://fr.wikipedia.org/wiki/Photosynth%C3%A8se</textarea></div>
        </div>
        <div class="th-bloc">
          <label class="th-label">Ta question</label>
          <textarea class="th-champ th-champ--question">Comment la lumière devient-elle de l'énergie dans la feuille ?</textarea>
        </div>
        <div class="th-envoi">
          <button type="button" class="th-bouton">__BOT__ Demander</button>
          <span class="th-pastille th-pastille--or">−15 cr.</span>
          <span class="th-kbd">Ctrl + Entrée pour envoyer</span>
        </div>
        <p class="th-attente">__BOT__ Thunder cherche, lit, rédige… <b>11 s</b> · souvent 10 à 20 s quand le web est branché</p>
      </section>

__NOTES__
__REPONSE__
__QUIZ__
__LIENS__
__HISTO__
    </div>
  </div>
</div>

<p class="note-bas">Aperçu statique construit avec le CSS réellement publié (<code>repo/src/app/globals.css</code>, bloc <code>.thunder</code>) et la structure du composant <code>src/app/app/thunder/page.tsx</code>. Contenu de démonstration : les nombres (17 488 caractères, 60 %, −15 cr.) viennent d'une séance de test, pas de ta base. Ouvre la page à différentes largeurs : sous 1000 px le rail passe au-dessus et le QCM reste en cartes.</p>
</body>
</html>
"""

remplacements = {
    "__CSS__": THUNDER,
    "__SOURCES__": sources,
    "__REPONSE__": reponse,
    "__QUIZ__": quiz,
    "__LIENS__": liens,
    "__HISTO__": histo,
    "__NOTES__": notes,
    "__ZAP__": icone("zap", 22),
    "__BOOK__": icone("book", 13),
    "__PLUS__": icone("plus", 13),
    "__SEND__": icone("send", 14),
    "__LIST__": icone("list", 14),
    "__LINK__": icone("link", 14),
    "__GLOBE__": icone("globe", 14),
    "__BOT__": icone("bot", 15),
}
for k, v in remplacements.items():
    html = html.replace(k, v)
assert "__" not in re.sub(r"[\w./-]*__", "", html).replace("430 nm", ""), "des marqueurs restent"
io.open(SORTIE, "w", encoding="utf-8").write(html)
print("   ✅ aperçu écrit : %d Ko · %d règles Thunder dans la copie" % (len(html) // 1024, THUNDER.count("\n")))

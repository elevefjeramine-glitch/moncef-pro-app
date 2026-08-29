#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Promouvoir un déploiement Netlify, puis REJOUER les toises sur le domaine nu.
#
# Ce script existe parce qu'une promotion « à la main » dans l'interface ne laisse
# aucune trace mesurée : on pousse, on croit que c'est bon, et trois jours plus tard
# personne ne sait si la route /api/agenda est en ligne ou non. Ici, la promotion
# n'est considérée faite que si les toises passent SUR LE DOMAINE PUBLIC.
#
# Usage — promotion réelle (il faut un jeton Netlify, mode OAuth ou PAT) :
#   JETON=sfp_xxx bash tests/promotion.sh
#   JETON=sfp_xxx DEPLOY=6a934a48b8459d146876faaf bash tests/promotion.sh
#
# Usage — sans rien promouvoir, pour vérifier le script et l'état d'un serveur local :
#   SANS_RESTORE=1 BASE=http://127.0.0.1:3114 bash tests/promotion.sh
#
# Variables :
#   JETON        jeton Netlify (jamais écrit sur disque, jamais dans un commit)
#   SITE         référence du site : id, nom, ou domaine (défaut : le domaine en ligne)
#   DEPLOY       id du déploiement à promouvoir ; par défaut le dernier « ready » non publié
#   BASE         base à toiser après la promotion (défaut : https://<SITE>)
#   SANS_RESTORE =1 pour sauter la promotion (le mode mesurable hors atelier)
#   SK, PAT      clés Supabase (service + PAT d'admin) — sans elles, les points qui
#                lisent la base répondent INDISPONIBLE et comptent comme échecs
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ATELIER=$(cd "$(dirname "$0")/.." && pwd)
SITE=${SITE:-proappmoncef.netlify.app}
BASE=${BASE:-https://${SITE}}
API=https://api.netlify.com/api/v1
CURL=(curl -sS -m 30)

if [ "${SANS_RESTORE:-0}" != "1" ] && [ -z "${JETON:-}" ]; then
  echo "Il manque JETON (jeton Netlify). Refus de faire semblant de promouvoir." >&2
  echo "Pour rejouer seulement les toises : SANS_RESTORE=1 BASE=http://127.0.0.1:3114 bash tests/promotion.sh" >&2
  exit 2
fi

promu=0
if [ "${SANS_RESTORE:-0}" = "1" ]; then
  echo "· SANS_RESTORE=1 : aucune promotion, les toises sont jouées contre ${BASE}"
else
  AUTH=(-H "Authorization: Bearer ${JETON}")
  if [ -z "${DEPLOY:-}" ]; then
    echo "· recherche du dernier déploiement prêt non publié sur ${SITE}"
    DEPLOY=$("${CURL[@]}" "${AUTH[@]}" "${API}/sites/${SITE}/deploys?per_page=5" \
      | python3 -c 'import json,sys; d=json.load(sys.stdin); c=[x for x in d if x.get("state")=="ready" and not x.get("is_locked") and x.get("id")!=next((y["id"] for y in d if y.get("published")),None)]; print(c[0]["id"] if c else "")')
    if [ -z "${DEPLOY}" ]; then
      echo "Aucun brouillon prêt non publié. Lancer un build (git push si les builds sur push sont actifs," >&2
      echo "sinon lancer un build (CLI netlify) côté détenant du compte, puis relancer ce script." >&2
      exit 3
    fi
  fi
  echo "· promotion de ${DEPLOY}"
  "${CURL[@]}" -X POST "${AUTH[@]}" -H 'content-type: application/json' --data '{}' \
    "${API}/deploys/${DEPLOY}/restore" >/dev/null
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    pub=$("${CURL[@]}" "${AUTH[@]}" "${API}/deploys/${DEPLOY}" | python3 -c 'import json,sys; print("oui" if json.load(sys.stdin).get("published") else "non")')
    [ "$pub" = "oui" ] && break
    sleep 3
  done
  en_ligne=$("${CURL[@]}" "${AUTH[@]}" "${API}/sites/${SITE}" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("published_deploy",{}).get("id","?"))')
  echo "· déploiement publié selon l'API : ${en_ligne} (attendu ${DEPLOY})"
  [ "${en_ligne}" = "${DEPLOY}" ] || { echo "L'API ne confirme pas la promotion — on ne toise pas plus loin." >&2; exit 4; }
  promu=1
fi

echo
echo "── toises jouées contre ${BASE} ────────────────────────────────────────────"
cd "${ATELIER}"
echecs=0
for toise in tests/agenda-verif.py tests/plan-fiches-verif.py; do
  if BASE="${BASE}" SK="${SK:-}" PAT="${PAT:-}" python3 "${toise}"; then
    echo "  ✓ ${toise}"
  else
    echo "  ✗ ${toise} (voir sa sortie ci-dessus)"
    echecs=$((echecs + 1))
  fi
done

echo
if [ "${echecs}" -eq 0 ]; then
  [ "${promu}" = "1" ] && echo "PROMOTION FAITE ET MESURÉE : les toises passent sur le domaine public." \
    || echo "Toises vertes contre ${BASE} — mais rien n'a été promu (SANS_RESTORE)."
else
  echo "${echecs} toise(s) en échec : la promo n'est PAS à considérer comme bonne." >&2
  exit 1
fi

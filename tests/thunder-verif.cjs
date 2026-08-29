/**
 * Vérifications du moteur de Thunder — à lancer par `npm run verif:thunder` (fichier en CommonJS : il consomme le module transpilé par `require`).
 *
 * Le script transpile src/lib/thunder.ts TEL QUEL dans .verif/ puis l'exécute :
 * ce sont les fonctions de production qui tournent ici, pas une copie réécrite
 * pour l'occasion. 27 contrôles, dont les six refus que le moteur DOIT opposer
 * (QCM à 3 choix, index hors tableau, source inventée, choix dupliqués, lien mort,
 * requête hors sujet). Le répertoire .verif/ n'est pas versionné.
 */
const T = require('../.verif/thunder.js');
let ok=0, ko=0;
function nom(n, cond, detail){ (cond?ok++:ko++); console.log(`   ${cond?'OK':'KO'}  ${n}${detail?'  → '+String(detail).slice(0,72):''}`); }

// ── 1. découpage : sur fin de phrase, jamais en pleine équation
const cours = "L'énergie cinétique est l'énergie de mouvement. Elle vaut Ec = 1/2·m·v². "+
  "Elle se mesure en joules. Un corps au repos a une énergie cinétique nulle. "+
  "L'énergie potentielle de pesanteur dépend de l'altitude. Elle vaut Ep = m·g·h. "+
  "Les deux s'additionnent dans l'énergie mécanique, qui se conserve sans frottement.";
const passages = T.decouper(cours, 120, 60);
nom('decouper: plusieurs passages', passages.length>1, passages.length+" blocs");
nom('decouper: aucun bloc coupé à "v"', !passages.some(p=>/v$/.test(p.trim())), passages.map(p=>p.slice(-14)));

// ── 2. recherche lexicale : la bonne source remonte
const sources=[{id:'physique-chap2',titre:'Énergie — chapitre 2',matiere:'Physique',texte:cours},
               {id:'histoire',titre:'Révolution française',matiere:'Histoire',texte:"La prise de la Bastille a lieu le 14 juillet 1789. L'Assemblée constituante rédige la Déclaration des droits. Le suffrage censaire divise citoyens actifs et passifs."}];
const r = T.rechercher(sources, "comment calcule-t-on l'énergie cinétique ?", 3);
nom('rechercher: renvoie des passages', r.length>0, r.length);
nom('rechercher: premier passage = le bon document', r[0]?.sourceId==='physique-chap2', r.map(p=>p.sourceId+':'+p.score));
nom('rechercher: numérotation [S1..] continue', r.every((p,i)=>p.n===i+1), r.map(p=>p.n));
// Le seuil de 2 lettres est là pour les unités : « kg » doit rester un terme.
// Sans lui, « combien font 2 kg à 3 m/s ? » ne trouvait rien dans un cours qui
// contient pourtant la réponse — mesuré en production le 29/08/2026.
{
  const unit = T.rechercher([{ id: "u", titre: "Énergie", texte: "Une boule de 2 kg lancée à 3 m/s possède Ec = 9 joules. Le kilogramme est l'unité de masse." }], "combien font 2 kg ?", 3);
  nom('rechercher: conserve les unités de 2 lettres (kg)', unit.length > 0, unit[0] ? 'score ' + unit[0].score : 'rien');
  nom('rechercher: les 2 lettres devenues outils ne comptent pas', T.termes("de la le et un kg").includes("kg") && !T.termes("de la le et un").length, T.termes("de la le et un kg"));
}
nom('rechercher: requête sans rapport = 0 passage', T.rechercher(sources,"la photosynthèse chez les gymnospermes",3).length===0);
nom('blocContexte: étiquettes présentes', T.blocContexte(r).startsWith('[S1] ('));

// ── 3. citations : on ne laisse pas une référence inventée passer
const rep = "Ec = 1/2·m·v² [S1]. Le savant Lavoisier l'a démontré en 1789 [S9]. Troisième phrase sans référence.";
const c = T.controlerCitations(rep, r);
nom('controlerCitations: [S9] retiré', !c.texte.includes('[S9]') && c.rejets.length===1, c.rejets);
nom('controlerCitations: [S1] conservé', c.texte.includes('[S1]'));
nom('citationsUtilisees: 1 seule source citée', T.citationsUtilisees(c.texte, r).length===1);

// ── 4. QCM : accepté si complet, refusé sinon (et le refus est motivé)
const nums=new Set(r.map(p=>p.n));
const bon=[{question:"Quelle est la formule de l'énergie cinétique ?",choices:["m·g·h","1/2·m·v²","m·v","1/2·m·a²"],answer:1,explication:"Cours, chapitre 2.",source:"S1"}];
nom('validerQuiz: QCM correct accepté', T.validerQuiz(bon,nums).ok===true);
const tests=[["4 choix manquants",{question:"q",choices:["a","b","c"],answer:0,source:"S1"}],
             ["index hors tableau",{question:"Quelle formule ?",choices:["a","b","c","d"],answer:4,source:"S1"}],
             ["source inventée S7",{question:"Quelle formule ?",choices:["a","b","c","d"],answer:0,source:"S7"}],
             ["choix dupliqués",{question:"Quelle formule ?",choices:["a","a","c","d"],answer:0,source:"S1"}],
             ["énoncé vide",{question:"?",choices:["a","b","c","d"],answer:0,source:"S1"}]];
for(const [nom_,q] of tests){ const v=T.validerQuiz([q],nums); nom(`validerQuiz: refuse « ${nom_} »`, v.ok===false, v.ok?null:v.motif); }
nom('extraireJson: tolère la clôture ```json', Array.isArray(T.extraireJson("voici:\n```json\n"+JSON.stringify(bon)+"\n```\n")));
nom('extraireJson: texte sans JSON → null', T.extraireJson("je ne sais pas")===null);

// ── 5. correction locale
const qs=T.validerQuiz(bon,nums).questions;
const cor=T.corriger(qs,[1,0]);
nom('corriger: 1 juste sur 1 bonne réponse', cor.justes===1, JSON.stringify(cor.lignes));

// ── 6. liens : URL de recherche déterministe, aucune URL dictée avalée
nom('lienRechercheYouTube encode le sujet', T.lienRechercheYouTube("énergie cinétique 1re")==='https://www.youtube.com/results?search_query=%C3%A9nergie%20cin%C3%A9tique%201re', T.lienRechercheYouTube("énergie cinétique 1re"));
nom('identifiantVideo: youtu.be reconnu', T.identifiantVideo('https://youtu.be/dQw4w9WgXcQ')==='dQw4w9WgXcQ');
nom('identifiantVideo: site random refusé', T.identifiantVideo('https://evil.example/watch?v=abc')===null);
(async()=>{
  let appels=0;
  // Politique réelle de la route : le vérificateur ne reconnaît QUE YouTube.
  // Un lien non reconnu est jeté, un lien en double n'est pas vérifié deux fois,
  // et un http:// n'atteint même pas le vérificateur (le filtre est en amont).
  const reconnaitYouTube = async (u) => { appels++; return T.identifiantVideo(u) ? { ok:true, titre:'Titre officiel' } : null; };
  const liens = await T.filtrerLiensDirects([
    {url:'https://www.youtube.com/watch?v=abc123'},
    {url:'https://exemple.fr/nimporte'},
    {url:'https://www.youtube.com/watch?v=abc123'},
    {url:'http://www.youtube.com/watch?v=enclair'},
  ], reconnaitYouTube);
  nom('filtrerLiensDirects: ne garde que le lien reconnu, dédupliqué, en https', liens.length===1 && liens[0].url==='https://www.youtube.com/watch?v=abc123', liens.map(l=>l.url));
  nom('filtrerLiensDirects: un doublon ne relance pas de vérification', appels===2, 'appels='+appels);
  nom('filtrerLiensDirects: le titre affiché vient du vérificateur', liens[0]?.titre==='Titre officiel');
  const refuse=await T.filtrerLiensDirects([{url:'https://www.youtube.com/watch?v=zzz999'}], async()=>null);
  nom('filtrerLiensDirects: lien mort → rien publié', refuse.length===0);
  nom('reponseSansSource: mode "ce n\'est pas dans tes documents"', /^Ce n'est pas dans tes documents\./.test(T.reponseSansSource([])||''));
  console.log(`\n   ═══ ${ok} vérifications réussies, ${ko} échec(s) ═══`);
  process.exit(ko?1:0);
})();

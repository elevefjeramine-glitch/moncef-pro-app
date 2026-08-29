"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpen, Bot, Check, Copy, Globe, Link2, ListChecks, Plus, Send, ShieldAlert, Trash2, Zap } from "lucide-react";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { useLanguage, t } from "@/utils/i18n";
import { supabase } from "@/utils/supabase/client";

/**
 * Thunder — l'écran. Toute la logique de vérité (recherche lexicale, citations
 * contrôlées, QCM validé, liens vérifiés) est côté serveur dans src/lib/thunder.ts ;
 * ici on n'affiche que ce que la route a bien voulu renvoyer.
 *
 * Deux choix à lire avant de toucher ce fichier :
 *  - La correction du QCM se fait ICI, en local, en comparant l'index choisi à
 *    `answer`. Le modèle ne revoit jamais une copie : une note ne passe pas par un
 *    générateur de texte.
 *  - Aucun lien n'est rendu s'il n'est pas soit une URL de recherche construite par
 *    nous, soit un lien `verifies` renvoyé par la route après résolution oEmbed.
 *
 * Le design, lui, est entièrement dans les classes `.th-*` de globals.css (une
 * échelle typographique, un violet, trois niveaux d'encre mesurés) : ce fichier ne
 * contient plus de style en ligne, sauf pour la largeur des jauges, qui dépend de
 * la réponse du serveur.
 */

type Source = { id: string; titre: string; matiere: string | null; longueur: number | string; created_at: string };
type Citation = { n: number; titre: string; extrait: string; url?: string | null; origine?: "cours" | "web"; page_lue?: boolean };
type Question = { question: string; choices: string[]; answer: number; explication: string; source: string; extrait?: string };
type Partie = { id: string; total: number; justes: number; niveau: string | null; lignes: { n: number; justifie: boolean; choisi: number | null }[]; created_at: string };
type Note = { niveau: "erreur" | "alerte" | "web" | "info"; titre?: string; lignes: string[] };

const markdown = (texte: string) =>
  DOMPurify.sanitize(marked.parse(texte, { async: false, breaks: true, gfm: true }) as string, { USE_PROFILES: { html: true } });

/** Un seul formatage des nombres, pour que les compteurs restent alignés. */
const nombre = (n: number, lang: string) => n.toLocaleString(lang === "fr" ? "fr-FR" : lang === "ar" ? "ar-MA" : lang);

export default function ThunderPage() {
  const lang = useLanguage();
  const jeton = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }, []);

  // ── Sources ────────────────────────────────────────────────────────────────
  const [sources, setSources] = useState<Source[]>([]);
  const [form, setForm] = useState({ titre: "", matiere: "", texte: "" });
  const [majSources, setMajSources] = useState(false);
  /** Les fiches que l'élève ÉCARTE : par défaut tout est retenu, rien à synchroniser. */
  const [exclues, setExclues] = useState<string[]>([]);

  const chargerSources = useCallback(async () => {
    const token = await jeton();
    const r = await fetch("/api/thunder", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mode: "sources", action: "list" }),
    });
    const d = await r.json();
    if (r.ok) setSources(Array.isArray(d.sources) ? d.sources : []);
  }, [jeton]);

  useEffect(() => {
    chargerSources().catch(() => {});
  }, [chargerSources]);

  const ajouter = async () => {
    setMajSources(true);
    const token = await jeton();
    await fetch("/api/thunder", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mode: "sources", action: "add", nouveau: form }),
    });
    setForm({ titre: "", matiere: "", texte: "" });
    await chargerSources();
    setMajSources(false);
  };

  const supprimer = async (id: string) => {
    const token = await jeton();
    await fetch("/api/thunder", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mode: "sources", action: "remove", id }),
    });
    setExclues((e) => e.filter((x) => x !== id));
    await chargerSources();
  };

  // ── Trois modes, un seul état de rendu ────────────────────────────────────
  const [mode, setMode] = useState<"ask" | "quiz" | "links">("ask");
  const [question, setQuestion] = useState("");
  const [niveaux, setNiveau] = useState("lycée");
  const [nbQuestions, setNbQuestions] = useState(5);
  const [enCours, setEnCours] = useState(false);
  const [web, setWeb] = useState(false);
  const [webUrls, setWebUrls] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [reponse, setReponse] = useState<string | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [avertissements, setAvertissements] = useState<string[]>([]);
  const [contexte, setContexte] = useState<{ passages?: number; dont_web?: number; blocs?: number } | null>(null);
  const [cout, setCout] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [liens, setLiens] = useState<{ verifiees?: { url: string; titre: string }[]; recherche?: { sujet: string; youtube: string; web: string }[]; avertissement?: string } | null>(null);
  const [reponses, setReponses] = useState<(number | null)[]>([]);
  const [correction, setCorrection] = useState<{ justes: number; lignes: { n: number; justifie: boolean; choisi: number | null }[] } | null>(null);
  const [historique, setHistorique] = useState<Partie[]>([]);
  const [resume, setResume] = useState<{ parties: number; moyenne: number } | null>(null);

  // ── Ce que l'élève veut savoir sans compter lui-même ──────────────────────
  const [credit, setCredit] = useState<number | null>(null);
  const [depense, setDepense] = useState(0);
  const [secondes, setSecondes] = useState(0);
  const [copie, setCopie] = useState<"rien" | "ok" | "refuse">("rien");
  const minuteur = useRef<ReturnType<typeof setInterval> | null>(null);

  const chargerSolde = useCallback(async () => {
    const { data } = await supabase.rpc("get_me");
    const ligne = Array.isArray(data) ? data[0] : data;
    if (ligne && typeof ligne.tokens === "number") setCredit(ligne.tokens);
  }, []);

  useEffect(() => {
    chargerSolde().catch(() => {});
  }, [chargerSolde]);

  // Le chrono n'est pas une promesse de vitesse : c'est le temps réel écoulé, pour
  // que les 10 à 20 s d'une question avec le web ne ressemblent pas à un plantage.
  useEffect(() => {
    if (!enCours) {
      if (minuteur.current) clearInterval(minuteur.current);
      return;
    }
    const t0 = Date.now();
    minuteur.current = setInterval(() => setSecondes(Math.round((Date.now() - t0) / 1000)), 200);
    return () => {
      if (minuteur.current) clearInterval(minuteur.current);
    };
  }, [enCours]);

  const appeler = async (corps: Record<string, unknown>) => {
    setEnCours(true);
    setErreur(null);
    const token = await jeton();
    try {
      const r = await fetch("/api/thunder", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(corps),
      });
      const d = await r.json();
      if (!r.ok) {
        setErreur([d.error, d.motif, d.details].filter(Boolean).join(" — ") || `Erreur ${r.status}`);
        return null;
      }
      const db = typeof d.debite === "number" ? d.debite : 0;
      setCout(db);
      if (db > 0) {
        setDepense((x) => x + db);
        chargerSolde().catch(() => {});
      }
      return d;
    } catch (e) {
      setErreur("Thunder est injoignable : " + (e instanceof Error ? e.message : "réseau"));
      return null;
    } finally {
      setEnCours(false);
    }
  };

  const retenues = useMemo(() => sources.filter((s) => !exclues.includes(s.id)).map((s) => s.id), [sources, exclues]);
  const caracteres = useMemo(() => sources.reduce((a, s) => a + Number(s.longueur || 0), 0), [sources]);
  const urlsDemandees = useMemo(() => webUrls.split(/\n|,/).map((x) => x.trim()).filter(Boolean).slice(0, 4), [webUrls]);
  const toutEstRetenu = retenues.length === sources.length;
  // Rien à lire et pas de web demandé : la route répondrait « ce n'est pas dans tes
  // documents ». Autant le dire avant l'appel que de faire payer une question vide.
  const rienALire = sources.length === 0 && !(mode === "ask" && (web || urlsDemandees.length > 0));

  const demander = async () => {
    setReponse(null);
    setCitations([]);
    setQuestions(null);
    setLiens(null);
    setCorrection(null);
    setContexte(null);
    setCopie("rien");
    const d = await appeler({
      mode,
      question,
      ...(toutEstRetenu ? { include_all_sources: true } : { source_ids: retenues }),
      niveau: niveaux,
      n: nbQuestions,
      // Le web n'est demandé que si l'élève le demande : la promesse de Thunder
      // (« je ne réponds qu'à partir de ce que tu m'as donné ») reste vraie par défaut.
      ...(mode === "ask" && (web || urlsDemandees.length) ? { web: true, web_urls: urlsDemandees } : {}),
    });
    if (!d) return;
    if (mode === "ask") {
      setReponse(String(d.reponse ?? ""));
      setCitations(Array.isArray(d.citations) ? d.citations : []);
      setAvertissements(Array.isArray(d.avertissements) ? d.avertissements : []);
      setContexte(d.contexte ?? null);
    } else if (mode === "quiz") {
      const qs = Array.isArray(d.questions) ? (d.questions as Question[]) : [];
      setQuestions(qs);
      setReponses(qs.map(() => null));
      setAvertissements([]);
    } else {
      setLiens({ recherche: d.liens?.recherche, avertissement: d.avertissement });
      setAvertissements([]);
    }
  };

  const copier = async () => {
    if (!reponse) return;
    try {
      await navigator.clipboard.writeText(reponse);
      setCopie("ok");
      setTimeout(() => setCopie("rien"), 1800);
    } catch {
      setCopie("refuse");
    }
  };

  const choisir = (i: number, c: number) => {
    setReponses((r) => r.map((v, j) => (j === i ? c : v)));
    setCorrection(null);
  };

  // La correction est locale : aucun appel réseau, aucun risque qu'un modèle
  // se trompe de barème. Elle compare l'index choisi à `answer`.
  const corriger = async () => {
    if (!questions) return;
    let justes = 0;
    const lignes = questions.map((q, i) => {
      const bon = reponses[i] !== null && reponses[i] === q.answer;
      if (bon) justes++;
      return { n: i + 1, justifie: bon, choisi: reponses[i] ?? null };
    });
    setCorrection({ justes, lignes });
    const token = await jeton();
    await fetch("/api/thunder", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mode: "progress", action: "save", total: questions.length, justes, niveau: niveaux, lignes }),
    }).catch(() => {});
    chargerHistorique();
  };

  const chargerHistorique = useCallback(async () => {
    const token = await jeton();
    const r = await fetch("/api/thunder", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mode: "progress", action: "list" }),
    });
    const d = await r.json();
    if (r.ok) {
      setHistorique(Array.isArray(d.parties) ? d.parties : []);
      setResume(d.resume ?? null);
    }
  }, [jeton]);

  useEffect(() => {
    chargerHistorique().catch(() => {});
  }, [chargerHistorique]);

  const repondues = reponses.filter((r) => r !== null).length;
  const taux = useMemo(() => (reponses.length ? repondues / reponses.length : 0), [reponses, repondues]);

  const MODES = [
    { id: "ask", label: t(lang, "thunder_ask"), icon: Send },
    { id: "quiz", label: t(lang, "thunder_quiz"), icon: ListChecks },
    { id: "links", label: t(lang, "thunder_links"), icon: Link2 },
  ] as const;

  const onglet = useRef<(HTMLButtonElement | null)[]>([]);
  const naviguer = (d: number) => {
    const i = MODES.findIndex((m) => m.id === mode);
    const j = (i + d + MODES.length) % MODES.length;
    const suivant = MODES[j];
    if (!suivant) return; // index hors bornes : rien à changer, pas d'exception
    setMode(suivant.id);
    onglet.current[j]?.focus();
  };

  // Les notes, réunies en un seul système : une erreur (bloquante), des
  // avertissements du serveur, une information sur ce qui a été lu.
  const notes: Note[] = [];
  if (erreur) notes.push({ niveau: "erreur", lignes: [erreur] });
  if (rienALire) notes.push({ niveau: "info", lignes: [t(lang, "thunder_aucune_source_active")] });
  if (avertissements.length) notes.push({ niveau: "alerte", titre: t(lang, "thunder_avertissements"), lignes: avertissements });
  // Ce qui a été réellement téléchargé, dit avec les nombres renvoyés par la route —
  // pas une barre de progression inventée pendant que le serveur travaille.
  if (mode === "ask" && web && reponse && contexte) {
    const lues = contexte.dont_web ?? 0;
    notes.push({
      niveau: "web",
      lignes: [
        `${nombre(lues, lang)} ${t(lang, "thunder_pages_lues")}` +
          (urlsDemandees.length ? ` · ${nombre(urlsDemandees.length, lang)} ${t(lang, "thunder_pages_demandees")}` : ""),
      ],
    });
  }

  return (
    <div className="thunder">
      <header className="th-head">
        <div className="th-tete">
          <span className="th-glyphe" aria-hidden>
            <Zap size={22} />
          </span>
          <div>
            <h1 className="th-nom">{t(lang, "thunder_title")}</h1>
            <p className="th-sous-titre">{t(lang, "thunder_subtitle")}</p>
          </div>
        </div>
        <div className="th-compteurs">
          <div className="th-compteur">
            <b>{credit === null ? "—" : nombre(credit, lang)}</b>
            <span>{t(lang, "thunder_credits_restants")}</span>
          </div>
          <div className="th-compteur">
            <b>{nombre(sources.length, lang)}</b>
            <span>{t(lang, "thunder_sources")}</span>
          </div>
          <div className="th-compteur">
            <b>{nombre(caracteres, lang)}</b>
            <span>{t(lang, "thunder_caracteres_indexes")}</span>
          </div>
          <div className="th-compteur">
            <b>{nombre(depense, lang)}</b>
            <span>{t(lang, "thunder_session_depense")}</span>
          </div>
        </div>
      </header>

      <div className="th-grille">
        {/* ── Rail : c'est lui qui borne la réponse ── */}
        <aside className="th-rail" aria-label={t(lang, "thunder_sources_utilisees")}>
          <section className="th-panneau">
            <h2 className="th-etiquette">
              <i aria-hidden /> <BookOpen size={13} /> {t(lang, "thunder_sources")}
              <b>
                {retenues.length}/{sources.length}
              </b>
            </h2>

            {sources.length === 0 ? (
              <p className="th-aide">{t(lang, "thunder_s_vide")}</p>
            ) : (
              <>
                <ul className="th-sources">
                  {sources.map((s) => {
                    const retenu = !exclues.includes(s.id);
                    return (
                      <li key={s.id} className="th-source" data-retenu={retenu ? "oui" : "non"}>
                        <input
                          type="checkbox"
                          checked={retenu}
                          onChange={() => setExclues((e) => (retenu ? [...e, s.id] : e.filter((x) => x !== s.id)))}
                          aria-label={`${t(lang, "thunder_sources_utilisees")} — ${s.titre}`}
                        />
                        <span className="th-source-nom" title={s.titre}>
                          {s.titre}
                        </span>
                        {s.matiere ? <span className="th-source-matiere">{s.matiere}</span> : null}
                        <span className="th-source-long">{nombre(Number(s.longueur), lang)}</span>
                        <button type="button" className="th-vider" onClick={() => supprimer(s.id)} title={t(lang, "thunder_s_delete")}>
                          <Trash2 size={14} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="th-fila">
                  <button type="button" className="th-bouton th-bouton--fantome th-bouton--mini" onClick={() => setExclues([])}>
                    {t(lang, "thunder_toutes")}
                  </button>
                  <button type="button" className="th-bouton th-bouton--fantome th-bouton--mini" onClick={() => setExclues(sources.map((s) => s.id))}>
                    {t(lang, "thunder_aucune")}
                  </button>
                </div>
              </>
            )}
          </section>

          <details className="th-panneau">
            <summary className="th-etiquette">
              <i aria-hidden /> <Plus size={13} /> {t(lang, "thunder_s_save")}
            </summary>
            <div className="th-file">
              <div>
                <label className="th-label" htmlFor="th-titre">
                  {t(lang, "thunder_s_title")}
                </label>
                <input id="th-titre" className="th-champ" value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} />
              </div>
              <div>
                <label className="th-label" htmlFor="th-matiere">
                  {t(lang, "thunder_s_matiere")}
                </label>
                <input id="th-matiere" className="th-champ" value={form.matiere} onChange={(e) => setForm({ ...form, matiere: e.target.value })} />
              </div>
              <div>
                <label className="th-label" htmlFor="th-texte">
                  {t(lang, "thunder_s_text")}
                </label>
                <textarea id="th-texte" className="th-champ th-champ--zone" value={form.texte} onChange={(e) => setForm({ ...form, texte: e.target.value })} />
                <p className="th-aide">
                  {nombre(form.texte.trim().length, lang)} / 400 000 · {t(lang, "thunder_caracteres_indexes")}
                </p>
              </div>
              <button type="button" className="th-bouton" onClick={ajouter} disabled={majSources || form.texte.trim().length < 40}>
                <Plus size={14} /> {majSources ? "…" : t(lang, "thunder_s_save")}
              </button>
            </div>
          </details>
        </aside>

        {/* ── Colonne de travail ── */}
        <div className="th-colonne">
          <section className="th-panneau th-panneau--travail">
            <div
              className="th-modes"
              role="tablist"
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  naviguer(1);
                }
                if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  naviguer(-1);
                }
              }}
            >
              {MODES.map((m, i) => (
                <button
                  key={m.id}
                  ref={(el) => {
                    onglet.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={mode === m.id}
                  tabIndex={mode === m.id ? 0 : -1}
                  className="th-mode"
                  onClick={() => setMode(m.id)}
                >
                  <m.icon size={14} /> {m.label}
                </button>
              ))}
            </div>

            {mode === "quiz" && (
              <div className="th-ligne-champs th-bloc">
                <div>
                  <label className="th-label" htmlFor="th-n">
                    {t(lang, "thunder_n")}
                  </label>
                  <input
                    id="th-n"
                    className="th-champ th-champ--court"
                    type="number"
                    min={3}
                    max={10}
                    value={nbQuestions}
                    onChange={(e) => setNbQuestions(Math.min(10, Math.max(3, Number(e.target.value) || 5)))}
                  />
                </div>
                <div>
                  <label className="th-label" htmlFor="th-niveau">
                    {t(lang, "thunder_niveau")}
                  </label>
                  <select id="th-niveau" className="th-champ" value={niveaux} onChange={(e) => setNiveau(e.target.value)}>
                    <option value="collège">collège</option>
                    <option value="lycée">lycée</option>
                    <option value="terminale">terminale</option>
                    <option value="supérieur">supérieur</option>
                  </select>
                </div>
              </div>
            )}

            {mode === "ask" && (
              <div className="th-bloc">
                <label className="th-switch">
                  <input type="checkbox" checked={web} onChange={(e) => setWeb(e.target.checked)} />
                  <Globe size={14} /> {t(lang, "thunder_web")}
                </label>
                {web && (
                  <div className="th-bloc">
                    <label className="th-label" htmlFor="th-urls">
                      {t(lang, "thunder_web_urls")}
                    </label>
                    <textarea id="th-urls" className="th-champ th-champ--urls" value={webUrls} onChange={(e) => setWebUrls(e.target.value)} />
                  </div>
                )}
              </div>
            )}

            <div className="th-bloc">
              <label className="th-label" htmlFor="th-question">
                {t(lang, "thunder_q")}
              </label>
              <textarea
                id="th-question"
                className="th-champ th-champ--question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!enCours && question.trim().length >= 3 && !rienALire) demander();
                  }
                }}
              />
            </div>

            <div className="th-envoi">
              <button type="button" className="th-bouton" onClick={demander} disabled={enCours || question.trim().length < 3 || rienALire}>
                <Bot size={15} /> {enCours ? "…" : t(lang, "thunder_send")}
              </button>
              {cout !== null && <span className="th-pastille th-pastille--or">−{nombre(cout, lang)} cr.</span>}
              <span className="th-kbd">{t(lang, "thunder_hint")}</span>
            </div>

            {enCours && (
              <p className="th-attente" aria-live="polite">
                <Bot size={14} /> {t(lang, "thunder_travail_en_cours")} <b>{secondes} s</b>
                {web ? ` · ${t(lang, "thunder_patience")}` : ""}
              </p>
            )}
          </section>

          {notes.length > 0 && (
            <div className="th-notes">
              {notes.map((n, i) => (
                <div key={i} className="th-note th-entre" data-niveau={n.niveau} role={n.niveau === "erreur" ? "alert" : undefined}>
                  {n.titre ? (
                    <p className="th-note-tete">
                      {n.niveau === "erreur" || n.niveau === "alerte" ? <ShieldAlert size={14} /> : n.niveau === "web" ? <Globe size={14} /> : <ArrowRight size={14} />}
                      {n.titre}
                    </p>
                  ) : null}
                  <ul className={n.titre ? undefined : "th-note--nue"}>
                    {n.lignes.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {enCours && (
            <div className="th-squelette" aria-hidden>
              <i />
              <i />
              <i />
            </div>
          )}

          {reponse && (
            <article className="th-reponse th-entre" aria-live="polite">
              <div className="th-reponse-tete">
                <span className="th-pastille th-pastille--violet">{t(lang, "thunder_ask")}</span>
                {typeof contexte?.passages === "number" && (
                  <span className="th-pastille">
                    {nombre(contexte.passages, lang)} · {t(lang, "thunder_passages_cites")}
                  </span>
                )}
                {typeof contexte?.dont_web === "number" && contexte.dont_web > 0 && (
                  <span className="th-pastille">
                    {nombre(contexte.dont_web, lang)} · {t(lang, "thunder_pages_lues")}
                  </span>
                )}
                <button type="button" className="th-bouton th-bouton--fantome th-bouton--mini th-pousser" onClick={copier}>
                  {copie === "ok" ? <Check size={13} /> : <Copy size={13} />} {copie === "ok" ? t(lang, "thunder_copie") : t(lang, "thunder_copier")}
                </button>
              </div>
              <div className="th-corps-reponse">
                <div className="ai-markdown" dangerouslySetInnerHTML={{ __html: markdown(reponse) }} />
              </div>
              {copie === "refuse" && <p className="th-aide th-copie-note">{t(lang, "thunder_copie_impossible")}</p>}
              {citations.length > 0 && (
                <details className="th-citations" open>
                  <summary>
                    {nombre(citations.length, lang)} · {t(lang, "thunder_passages_cites")}
                  </summary>
                  <ol className="th-liste-nue">
                    {citations.map((c) => (
                      <li key={c.n} className={`th-cite${c.origine === "web" ? "" : " th-cite--cours"}`}>
                        <span className="th-cite-n">S{c.n}</span>
                        <span>
                          {c.url ? (
                            <a href={c.url} target="_blank" rel="noopener noreferrer nofollow">
                              {c.titre.replace(/^web · /, "")}
                            </a>
                          ) : (
                            <span className="th-cite-titre">{c.titre}</span>
                          )}
                          {c.origine === "web" && (
                            <span className="th-pastille th-pastille--violet">
                              web
                            </span>
                          )}
                          {c.origine === "web" && c.page_lue === false && (
                            <span className="th-pastille">
                              {t(lang, "thunder_extrait_seul")}
                            </span>
                          )}
                          <blockquote>{c.extrait}</blockquote>
                        </span>
                      </li>
                    ))}
                  </ol>
                </details>
              )}
              <div className="th-pied-quiz th-pied-quiz--reponse">
                <button type="button" className="th-bouton th-bouton--fantome th-bouton--mini" onClick={demander} disabled={enCours}>
                  {t(lang, "thunder_redemander")}
                </button>
              </div>
            </article>
          )}

          {liens && (
            <section className="th-panneau th-entre">
              <h2 className="th-etiquette">
                <i aria-hidden /> <Link2 size={13} /> {t(lang, "thunder_links")}
              </h2>
              {liens.avertissement && <p className="th-aide th-bloc">{liens.avertissement}</p>}
              <ul className="th-liens">
                {(liens.recherche ?? []).map((l) => (
                  <li key={l.sujet} className="th-lien">
                    <b>{l.sujet}</b>
                    <a className="th-bouton th-bouton--fantome th-bouton--mini" href={l.youtube} target="_blank" rel="noopener noreferrer nofollow">
                      YouTube
                    </a>
                    <a className="th-bouton th-bouton--fantome th-bouton--mini" href={l.web} target="_blank" rel="noopener noreferrer nofollow">
                      Web
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── QCM : une carte par question, correction locale, jauge réelle ── */}
          {questions && questions.length > 0 && (
            <section className="th-panneau th-entre">
              <h2 className="th-etiquette">
                <i aria-hidden /> <ListChecks size={13} /> {t(lang, "thunder_quiz")}
                <b>
                  {nombre(repondues, lang)}/{nombre(questions.length, lang)}
                </b>
              </h2>
              <div className="th-jauge">
                <span className="th-jauge-barre" role="progressbar" aria-valuenow={Math.round(taux * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={t(lang, "thunder_questions_repondues")}>
                  <i style={{ width: `${Math.round(taux * 100)}%` }} />
                </span>
                <b>
                  {nombre(Math.round(taux * 100), lang)} % · {t(lang, "thunder_questions_repondues")}
                </b>
              </div>

              <ol className="th-quiz">
                {questions.map((q, i) => {
                  const ligne = correction?.lignes.find((l) => l.n === i + 1);
                  return (
                    <li key={i} className="th-question" data-etat={correction ? (ligne?.justifie ? "juste" : "faux") : undefined}>
                      <div className="th-question-tete">
                        <span className="th-question-n">{i + 1}</span>
                        <p className="th-question-e">{q.question}</p>
                        {correction && (
                          <span className="th-verdict" data-sens={ligne?.justifie ? "juste" : reponses[i] === null || reponses[i] === undefined ? "vide" : "faux"}>
                            {ligne?.justifie ? t(lang, "thunder_juste") : reponses[i] === null || reponses[i] === undefined ? t(lang, "thunder_sans_reponse") : t(lang, "thunder_faux")}
                          </span>
                        )}
                      </div>
                      <div>
                        {q.choices.map((c, j) => {
                          const monte = reponses[i] === j;
                          const estBonne = q.answer === j;
                          return (
                            <label
                              key={j}
                              className="th-choix"
                              data-choisi={monte ? "oui" : undefined}
                              data-bonne={correction && estBonne ? "oui" : undefined}
                              data-rejetee={correction && monte && !ligne?.justifie ? "oui" : undefined}
                            >
                              <input type="radio" name={`q${i}`} checked={monte} onChange={() => choisir(i, j)} disabled={!!correction} />
                              <span>{c}</span>
                            </label>
                          );
                        })}
                      </div>
                      {correction && (
                        <div className="th-explication">
                          <strong>[S{q.source.replace("S", "")}]</strong> {q.explication}
                          {q.extrait ? <blockquote>{q.extrait}</blockquote> : null}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>

              <div className="th-pied-quiz">
                {!correction ? (
                  <button type="button" className="th-bouton" onClick={corriger} disabled={reponses.some((r) => r === null)}>
                    {t(lang, "thunder_corriger")}
                  </button>
                ) : (
                  <span className="th-score">
                    {t(lang, "thunder_score")} <b>
                      {nombre(correction.justes, lang)}/{nombre(questions.length, lang)}
                    </b>
                  </span>
                )}
                {correction && reponses.some((r) => r === null) && <span className="th-aide">{t(lang, "thunder_vide")}</span>}
              </div>
            </section>
          )}

          {/* ── Progression : ce que la base a gardé des parties précédentes ── */}
          <section className="th-panneau">
            <h2 className="th-etiquette">
              <i aria-hidden /> {t(lang, "thunder_historique")}
              {resume ? (
                <b>
                  {nombre(resume.parties, lang)} · {nombre(Math.round(resume.moyenne), lang)} %
                </b>
              ) : null}
            </h2>
            {historique.length === 0 ? (
              <p className="th-aide">{t(lang, "thunder_vide")}</p>
            ) : (
              <ul className="th-histo-liste">
                {historique.slice(0, 8).map((h) => (
                  <li key={h.id}>
                    <span>{new Date(h.created_at).toLocaleString(lang === "fr" ? "fr-FR" : lang === "ar" ? "ar-MA" : lang, { dateStyle: "short", timeStyle: "short" })}</span>
                    <span>{h.niveau ?? "—"}</span>
                    <b>
                      {nombre(h.justes, lang)}/{nombre(h.total, lang)}
                    </b>
                    <span className="th-mini-jauge">
                      <i style={{ width: `${h.total ? Math.round((h.justes / h.total) * 100) : 0}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

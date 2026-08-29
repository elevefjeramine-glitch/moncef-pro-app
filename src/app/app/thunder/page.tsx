"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Bot, Globe, Link2, ListChecks, Plus, Send, ShieldAlert, Trash2, Zap } from "lucide-react";
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
 */

type Source = { id: string; titre: string; matiere: string | null; longueur: number | string; created_at: string };
type Citation = { n: number; titre: string; extrait: string; url?: string | null; origine?: "cours" | "web"; page_lue?: boolean };
type Question = { question: string; choices: string[]; answer: number; explication: string; source: string; extrait?: string };
type Partie = { id: string; total: number; justes: number; niveau: string | null; lignes: { n: number; justifie: boolean; choisi: number | null }[]; created_at: string };

/**
 * Le violet est la couleur de Thunder, partout : dans le menu, sur la page, sur
 * les citations qui viennent du web. Elle est reprise de la palette déjà usada
 * par le panneau admin (rôle modérateur) pour ne pas inventer un sixième bleu.
 */
const VIOLET = "#a78bfa";
const VIOLET_DOUX = "rgba(167,139,250,0.14)";
const VIOLET_LIEN = "rgba(167,139,250,0.34)";

const markdown = (texte: string) =>
  DOMPurify.sanitize(marked.parse(texte, { async: false, breaks: true, gfm: true }) as string, { USE_PROFILES: { html: true } });

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
  const [cout, setCout] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [liens, setLiens] = useState<{ verifiees?: { url: string; titre: string }[]; recherche?: { sujet: string; youtube: string; web: string }[]; avertissement?: string } | null>(null);
  const [reponses, setReponses] = useState<(number | null)[]>([]);
  const [correction, setCorrection] = useState<{ justes: number; lignes: { n: number; justifie: boolean; choisi: number | null }[] } | null>(null);
  const [historique, setHistorique] = useState<Partie[]>([]);
  const [resume, setResume] = useState<{ parties: number; moyenne: number } | null>(null);

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
      setCout(typeof d.debite === "number" ? d.debite : null);
      return d;
    } catch (e) {
      setErreur("Thunder est injoignable : " + (e instanceof Error ? e.message : "réseau"));
      return null;
    } finally {
      setEnCours(false);
    }
  };

  const demander = async () => {
    setReponse(null);
    setCitations([]);
    setQuestions(null);
    setLiens(null);
    setCorrection(null);
    const urls = webUrls.split(/\n|,/).map((x) => x.trim()).filter(Boolean).slice(0, 4);
    const d = await appeler({
      mode,
      question,
      include_all_sources: true,
      niveau: niveaux,
      n: nbQuestions,
      // Le web n'est demandé que si l'élève le demande : la promesse de Thunder
      // (« je ne réponds qu'à partir de ce que tu m'as donné ») reste vraie par défaut.
      ...(mode === "ask" && (web || urls.length) ? { web: true, web_urls: urls } : {}),
    });
    if (!d) return;
    if (mode === "ask") {
      setReponse(String(d.reponse ?? ""));
      setCitations(Array.isArray(d.citations) ? d.citations : []);
      setAvertissements(Array.isArray(d.avertissements) ? d.avertissements : []);
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

  const taux = useMemo(() => (reponses.length ? reponses.filter((r) => r !== null).length / reponses.length : 0), [reponses]);

  const mode_ = [
    { id: "ask", label: t(lang, "thunder_ask"), icon: Send },
    { id: "quiz", label: t(lang, "thunder_quiz"), icon: ListChecks },
    { id: "links", label: t(lang, "thunder_links"), icon: Link2 },
  ] as const;

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "24px clamp(16px, 3vw, 40px) 80px" }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: "clamp(26px, 3.4vw, 40px)", margin: 0, letterSpacing: "-0.03em", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 34, height: 34, borderRadius: 11, background: VIOLET_DOUX, border: "1px solid " + VIOLET_LIEN, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={18} style={{ color: VIOLET }} aria-hidden />
          </span>
          {t(lang, "thunder_title")}
        </h1>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20, alignItems: "start" }}>
        {/* ── Panneau des sources : c'est lui qui borne la réponse ── */}
        <section className="card" style={{ padding: 20, borderRadius: 18 }}>
          <h2 style={{ fontSize: 15, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
            <BookOpen size={16} /> {t(lang, "thunder_sources")}
            <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.6 }}>{sources.length}</span>
          </h2>

          {sources.length === 0 && (
            <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", margin: "0 0 12px" }}>{t(lang, "thunder_s_vide")}</p>
          )}

          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            {sources.map((s) => (
              <li key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)", fontSize: 13 }}>
                <span style={{ fontWeight: 700 }}>{s.titre}</span>
                {s.matiere ? <span style={{ opacity: 0.55, fontSize: 12 }}>{s.matiere}</span> : null}
                <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.5 }}>{Number(s.longueur).toLocaleString("fr-FR")} car.</span>
                <button type="button" onClick={() => supprimer(s.id)} title={t(lang, "thunder_s_delete")} style={{ background: "none", border: 0, cursor: "pointer", color: "inherit", opacity: 0.55, padding: 2 }}>
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input style={champ} placeholder={t(lang, "thunder_s_title")} value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} />
            <input style={champ} placeholder={t(lang, "thunder_s_matiere")} value={form.matiere} onChange={(e) => setForm({ ...form, matiere: e.target.value })} />
            <textarea
             
              style={{ ...champ, minHeight: 110, resize: "vertical", fontFamily: "inherit", lineHeight: 1.55 }}
              placeholder={t(lang, "thunder_s_text")}
              value={form.texte}
              onChange={(e) => setForm({ ...form, texte: e.target.value })}
            />
            <p style={{ fontSize: 11, opacity: 0.55, margin: 0 }}>{form.texte.trim().length} / 400 000</p>
            <button type="button" className="btn" style={{ justifySelf: "start" }} onClick={ajouter} disabled={majSources || form.texte.trim().length < 40}>
              <Plus size={14} /> {majSources ? "…" : t(lang, "thunder_s_save")}
            </button>
          </div>
        </section>

        {/* ── La question, bornée aux sources ── */}
        <section className="card" style={{ padding: 20, borderRadius: 18 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {mode_.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
                  padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700,
                  border: mode === m.id ? "1px solid " + VIOLET : "1px solid rgba(255,255,255,0.1)",
                  background: mode === m.id ? VIOLET_DOUX : "transparent", color: "inherit",
                }}
              >
                <m.icon size={14} /> {m.label}
              </button>
            ))}
          </div>

          {mode === "quiz" && (
            <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                {t(lang, "thunder_n")}
                <input type="number" min={3} max={10} value={nbQuestions} onChange={(e) => setNbQuestions(Math.min(10, Math.max(3, Number(e.target.value) || 5)))} style={{ ...champ, width: 62 }} />
              </label>
              <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                {t(lang, "thunder_niveau")}
                <select value={niveaux} onChange={(e) => setNiveau(e.target.value)} style={{ ...champ, width: 130 }}>
                  <option value="collège">collège</option>
                  <option value="lycée">lycée</option>
                  <option value="terminale">terminale</option>
                  <option value="supérieur">supérieur</option>
                </select>
              </label>
            </div>
          )}

          {mode === "ask" && (
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer", userSelect: "none" }}>
                <input
                  type="checkbox"
                  checked={web}
                  onChange={(e) => setWeb(e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: VIOLET, cursor: "pointer" }}
                />
                <Globe size={13} style={{ color: web ? VIOLET : undefined }} /> {t(lang, "thunder_web")}
              </label>
              {web && (
                <textarea
                  style={{ ...champ, minHeight: 46, marginTop: 8, fontFamily: "inherit", lineHeight: 1.5, fontSize: 12.5 }}
                  placeholder={t(lang, "thunder_web_urls")}
                  value={webUrls}
                  onChange={(e) => setWebUrls(e.target.value)}
                  aria-label={t(lang, "thunder_web_urls")}
                />
              )}
            </div>
          )}

          <textarea
            style={{ ...champ, minHeight: 76, resize: "vertical", fontFamily: "inherit", lineHeight: 1.55 }}
            placeholder={t(lang, "thunder_q")}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
            <button type="button" className="btn" onClick={demander} disabled={enCours || question.trim().length < 3}>
              <Bot size={14} /> {enCours ? "…" : t(lang, "thunder_send")}
            </button>
            {cout !== null && <span style={{ fontSize: 12, opacity: 0.6 }}>{cout} cr.</span>}
          </div>

          {erreur && (
            <p role="alert" style={{ color: "#ff6b6b", fontSize: 13, marginTop: 12, lineHeight: 1.5 }}>
              {erreur}
            </p>
          )}

          {avertissements.length > 0 && (
            <div style={{ marginTop: 14, border: "1px solid rgba(255,215,0,0.28)", background: "rgba(255,215,0,0.06)", borderRadius: 12, padding: 12 }}>
              <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
                <ShieldAlert size={14} /> {t(lang, "thunder_avertissements")}
              </p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6, color: "var(--muted-foreground)" }}>
                {avertissements.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          {reponse && (
            <article style={{ marginTop: 16, padding: 16, borderRadius: 14, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="ai-markdown" dangerouslySetInnerHTML={{ __html: markdown(reponse) }} />
              {citations.length > 0 && (
                <details style={{ marginTop: 12 }}>
                  <summary style={{ cursor: "pointer", fontSize: 12.5, opacity: 0.75 }}>
                    {citations.length} passage(s) cité(s)
                  </summary>
                  <ol style={{ margin: "10px 0 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                    {citations.map((c) => (
                      <li key={c.n} style={{ fontSize: 12.5, lineHeight: 1.55 }}>
                        <strong>[S{c.n}]</strong>{" "}
                        {c.url ? (
                          <a href={c.url} target="_blank" rel="noopener noreferrer nofollow" style={{ color: VIOLET, fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 2 }}>
                            {c.titre.replace(/^web · /, "")}
                          </a>
                        ) : (
                          <strong>{c.titre}</strong>
                        )}
                        {c.origine === "web" && (
                          <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 800, padding: "1px 6px", borderRadius: 999, background: VIOLET_DOUX, color: VIOLET, border: "1px solid " + VIOLET_LIEN }}>web</span>
                        )}
                        {c.origine === "web" && c.page_lue === false && <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.6 }}>extrait seul, page non ouverte</span>}
                        <blockquote style={{ margin: "4px 0 0", paddingLeft: 10, borderLeft: "2px solid " + (c.origine === "web" ? VIOLET : "var(--a)"), color: "var(--muted-foreground)" }}>{c.extrait}</blockquote>
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </article>
          )}

          {liens && (
            <div style={{ marginTop: 16 }}>
              {liens.avertissement && <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "0 0 10px" }}>{liens.avertissement}</p>}
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {(liens.recherche ?? []).map((l) => (
                  <li key={l.sujet} style={{ border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "10px 12px", fontSize: 13 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>{l.sujet}</div>
                    <a href={l.youtube} target="_blank" rel="noopener noreferrer nofollow" style={{ marginRight: 14 }}>YouTube</a>
                    <a href={l.web} target="_blank" rel="noopener noreferrer nofollow" style={{ opacity: 0.8 }}>Web</a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Le tableau interactif : une ligne par question, correction locale ── */}
          {questions && questions.length > 0 && (
            <div style={{ marginTop: 18, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--muted-foreground)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    <th style={{ padding: "8px 10px", width: 34 }}>#</th>
                    <th style={{ padding: "8px 10px" }}>{t(lang, "thunder_q")}</th>
                    <th style={{ padding: "8px 10px", width: 120 }}>{t(lang, "thunder_reponse")}</th>
                    <th style={{ padding: "8px 10px", width: 60 }}>S</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q, i) => {
                    const ligne = correction?.lignes.find((l) => l.n === i + 1);
                    return (
                      <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: ligne ? (ligne.justifie ? "rgba(34,197,94,0.07)" : "rgba(255,107,107,0.07)") : "transparent" }}>
                        <td style={{ padding: "10px", opacity: 0.55 }}>{i + 1}</td>
                        <td style={{ padding: "10px" }}>
                          <div style={{ marginBottom: 8 }}>{q.question}</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            {q.choices.map((c, j) => {
                              const monte = reponses[i] === j;
                              const estBonne = q.answer === j;
                              return (
                                <label key={j} style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer", fontSize: 12.5, opacity: correction && !estBonne && !monte ? 0.55 : 1 }}>
                                  <input type="radio" name={`q${i}`} checked={monte} onChange={() => choisir(i, j)} disabled={!!correction} />
                                  <span style={{ textDecoration: correction && monte && !ligne?.justifie ? "line-through" : "none", fontWeight: correction && estBonne ? 800 : 400 }}>
                                    {c}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                          {correction && (
                            <details style={{ marginTop: 6 }}>
                              <summary style={{ fontSize: 11.5, cursor: "pointer", opacity: 0.75 }}>{t(lang, "thunder_explication")} · [S{q.source.replace("S", "")}]</summary>
                              <p style={{ fontSize: 12, margin: "6px 0 0", color: "var(--muted-foreground)", lineHeight: 1.55 }}>{q.explication}</p>
                              {q.extrait ? <blockquote style={{ fontSize: 11.5, margin: "6px 0 0", paddingLeft: 10, borderLeft: "2px solid var(--a)" }}>{q.extrait}</blockquote> : null}
                            </details>
                          )}
                        </td>
                        <td style={{ padding: "10px" }}>
                          {correction ? (
                            <span style={{ fontSize: 12, fontWeight: 800, color: ligne?.justifie ? "#22c55e" : "#ff6b6b" }}>{ligne?.justifie ? "✓" : ligne?.choisi === null || ligne?.choisi === undefined ? "—" : `#${ligne.choisi + 1} → #${q.answer + 1}`}</span>
                          ) : (
                            <span style={{ fontSize: 12, opacity: 0.5 }}>{Math.round(taux * 100)} %</span>
                          )}
                        </td>
                        <td style={{ padding: "10px", fontSize: 11, opacity: 0.6 }}>{q.source}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
                {!correction ? (
                  <button type="button" className="btn" onClick={corriger} disabled={reponses.some((r) => r === null)}>
                    {t(lang, "thunder_corriger")}
                  </button>
                ) : (
                  <span style={{ fontSize: 15, fontWeight: 900 }}>
                    {t(lang, "thunder_score")} {correction.justes}/{questions.length}
                  </span>
                )}
                {correction && reponses.some((r) => r === null) && <span style={{ fontSize: 12, opacity: 0.7 }}>{t(lang, "thunder_vide")}</span>}
              </div>
            </div>
          )}

          {/* ── Progression : ce que la base a gardé des parties précédentes ── */}
          <section style={{ marginTop: 22 }}>
            <h3 style={{ fontSize: 13, margin: "0 0 8px", display: "flex", alignItems: "center", gap: 8 }}>
              {t(lang, "thunder_historique")}
              {resume ? <span style={{ fontWeight: 400, opacity: 0.65, fontSize: 12 }}>· {resume.parties} · {resume.moyenne} %</span> : null}
            </h3>
            {historique.length === 0 ? (
              <p style={{ fontSize: 12.5, color: "var(--muted-foreground)", margin: 0 }}>—</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <tbody>
                  {historique.slice(0, 8).map((h) => (
                    <tr key={h.id} style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <td style={{ padding: "7px 8px", opacity: 0.7 }}>{new Date(h.created_at).toLocaleString(lang === "fr" ? "fr-FR" : undefined, { dateStyle: "short", timeStyle: "short" })}</td>
                      <td style={{ padding: "7px 8px" }}>{h.niveau ?? "—"}</td>
                      <td style={{ padding: "7px 8px", fontWeight: 800 }}>{h.justes}/{h.total}</td>
                      <td style={{ padding: "7px 8px", opacity: 0.6 }}>{h.lignes?.filter((l) => l.justifie).length ?? 0} ✓ · {h.lignes?.filter((l) => !l.justifie).length ?? 0} ✗</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </section>
      </div>
    </div>
  );
}

const champ: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.03)",
  color: "inherit",
  fontSize: 13,
  boxSizing: "border-box",
};

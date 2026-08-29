"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { useLanguage, t } from "@/utils/i18n";

/**
 * Le lien d'agenda (lot A4). Un bloc, quatre boutons, aucune donnée qui sort du site.
 *
 * Ce que ça fait : créer un jeton de 32 hexadécimaux, l'URL `/api/agenda/<jeton>.ics`,
 * et la donner à l'élève. Ce que ça ne fait pas : rien n'est poussé vers Google, rien
 * n'est stocké ailleurs que dans `public.agenda_tokens` (une ligne par compte). Le
 * calendrier relit l'URL ; le jour où ça ne plaît plus, « Retirer » et le lien rend un 404.
 *
 * `navigator.clipboard` est optionnel : sur http:// ou un vieux Safari, il n'existe pas —
 * on sélectionne le champ à la place plutôt que de faire semblant d'avoir copié.
 */
type Etat = {
  actif: boolean;
  cree_le: string | null;
  vu_le: string | null;
  lectures: number;
  comptes: { cours: number; devoirs: number; evenements: number };
  resume: string;
  lien: string | null;
};

export default function AgendaLien() {
  const lang = useLanguage();
  const [etat, setEtat] = useState<Etat | null>(null);
  const [lien, setLien] = useState<string | null>(null);
  const [occupation, setOccupation] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const jeton = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }, []);

  const lire = useCallback(async () => {
    const token = await jeton();
    const r = await fetch("/api/agenda", { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
    if (!r || !r.ok) return;
    setEtat((await r.json()) as Etat);
  }, [jeton]);

  useEffect(() => {
    lire().catch(() => {});
  }, [lire]);

  const agir = async (action: "creer" | "regenerer" | "retirer") => {
    setOccupation(true);
    setErreur(null);
    setMessage(null);
    const token = await jeton();
    try {
      const r = await fetch("/api/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErreur(String(d?.error ?? "Le serveur n'a pas répondu."));
        return;
      }
      if (typeof d?.lien === "string") setLien(`${window.location.origin}${d.lien}`);
      if (action === "retirer") setLien(null);
      if (action === "regenerer") setMessage(String(d?.message ?? ""));
      await lire();
    } finally {
      setOccupation(false);
    }
  };

  const copier = async () => {
    if (!lien) return;
    try {
      await navigator.clipboard.writeText(lien);
      setMessage(t(lang, "sch_agenda_copie"));
    } catch {
      setMessage(t(lang, "sch_agenda_copie_manuelle"));
    }
  };

  const v = etat?.vu_le ? new Date(etat.vu_le).toLocaleString(lang === "ar" ? "ar-MA" : lang) : null;

  return (
    <section className="agenda-lien">
      <h3 className="agenda-lien-titre">{t(lang, "sch_agenda")}</h3>
      <p className="agenda-lien-aide">{t(lang, "sch_agenda_sub")}</p>

      {etat?.actif ? (
        <>
          {lien && (
            <label className="agenda-lien-champ">
              <span className="agenda-lien-etiquette">{t(lang, "sch_agenda_lien")}</span>
              <input readOnly value={lien} onFocus={(e) => e.currentTarget.select()} />
            </label>
          )}
          <p className="agenda-lien-comptes">
            {etat.resume} · {v ? `${t(lang, "sch_agenda_lu")} : ${v} (${etat.lectures})` : t(lang, "sch_agenda_jamais")}
          </p>
          <p className="agenda-lien-note">{t(lang, "sch_agenda_note")}</p>
        </>
      ) : (
        <p className="agenda-lien-comptes">{t(lang, "sch_agenda_aucun")}</p>
      )}

      {message && <p className="agenda-lien-ok">{message}</p>}
      {erreur && <p className="agenda-lien-erreur">{erreur}</p>}

      <div className="agenda-lien-boutons">
        {!etat?.actif && (
          <button type="button" onClick={() => agir("creer")} disabled={occupation}>
            {t(lang, "sch_agenda_creer")}
          </button>
        )}
        {etat?.actif && !lien && (
          <button type="button" onClick={() => agir("creer")} disabled={occupation}>
            {t(lang, "sch_agenda_afficher")}
          </button>
        )}
        {etat?.actif && (
          <>
            <button type="button" onClick={copier} disabled={!lien}>
              {t(lang, "sch_agenda_copier")}
            </button>
            <button type="button" onClick={() => agir("regenerer")} disabled={occupation}>
              {t(lang, "sch_agenda_regenerer")}
            </button>
            <button type="button" className="agenda-lien--danger" onClick={() => agir("retirer")} disabled={occupation}>
              {t(lang, "sch_agenda_retirer")}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

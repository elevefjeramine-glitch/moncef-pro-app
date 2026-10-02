"use client";

/**
 * Le bandeau « hors-ligne », et l'enregistrement du service worker.
 *
 * Un seul devoir : dire la vérité sur l'état du réseau — y compris quand il n'y
 * a RIEN à lire, parce que « rien n'a encore été gardé » est une information,
 * pas une absence. Ne jamais laisser croire qu'un envoi est parti : le texte du
 * bandeau le dit, et c'est `src/lib/hors-ligne.ts` qui fabrique la phrase
 * (testée, cinq langues).
 */
import { useCallback, useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useLanguage, t } from "@/utils/i18n";
import { demarrer, lireComptes, type Comptes } from "@/lib/hors-ligne";

const VIDE: Comptes = { fiches: 0, cartes: 0, devoirs: 0, ageMinutes: null };

export default function HorsLigne({ uid }: { uid: string | null }) {
  const lang = useLanguage();
  const [enLigne, setEnLigne] = useState(true);
  const [comptes, setComptes] = useState<Comptes>(VIDE);

  useEffect(() => {
    demarrer();
  }, []);

  useEffect(() => {
    const auReseau = () => setEnLigne(navigator.onLine);
    auReseau();
    window.addEventListener("online", auReseau);
    window.addEventListener("offline", auReseau);
    return () => {
      window.removeEventListener("online", auReseau);
      window.removeEventListener("offline", auReseau);
    };
  }, []);

  const rafraichir = useCallback(() => {
    if (!uid) return;
    lireComptes(uid).then(setComptes).catch(() => setComptes(VIDE));
  }, [uid]);

  useEffect(() => {
    rafraichir();
    // Un aller-retour toutes les 30 s suffit : ce chiffre est un confort, pas une facture.
    const minuterie = window.setInterval(rafraichir, 30_000);
    return () => window.clearInterval(minuterie);
  }, [rafraichir]);

  const message = enLigne
    ? ""
    : [
        t(lang, "pwa_hors_ligne"),
        `${comptes.fiches} ${t(lang, "pwa_fiches")} · ${comptes.cartes} ${t(lang, "pwa_cartes")} · ${comptes.devoirs} ${t(lang, "pwa_devoirs")}`,
        comptes.fiches + comptes.cartes + comptes.devoirs === 0 ? t(lang, "pwa_rien_garde") : t(lang, "pwa_rien_ne_part"),
      ].filter(Boolean).join(" — ");

  if (!message) return null;

  return (
    <div className="hp-barre" role="status" aria-live="polite" data-hors-ligne="oui">
      <span className="hp-barre-texte">
        <WifiOff size={13} aria-hidden="true" /> {message}
      </span>
    </div>
  );
}

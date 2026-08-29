"use client";

/**
 * Le bandeau « hors-ligne », et l'enregistrement du service worker.
 *
 * Deux devoirs, dans cet ordre :
 *  · dire la vérité sur l'état du réseau — y compris quand il n'y a RIEN à lire, parce
 *    que « rien n'a encore été gardé » est une information, pas une absence ;
 *  · ne jamais laisser croire qu'un envoi est parti : le texte du bandeau le dit, et
 *    c'est `src/lib/hors-ligne.ts` qui fabrique la phrase (testée, cinq langues).
 */
import { useCallback, useEffect, useState } from "react";
import { WifiOff, Download } from "lucide-react";
import { useLanguage, t } from "@/utils/i18n";
import { demarrer, lireComptes, proposerInstallation, type Comptes } from "@/lib/hors-ligne";

const VIDE: Comptes = { fiches: 0, cartes: 0, devoirs: 0, ageMinutes: null };

export default function HorsLigne({ uid }: { uid: string | null }) {
  const lang = useLanguage();
  const [enLigne, setEnLigne] = useState(true);
  const [comptes, setComptes] = useState<Comptes>(VIDE);
  const [peutInstaller, setPeutInstaller] = useState(false);
  const [installation, setInstallation] = useState<Event | null>(null);

  useEffect(() => {
    demarrer();
    // `beforeinstallprompt` n'existe que si le navigateur juge le site installable :
    // on ne fabrique pas un bouton d'installation pour rien.
    const surEvenement = (e: Event) => {
      e.preventDefault();
      setInstallation(e);
      setPeutInstaller(true);
    };
    window.addEventListener("beforeinstallprompt", surEvenement);
    return () => window.removeEventListener("beforeinstallprompt", surEvenement);
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

  if (!message && !peutInstaller) return null;

  return (
    <div className="hp-barre" role="status" aria-live="polite" data-hors-ligne={enLigne ? "non" : "oui"}>
      {!enLigne && (
        <span className="hp-barre-texte">
          <WifiOff size={13} aria-hidden="true" /> {message}
        </span>
      )}
      {enLigne && peutInstaller && proposerInstallation(true, false, 0) && (
        <button
          type="button"
          className="hp-barre-bouton"
          onClick={async () => {
            const e = installation as (Event & { prompt?: () => void; userChoice?: Promise<unknown> }) | null;
            e?.prompt?.();
            try {
              await e?.userChoice;
            } catch {
              /* le refus de l'élève n'est pas une erreur */
            }
            setPeutInstaller(false);
            setInstallation(null);
          }}
        >
          <Download size={13} aria-hidden="true" /> {t(lang, "pwa_installer")}
        </button>
      )}
    </div>
  );
}

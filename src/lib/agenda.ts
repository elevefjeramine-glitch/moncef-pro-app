/**
 * L'export `.ics` (lot A4) : l'agenda de l'élève, dans son calendrier téléphone.
 *
 * Écrit à la main, sans librairie, pour une raison : un calendrier se souscrit par URL,
 * il est relu des semaines plus tard par trois moteurs différents (Google, Apple,
 * Thunderbird) dont aucun ne pardonne la même chose. Ce qu'il faut respecter, et ce que
 * les tests vérifient :
 *  · lignes en CRLF, coupées à 75 OCTETS (pas 75 caractères : un « é » en pèse deux, et
 *    un titre en arabe explose la limite) — la continuation commence par une espace ;
 *  · `UNTIL` en UTC, suffixe `Z`, sinon Google jette la règle entière ;
 *  · TEXT échappé : `\\` `;` `,` et les sauts de ligne en `\n` ;
 *  · un `UID` stable par ligne de base : sans lui, la re-souscription duplique tout.
 *
 * Les semaines A/B : DEUX séries `RRULE:FREQ=WEEKLY;INTERVAL=2`, décalées d'une semaine
 * par l'ancre de départ — c'est le seul point du fichier où il faut être soigné, et il
 * est testé sur des dates précises. Le fuseau est Africa/Casablanca sans passage à
 * l'heure d'été (le Maroc est à UTC+1 en continu depuis 2018) : un `VTIMEZONE` sans
 * `DAYLIGHT`, et un seul.
 */

export const FUSEAU = "Africa/Casablanca";
export const DECALAGE_FUSEAU = "+0100";
/** Un semestre scolaire, en jours : au-delà, un calendrier qui se répète n'est plus une
 *  information, c'est un pari. Le client re-charge le fichier ; l'horizon se déplace. */
export const HORIZON_JOURS = 120;
/** `day_index` 0 = Lundi : c'est ce que dit le dictionnaire du site (`d0` = « Lundi »),
 *  et `tests/agenda.test.ts` le vérifie — si l'ordre changeait dans l'app, ce test rougit. */
export const JOURS_SEMAINE = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"] as const;
const JOURS_ICS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
const DUREE_PAR_DEFAUT_MINUTES = 60;

export type Cours = { id: string; day_index: number | null; week: string | null; subj: string | null; time_slot: string | null };
export type Devoir = { id: string; subject: string | null; task: string | null; due_date: string | null; status: string | null; priority: string | null };
export type Evenement = { id: string; title: string | null; description: string | null; event_date: string | null; event_time: string | null; category: string | null };

/** "08:00-09:30", "08:00–09:30" (tiret demi-cadratin, fréquent sous Word), "08:00",
 *  "8h". Une seule heure donnée → durée par défaut, et on le DIT dans le texte de
 *  l'événement : mieux vaut un cours annoncé d'une heure qu'un cours absent du calendrier. */
export function analyserCreneau(creneau: string | null | undefined, defautMinutes = DUREE_PAR_DEFAUT_MINUTES): { debut: string; fin: string; presume: boolean } | null {
  const brut = String(creneau ?? "")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\s+/g, "")
    .toLowerCase()
    // « 8h », « 14h30 » : la façon dont un élève recopie un emploi du temps.
    .replace(/(\d{1,2})h(\d{1,2})?/g, (_t, h, m) => `${String(h).padStart(2, "0")}:${m ? m.padStart(2, "0") : "00"}`);
  const heures = brut.split(/[-/]/).map((x) => /^(\d{1,2}):(\d{2})$/.exec(x)).filter(Boolean) as RegExpExecArray[];
  if (heures.length === 0) return null;
  const format = (m: RegExpExecArray) => `${m[1]!.padStart(2, "0")}:${m[2]!}`;
  const debut = format(heures[0]!);
  if (heures.length === 1) return { debut, fin: ajouterMinutes(debut, defautMinutes), presume: true };
  return { debut, fin: format(heures[1]!), presume: false };
}

function ajouterMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (h! * 60 + m! + minutes + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** L'ISO 8601 de la semaine : numéro + parité. C'est elle qui décide si un cours
 *  « semaine A » tombe cette semaine ou la suivante. */
export function numeroSemaineIso(d: Date): { numero: number; pair: boolean } {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const jour = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - jour + 3);
  const premiere = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const numero = 1 + Math.round(((date.getTime() - premiere.getTime()) / 86400000 - 3 + ((premiere.getUTCDay() + 6) % 7)) / 7);
  return { numero, pair: numero % 2 === 0 };
}

/** La convention, parce qu'il en faut une et qu'elle doit être écrite : la semaine A
 *  tombe sur les semaines ISO PAIRES, la semaine B sur les impaires. L'application,
 *  elle, alterne à la main (boutons A/B) sans stocker de parité — donc un calendrier
 *  qui se recharge tout seul a besoin d'une règle fixe, sinon les deux semaines
 *  glissent l'une sur l'autre au premier rechargement. »
 */
export const SEMAINE_A_PAIRE = true;

/** Le premier jour demandé à partir d'aujourd'hui — JAMAIS en arrière : un cours de
 *  jeudi déjà passé cette semaine doit apparaître la semaine suivante, pas hier. */
export function ancrerJour(jourIndex: number, semaine: string | null, maintenant: Date): Date {
  const actuelle = (maintenant.getUTCDay() + 6) % 7;
  const demande = String(semaine ?? "").trim().toUpperCase();
  let delta = ((((jourIndex % 7) + 7) % 7) - actuelle + 7) % 7;
  let d = new Date(maintenant.getTime() + delta * 86400000);
  if (demande === "A" || demande === "B") {
    const veutPaire = demande === "A" ? SEMAINE_A_PAIRE : !SEMAINE_A_PAIRE;
    if (numeroSemaineIso(d).pair !== veutPaire) d = new Date(d.getTime() + 7 * 86400000);
  }
  return d;
}

export function deplier_lignes(lignes: string[]): string {
  return lignes.map((l) => plier(l)).join("\r\n");
}

export function echapper(txt: string | null | undefined): string {
  return String(txt ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Plier à 75 OCTETS UTF-8, en continuant par une espace. Coupé au bord d'un caractère
 *  multi-octets, le fichier devient illisible pour certains parsers : on recule donc
 *  jusqu'à une frontière de caractère. */
export function plier(ligne: string): string {
  const sortie: string[] = [];
  let reste = ligne;
  while (Buffer.byteLength(reste, "utf8") > 73 || reste.length > 73) {
    let coupe = Math.min(reste.length, 73);
    while (coupe > 1 && Buffer.byteLength(reste.slice(0, coupe), "utf8") > 73) coupe--;
    sortie.push(reste.slice(0, coupe));
    reste = " " + reste.slice(coupe);
  }
  sortie.push(reste);
  return sortie.join("\r\n");
}

function horodatage(d: Date, heure: string): string {
  const [h, m] = heure.split(":");
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}T${h!.padStart(2, "0")}${m!.padStart(2, "0")}00`;
}

function jourLocal(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

function enUtc(d: Date): string {
  return `${jourLocal(d)}T${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}00Z`;
}

export type EntreeIcs = { ligne: string[] };

/** Le corps d'un VEVENT, en fonctions des lignes brutes — renvoyer des lignes permet de
 *  les tester une par une sans re-plier tout le fichier. */
function evenement(lignes: string[]): string[] {
  // Rien n'est assemblé ici : les lignes restent plates et le pliage se fait UNE fois,
  // sur tout le fichier, à la fin (voir `construireIcs`).
  return lignes;
}

export function construireIcs(
  donnees: { cours: Cours[]; devoirs: Devoir[]; evenements: Evenement[] },
  opts: { maintenant?: Date; nom?: string; horizon?: number; stamp?: string | Date } = {}
): string {
  const maintenant = opts.maintenant ?? new Date();
  const horizon = opts.horizon ?? HORIZON_JOURS;
  // L'horizon est arrondi au JOUR UTC suivant : un client qui rappelle trois fois dans
  // l'heure doit recevoir l'OCTET PRÈS le même fichier. Avec une limite à la seconde,
  // chaque relecture changeait `UNTIL`, donc le corps, donc forçait tous les calendriers
  // à traiter le fichier comme modifié — le contraire de ce qu'on veut d'un flux.
  const jour = new Date(maintenant.getTime() + horizon * 86400000);
  const fin = new Date(Date.UTC(jour.getUTCFullYear(), jour.getUTCMonth(), jour.getUTCDate() + 1));
  // `stamp` = l'instant de la DERNIÈRE écriture de l'élève, pas l'heure de la lecture :
  // DTSTAMP est ce que les clients comparent pour savoir s'il faut tout recalculer.
  const stamp = enUtc(opts.stamp ? new Date(opts.stamp) : maintenant);
  const lignes: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Moncef IA//Agenda eleve//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${echapper(opts.nom ? `Moncef IA — ${opts.nom}` : "Moncef IA")}`,
    `X-WR-TIMEZONE:${FUSEAU}`,
    "X-WR-CALDESC:" + echapper("Cours, devoirs à rendre et évenements. Recharge automatiquement : la liste est recalculee a chaque lecture."),
    // Rythme de relecture demandé aux clients (Apple et Thunderbird l'honorent ; Google
    // l'ignore et pollifie à son propre rythme, on ne peut pas faire mieux). Douze heures
    // : un emploi du temps ne bouge pas plus vite, et une URL gating un secret ne doit pas
    // être rappelée vingt fois par jour.
    "X-PUBLISHED-TTL:PT12H",
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "BEGIN:VTIMEZONE",
    `TZID:${FUSEAU}`,
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    `TZOFFSETFROM:${DECALAGE_FUSEAU}`,
    `TZOFFSETTO:${DECALAGE_FUSEAU}`,
    "TZNAME:+01",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];

  for (const c of donnees.cours) {
    const creneau = analyserCreneau(c.time_slot);
    const idx = Number.isFinite(Number(c.day_index)) ? Number(c.day_index) : 0;
    const jour = JOURS_ICS[((idx % 7) + 7) % 7]!;
    const semaine = String(c.week ?? "").trim().toUpperCase();
    const de = ancrerJour(idx, semaine === "B" || semaine === "A" ? semaine : null, maintenant);
    const uid = `moncef-cours-${c.id}@proappmoncef`;
    const rrule = `RRULE:FREQ=WEEKLY;INTERVAL=${semaine === "A" || semaine === "B" ? 2 : 1};BYDAY=${jour};UNTIL=${enUtc(fin)}`;
    if (creneau) {
      lignes.push(
        ...evenement([
          "BEGIN:VEVENT",
          `UID:${uid}`,
          `DTSTAMP:${stamp}`,
          `DTSTART;TZID=${FUSEAU}:${horodatage(de, creneau.debut)}`,
          `DTEND;TZID=${FUSEAU}:${horodatage(de, creneau.fin)}`,
          rrule,
          `SUMMARY:${echapper(c.subj || "Cours")}`,
          `DESCRIPTION:${echapper(
            `${JOURS_SEMAINE[((idx % 7) + 7) % 7]} · ${c.time_slot}${semaine === "A" || semaine === "B" ? ` · semaine ${semaine}` : " · toutes les semaines"}${creneau.presume ? " · duree d'une heure par defaut (le creneau ne donne qu'une heure de debut)" : ""}`
          )}`,
          "CATEGORIES:OURS",
          "TRANSP:OPAQUE",
          "SEQUENCE:0",
          "END:VEVENT",
        ])
      );
    } else {
      // Créneau illisible : l'événement est posé à la journée, et le texte le dit. Une
      // heure inventée dans un calendrier est pire qu'une absence signalée.
      lignes.push(
        ...evenement([
          "BEGIN:VEVENT",
          `UID:${uid}`,
          `DTSTAMP:${stamp}`,
          `DTSTART;VALUE=DATE:${jourLocal(de)}`,
          `DTEND;VALUE=DATE:${jourLocal(new Date(de.getTime() + 86400000))}`,
          rrule,
          `SUMMARY:${echapper((c.subj || "Cours") + " (horaire a verifier)")}`,
          `DESCRIPTION:${echapper(`Le creneau stocke est « ${c.time_slot ?? "vide"} » : ni heure de debut ni plage exploitables. Corrige-le dans l'emploi du temps.`)}`,
          "CATEGORIES:OURS",
          "TRANSP:TRANSPARENT",
          "SEQUENCE:0",
          "END:VEVENT",
        ])
      );
    }
  }

  for (const h of donnees.devoirs) {
    if (!h.due_date) continue;
    const d = new Date(h.due_date + "T00:00:00Z");
    if (Number.isNaN(d.getTime())) continue;
    lignes.push(
      ...evenement([
        "BEGIN:VEVENT",
        `UID:moncef-devoir-${h.id}@proappmoncef`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${jourLocal(d)}`,
        `DTEND;VALUE=DATE:${jourLocal(new Date(d.getTime() + 86400000))}`,
        `SUMMARY:${echapper(`à rendre : ${h.subject ?? "devoir"}`)}`,
        `DESCRIPTION:${echapper(h.task ?? "")}`,
        `CATEGORIES:DEVOIR${h.priority ? `,${String(h.priority).toUpperCase()}` : ""}`,
        "STATUS:CONFIRMED",
        "TRANSP:TRANSPARENT",
        "SEQUENCE:0",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${echapper(`Devoir « ${h.subject ?? ""} » a rendre demain`)}`,
        "TRIGGER:-P1D",
        "END:VALARM",
        "END:VEVENT",
      ])
    );
  }

  for (const e of donnees.evenements) {
    if (!e.event_date) continue;
    const d = new Date(e.event_date + "T00:00:00Z");
    if (Number.isNaN(d.getTime())) continue;
    const heure = /^(\d{1,2}):(\d{2})/.exec(String(e.event_time ?? ""));
    const commun = [
      "BEGIN:VEVENT",
      `UID:moncef-evenement-${e.id}@proappmoncef`,
      `DTSTAMP:${stamp}`,
      `SUMMARY:${echapper(e.title || "Événement")}`,
      `DESCRIPTION:${echapper(e.description ?? "")}`,
      `CATEGORIES:${echapper((e.category || "EVENEMENT").toUpperCase())}`,
      "SEQUENCE:0",
    ];
    if (heure) {
      const debut = `${heure[1]!.padStart(2, "0")}:${heure[2]!}`;
      commun.push(`DTSTART;TZID=${FUSEAU}:${horodatage(d, debut)}`, `DTEND;TZID=${FUSEAU}:${horodatage(d, ajouterMinutes(debut, 60))}`);
    } else {
      commun.push(`DTSTART;VALUE=DATE:${jourLocal(d)}`, `DTEND;VALUE=DATE:${jourLocal(new Date(d.getTime() + 86400000))}`);
    }
    lignes.push(...evenement([...commun, "END:VEVENT"]));
  }

  lignes.push("END:VCALENDAR");
  // Plié ICI et pas ligne par ligne à la fabrique : les en-têtes (`X-WR-CALDESC`) sont
  // aussi capables de dépasser 75 octets, et un en-tête non plié est rejeté par
  // certains parsers — la limite du format ne fait pas de excepción pour le nom du
  // calendrier.
  return deplier_lignes(lignes) + "\r\n";
}

/** Un jeton d'URL n'est pas un secret de session : 32 hex, jamais dérivé d'un champ
 *  lisible, et comparé en temps constant côté route. */
export function jetonValide(jeton: unknown): jeton is string {
  return typeof jeton === "string" && /^[0-9a-f]{32}$/.test(jeton);
}

export function urlAgenda(uid: string, jeton: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "https://proappmoncef.netlify.app";
  return `${base}/api/agenda/${jeton}.ics`;
}

/** Ce que l'élève doit voir à côté du lien : ce que le calendrier saura, et ce qu'il ne
 *  saura pas (rien n'est poussé vers Google, c'est Google qui relit le lien). */
export function resuméAgenda(comptes: { cours: number; devoirs: number; evenements: number }): string {
  const morceaux = [comptes.cours ? `${comptes.cours} cours` : "", comptes.devoirs ? `${comptes.devoirs} échéances` : "", comptes.evenements ? `${comptes.evenements} événements` : ""].filter(Boolean);
  return morceaux.length ? `Ce lien contient ${morceaux.join(", ")} sur ${HORIZON_JOURS} jours.` : "Ce lien est vide pour l'instant : ajoute un cours ou un devoir.";
}

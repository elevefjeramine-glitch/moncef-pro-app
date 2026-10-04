"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from "framer-motion";
import {
  ArrowRight, Brain, Check, CheckCircle2, Crown, Flame,
  Layers, Loader2, ShieldCheck, User, Zap,
} from "lucide-react";
import { supabase } from "@/utils/supabase/client";
import { useUserStore } from "@/store/useUserStore";
import AvatarUpload from "@/components/AvatarUpload";
import ProfilTilt from "@/components/ProfilTilt";

const MotionLink = motion(Link);

/* Orbe flottant : la parallaxe (x/y framer-motion) vit sur le wrapper,
   le flottement CSS (keyframes) sur le span interne — aucun conflit. */
function Orb({
  cls, size, color, pos, depth, sx, sy,
}: {
  cls: string;
  size: number;
  color: string;
  pos: { top?: number; left?: number; right?: number; bottom?: number };
  depth: number;
  sx: MotionValue<number>;
  sy: MotionValue<number>;
}) {
  const x = useTransform(sx, (v) => v * depth);
  const y = useTransform(sy, (v) => v * depth);
  return (
    <motion.div
      className={`profil-orb ${cls}`}
      style={{ width: size, height: size, ...pos, x, y }}
    >
      <span style={{ background: color }} />
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Données : 100% réelles depuis Supabase. Zéro valeur inventée.       */
/* ------------------------------------------------------------------ */

type Stats = {
  devoirsSemaine: number;
  quizThunder: number;
  cartesRevision: number;
  streak: number;
};

const INITIAL_STATS: Stats = { devoirsSemaine: 0, quizThunder: 0, cartesRevision: 0, streak: 0 };

type RoleId = "normal" | "moderator" | "founder";

const ROLES: Record<RoleId, { label: string; icon: any; color: string; privileges: string[] }> = {
  normal: {
    label: "Membre",
    icon: User,
    color: "#8b9bb4",
    privileges: ["Assistant Moncef IA", "Quiz et révisions Thunder IA", "Devoirs et emploi du temps"],
  },
  moderator: {
    label: "Modérateur",
    icon: ShieldCheck,
    color: "#a78bfa",
    privileges: ["Panneau d'administration ALPHA", "Crédits IA illimités", "Modération de la communauté"],
  },
  founder: {
    label: "Fondateur",
    icon: Crown,
    color: "#FFD700",
    privileges: ["Panneau d'administration ALPHA", "Crédits IA illimités", "Gestion des rôles et utilisateurs"],
  },
};

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Streak = jours consécutifs avec une activité réelle (devoir ou quiz Thunder).
// Calculé depuis les dates existantes en base — jamais inventé.
function computeStreak(dates: string[]): number {
  const uniq = Array.from(new Set(dates)).sort().reverse();
  if (uniq.length === 0) return 0;
  const today = dayKey(new Date());
  const yesterday = dayKey(new Date(Date.now() - 86400000));
  const cursor = uniq[0] === today ? today : uniq[0] === yesterday ? yesterday : null;
  if (!cursor) return 0;
  let streak = 0;
  let expected = new Date(cursor + "T12:00:00Z");
  for (const d of uniq) {
    if (d === dayKey(expected)) {
      streak += 1;
      expected = new Date(expected.getTime() - 86400000);
    } else if (d < dayKey(expected)) {
      break;
    }
  }
  return streak;
}

// Couleur d'accent déterministe dérivée du nom (stable d'une visite à l'autre).
function accentFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  const hue = 210 + (h % 70); // bleu → violet, dans la charte
  return `linear-gradient(135deg, hsl(${hue}, 70%, 55%), hsl(${(hue + 40) % 360}, 70%, 50%))`;
}

function formatDue(due: string | null): string | null {
  if (!due) return null;
  const d = new Date(due + "T12:00:00");
  if (isNaN(d.getTime())) return due;
  return d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

/* ------------------------------------------------------------------ */

type NextAction =
  | { kind: "devoirs"; count: number; nearest: string | null; nearestDate: string | null }
  | { kind: "quiz" }
  | { kind: "streak" }
  | { kind: "ok"; streak: number };

export default function ProfilPage() {
  const { user, credits, setUser } = useUserStore();
  const [stats, setStats] = useState<Stats>(INITIAL_STATS);
  const [nextAction, setNextAction] = useState<NextAction | null>(null);
  const [loading, setLoading] = useState(true);
  const reduceMotion = useReducedMotion();

  const firstName = user?.first_name || "Élève";
  const lastName = user?.last_name || "";
  const fullName = `${firstName} ${lastName}`.trim();
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "?";
  const roleId = (["normal", "moderator", "founder"].includes(user?.role) ? user.role : "normal") as RoleId;
  const role = ROLES[roleId];
  const RoleIcon = role.icon;
  const createdAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : null;
  // Fondateurs et modérateurs = crédits illimités (même logique que l'API Thunder).
  const creditsLabel = ["founder", "moderator"].includes(roleId) ? "Illimité" : String(credits);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [hw, quiz, cartes] = await Promise.all([
          supabase.from("homework").select("id,status,created_at,due_date,subject"),
          supabase.from("thunder_quiz_attempts").select("id,created_at"),
          supabase.from("review_cards").select("id"),
        ]);
        if (cancelled) return;
        const homeworks: any[] = hw.data ?? [];
        const attempts: any[] = quiz.data ?? [];
        const weekAgo = Date.now() - 7 * 86400000;

        const devoirsSemaine = homeworks.filter(
          (h) => h.status === "done" && new Date(h.created_at).getTime() >= weekAgo
        ).length;
        const quizThunder = attempts.length;
        const cartesRevision = (cartes.data ?? []).length;
        const streak = computeStreak([
          ...homeworks.map((h) => dayKey(new Date(h.created_at))),
          ...attempts.map((a) => dayKey(new Date(a.created_at))),
        ]);
        setStats({ devoirsSemaine, quizThunder, cartesRevision, streak });

        // ——— Carte "prochaine action" : une seule, la plus pertinente ———
        const upcoming = homeworks
          .filter((h) => h.status !== "done")
          .sort((a, b) => {
            if (!a.due_date) return 1;
            if (!b.due_date) return -1;
            return a.due_date < b.due_date ? -1 : 1;
          });
        if (upcoming.length > 0) {
          const n = upcoming[0];
          setNextAction({
            kind: "devoirs",
            count: upcoming.length,
            nearest: n.subject || "Devoir",
            nearestDate: formatDue(n.due_date ?? null),
          });
        } else if (quizThunder === 0) {
          setNextAction({ kind: "quiz" });
        } else if (streak === 0) {
          setNextAction({ kind: "streak" });
        } else {
          setNextAction({ kind: "ok", streak });
        }
      } catch (e) {
        console.error("Profil : chargement impossible", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const anim = reduceMotion ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

  /* ——— Parallaxe des orbes : la souris déplace le fond en douceur ———
     Valeurs normalisées [-0.5, 0.5], lissées par springs. Chaque orbe a
     sa propre profondeur. Inactif si reduceMotion (reste à 0). */
  const ppx = useMotionValue(0);
  const ppy = useMotionValue(0);
  const sppx = useSpring(ppx, { stiffness: 55, damping: 18 });
  const sppy = useSpring(ppy, { stiffness: 55, damping: 18 });

  const orbs = [
    { cls: "orb-1", size: 380, color: "rgba(167,139,250,0.20)", pos: { top: -70, left: -110 }, depth: 30 },
    { cls: "orb-2", size: 320, color: "rgba(89,130,255,0.18)", pos: { top: -40, right: -100 }, depth: 48 },
    { cls: "orb-3", size: 300, color: "rgba(255,215,0,0.12)", pos: { bottom: 60, right: -80 }, depth: 24 },
    { cls: "orb-4", size: 260, color: "rgba(0,210,182,0.11)", pos: { bottom: 200, left: -70 }, depth: 40 },
  ];

  const onPageMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    ppx.set((e.clientX - r.left) / r.width - 0.5);
    ppy.set((e.clientY - r.top) / r.height - 0.5);
  };

  const ctaMotion = reduceMotion
    ? {}
    : {
        whileHover: { scale: 1.05, boxShadow: "0 8px 28px rgba(89,130,255,0.45)" },
        whileTap: { scale: 0.96 },
        transition: { type: "spring" as const, stiffness: 400, damping: 22 },
      };

  const statCards = [
    {
      icon: CheckCircle2, color: "#2ed573", label: "Devoirs terminés",
      sub: "cette semaine", value: stats.devoirsSemaine,
      emptyCta: stats.devoirsSemaine === 0 ? { label: "Ajouter un devoir", href: "/app/ai" } : null,
    },
    {
      icon: Brain, color: "#a78bfa", label: "Quiz Thunder",
      sub: "au total", value: stats.quizThunder,
      emptyCta: stats.quizThunder === 0 ? { label: "Faire mon premier quiz", href: "/app/thunder" } : null,
    },
    {
      icon: Layers, color: "#ffb020", label: "Cartes révisées",
      sub: "au total", value: stats.cartesRevision,
      emptyCta: stats.cartesRevision === 0 ? { label: "Créer des cartes", href: "/app/thunder" } : null,
    },
    {
      icon: Flame, color: "#ff7828", label: "Série",
      sub: stats.streak > 1 ? "jours d'affilée" : "jour d'affilée", value: stats.streak,
      emptyCta: stats.streak === 0 ? { label: "Commencer aujourd'hui", href: "/app/ai" } : null,
    },
  ];

  const nextActionCard = (() => {
    if (!nextAction) return null;
    switch (nextAction.kind) {
      case "devoirs":
        return {
          title: `${nextAction.count} devoir${nextAction.count > 1 ? "s" : ""} en cours`,
          text: nextAction.nearestDate
            ? `Le plus proche : ${nextAction.nearest} — ${nextAction.nearestDate}`
            : `Le plus proche : ${nextAction.nearest}`,
          cta: "Voir mes devoirs", href: "/app",
        };
      case "quiz":
        return {
          title: "Bienvenue sur Moncef IA",
          text: "Lance ton premier quiz Thunder pour démarrer ta progression.",
          cta: "Découvrir Thunder", href: "/app/thunder",
        };
      case "streak":
        return {
          title: "Lance ta série",
          text: "Fais une activité aujourd'hui — devoir ou quiz — pour allumer la flamme.",
          cta: "Discuter avec Moncef", href: "/app/ai",
        };
      case "ok":
        return {
          title: `${nextAction.streak} jour${nextAction.streak > 1 ? "s" : ""} d'affilée`,
          text: "Belle régularité — continue comme ça.",
          cta: "Voir mes devoirs", href: "/app",
        };
    }
  })();

  return (
    <motion.div
      {...anim}
      onMouseMove={onPageMove}
      className="profil-fx"
      style={{ maxWidth: 900, margin: "0 auto", position: "relative" }}
    >
      {/* ——— Fond flottant "fondant" : orbes + parallaxe curseur ——— */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", inset: 0, zIndex: 0,
          pointerEvents: "none", overflow: "clip",
        }}
      >
        {orbs.map((o) => (
          <Orb
            key={o.cls}
            cls={o.cls}
            size={o.size}
            color={o.color}
            pos={o.pos}
            depth={o.depth}
            sx={sppx}
            sy={sppy}
          />
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ——— HERO identité ——— */}
      <ProfilTilt
        className="card"
        maxTilt={5}
        glowColor="rgba(89,130,255,0.16)"
        style={{ padding: 28, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}
      >
        <div style={{ position: "relative", width: 96, height: 96, flexShrink: 0 }}>
          {!reduceMotion && (
            <motion.span
              aria-hidden="true"
              className="profil-halo"
              animate={{ scale: [1, 1.14, 1], opacity: [0.55, 0.12, 0.55] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        {user?.id ? (
          <AvatarUpload
            userId={user.id}
            currentUrl={user.avatar_url ?? null}
            initials={initials}
            accent={accentFor(fullName)}
            onSaved={(url) => setUser({ ...user, avatar_url: url })}
          />
        ) : (
          <div
            aria-hidden="true"
            style={{
              width: 96, height: 96, borderRadius: "50%",
              background: accentFor(fullName),
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 34, fontWeight: 800, color: "#fff",
              boxShadow: "0 8px 24px rgba(89,130,255,0.35)",
            }}
          >
            {initials}
          </div>
        )}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#fff" }}>{fullName}</h1>
          <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.55)", fontSize: 14 }}>
            {user?.email ?? ""}
            {createdAt ? ` · Compte créé en ${createdAt}` : ""}
          </p>
          <div
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10,
              padding: "6px 14px", borderRadius: 99, fontSize: 13, fontWeight: 700,
              background: `${role.color}1a`, border: `1px solid ${role.color}40`, color: role.color,
            }}
            title={
              roleId === "founder"
                ? "Statut attribué par l'équipe : accès complet à la plateforme"
                : roleId === "moderator"
                  ? "Statut attribué par l'équipe : aide à modérer la plateforme"
                  : "Statut de ton compte"
            }
          >
            <RoleIcon size={14} />
            {role.label}
          </div>
        </div>
        {/* Flamme visible uniquement quand la série a démarré */}
        {!loading && stats.streak >= 1 && (
          <div
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "12px 20px",
              borderRadius: 16, background: "rgba(255,120,40,0.08)",
              border: "1px solid rgba(255,120,40,0.2)",
            }}
            title="Jours consécutifs avec au moins une activité (devoir ou quiz)"
          >
            <Flame size={28} color="#ff7828" />
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{stats.streak}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                jour{stats.streak > 1 ? "s" : ""} d'affilée
              </div>
            </div>
          </div>
        )}
      </ProfilTilt>

      {/* ——— Prochaine action (1 seule, contextuelle) ——— */}
      {loading ? (
        <div className="card" style={{ height: 92, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <motion.span animate={reduceMotion ? {} : { rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} style={{ display: "inline-flex" }}>
            <Loader2 size={20} color="rgba(255,255,255,0.3)" />
          </motion.span>
        </div>
      ) : nextActionCard && (
        <ProfilTilt
          className="card"
          maxTilt={6}
          glowColor="rgba(89,130,255,0.18)"
          style={{
            padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
            border: "1px solid rgba(89,130,255,0.25)", background: "rgba(89,130,255,0.05)",
          }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{nextActionCard.title}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{nextActionCard.text}</div>
          </div>
          <MotionLink href={nextActionCard.href} className="btn"
            {...ctaMotion}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            {nextActionCard.cta} <ArrowRight size={15} />
          </MotionLink>
        </ProfilTilt>
      )}

      {/* ——— Ton activité : grille 2x2 ——— */}
      <section>
        <h2 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 800, color: "#fff" }}>Ton activité</h2>
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="card" style={{ height: 118, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <motion.span animate={reduceMotion ? {} : { rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} style={{ display: "inline-flex" }}>
                  <Loader2 size={20} color="rgba(255,255,255,0.3)" />
                </motion.span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {statCards.map((s) => {
              const Icon = s.icon;
              return (
                <ProfilTilt
                  key={s.label}
                  className="card"
                  maxTilt={8}
                  glowColor={`${s.color}26`}
                  style={{ padding: 20 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{
                      width: 36, height: 36, borderRadius: 12, display: "inline-flex",
                      alignItems: "center", justifyContent: "center",
                      background: `${s.color}1a`, border: `1px solid ${s.color}30`,
                    }}>
                      <Icon size={18} color={s.color} />
                    </span>
                    <div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{s.value}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{s.sub}</div>
                  {s.emptyCta && (
                    <Link href={s.emptyCta.href} className="cta-arrow"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10,
                        fontSize: 13, fontWeight: 700, color: "#5982ff", textDecoration: "none",
                      }}>
                      {s.emptyCta.label} <ArrowRight size={14} />
                    </Link>
                  )}
                </ProfilTilt>
              );
            })}
          </div>
        )}
      </section>

      {/* ——— Mon statut : attribué, pas une progression ——— */}
      <ProfilTilt className="card" maxTilt={5} glowColor="rgba(255,215,0,0.10)" style={{ padding: 24 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 800, color: "#fff" }}>Mon statut</h2>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
          Attribué par l'équipe Moncef IA — ce n'est pas un niveau à débloquer.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <span style={{
            width: 48, height: 48, borderRadius: 14, display: "inline-flex",
            alignItems: "center", justifyContent: "center",
            background: `${role.color}1a`, border: `1px solid ${role.color}40`, color: role.color,
          }}>
            <RoleIcon size={22} />
          </span>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{role.label}</span>
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          {role.privileges.map((p) => (
            <li key={p} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "rgba(255,255,255,0.75)" }}>
              <Check size={15} color="#2ed573" style={{ flexShrink: 0 }} /> {p}
            </li>
          ))}
        </ul>
      </ProfilTilt>

      {/* ——— Mes crédits : ressource, pas activité ——— */}
      <ProfilTilt
        className="card"
        maxTilt={5}
        glowColor="rgba(255,215,0,0.14)"
        style={{
          padding: 24, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
          border: "1px solid rgba(255,215,0,0.2)", background: "rgba(255,215,0,0.04)",
        }}
      >
        <span style={{
          width: 48, height: 48, borderRadius: 14, display: "inline-flex",
          alignItems: "center", justifyContent: "center",
          background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)",
        }}>
          <Zap size={22} color="#FFD700" />
        </span>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>Mes crédits</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>
            {loading ? "…" : creditsLabel}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
            {["founder", "moderator"].includes(roleId)
              ? `En tant que ${role.label.toLowerCase()}, tes crédits IA sont illimités.`
              : "Solde disponible pour les réponses de Moncef IA."}
          </div>
        </div>
      </ProfilTilt>
      </div>
    </motion.div>
  );
}

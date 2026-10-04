"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  User, Crown, ShieldCheck, Flame, CheckCircle2, Zap,
  BookOpen, Brain, Layers, CalendarDays, Loader2,
} from "lucide-react";
import { supabase } from "@/utils/supabase/client";
import { useUserStore } from "@/store/useUserStore";

type Stats = {
  devoirsTotal: number;
  devoirsTermines: number;
  devoirsSemaine: number;
  quizThunder: number;
  sourcesThunder: number;
  cartesRevision: number;
  streak: number;
};

const INITIAL_STATS: Stats = {
  devoirsTotal: 0,
  devoirsTermines: 0,
  devoirsSemaine: 0,
  quizThunder: 0,
  sourcesThunder: 0,
  cartesRevision: 0,
  streak: 0,
};

// Les grades Moncef IA sont des rôles attribués par l'équipe — pas un système
// d'XP. La "progression" affichée est donc honnête : ta position sur l'échelle.
const ROLES = [
  { id: "normal", label: "Membre", icon: User, color: "#8b9bb4" },
  { id: "moderator", label: "Modérateur", icon: ShieldCheck, color: "#a78bfa" },
  { id: "founder", label: "Fondateur", icon: Crown, color: "#FFD700" },
] as const;

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
  let cursor = uniq[0] === today ? today : uniq[0] === yesterday ? yesterday : null;
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

export default function ProfilPage() {
  const { user, credits } = useUserStore();
  const [stats, setStats] = useState<Stats>(INITIAL_STATS);
  const [loading, setLoading] = useState(true);

  const firstName = user?.first_name || "Élève";
  const lastName = user?.last_name || "";
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "?";
  const roleId = user?.role ?? "normal";
  const roleIndex = Math.max(0, ROLES.findIndex((r) => r.id === roleId));
  const RoleIcon = ROLES[roleIndex]?.icon ?? User;
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : null;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [hw, quiz, sources, cartes] = await Promise.all([
          supabase.from("homework").select("id,status,created_at"),
          supabase.from("thunder_quiz_attempts").select("id,created_at"),
          supabase.from("thunder_sources").select("id"),
          supabase.from("review_cards").select("id"),
        ]);
        if (cancelled) return;
        const homeworks: any[] = hw.data ?? [];
        const attempts: any[] = quiz.data ?? [];
        const weekAgo = Date.now() - 7 * 86400000;
        const activityDates: string[] = [
          ...homeworks.map((h) => dayKey(new Date(h.created_at))),
          ...attempts.map((a) => dayKey(new Date(a.created_at))),
        ];
        setStats({
          devoirsTotal: homeworks.length,
          devoirsTermines: homeworks.filter((h) => h.status === "done").length,
          devoirsSemaine: homeworks.filter(
            (h) => h.status === "done" && new Date(h.created_at).getTime() >= weekAgo
          ).length,
          quizThunder: attempts.length,
          sourcesThunder: (sources.data ?? []).length,
          cartesRevision: (cartes.data ?? []).length,
          streak: computeStreak(activityDates),
        });
      } catch (e) {
        console.error("Profil : chargement des stats impossible", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const statCards = [
    { icon: CheckCircle2, label: "Devoirs terminés", value: stats.devoirsTermines, color: "#2ed573" },
    { icon: CalendarDays, label: "Terminés (7 j)", value: stats.devoirsSemaine, color: "#5982ff" },
    { icon: Brain, label: "Quiz Thunder", value: stats.quizThunder, color: "#a78bfa" },
    { icon: BookOpen, label: "Sources Thunder", value: stats.sourcesThunder, color: "#00d2b6" },
    { icon: Layers, label: "Cartes révision", value: stats.cartesRevision, color: "#ffb020" },
    // Fondateurs et modérateurs = crédits illimités (même logique que l'API Thunder)
    { icon: Zap, label: "Crédits", value: ["founder", "moderator"].includes(roleId) ? "Illimité" : credits, color: "#FFD700" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ maxWidth: 900, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}
    >
      {/* ——— Carte identité ——— */}
      <div className="card" style={{ padding: 28, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div
          aria-hidden="true"
          style={{
            width: 84, height: 84, borderRadius: 24, flexShrink: 0,
            background: "linear-gradient(135deg, #5982ff, #a855f7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 30, fontWeight: 800, color: "#fff",
            boxShadow: "0 8px 24px rgba(89,130,255,0.35)",
          }}
        >
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "#fff" }}>
            {firstName} {lastName}
          </h1>
          <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,0.55)", fontSize: 14 }}>
            {user?.email ?? ""}
            {memberSince ? ` · Membre depuis ${memberSince}` : ""}
          </p>
          <div
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10,
              padding: "6px 14px", borderRadius: 99, fontSize: 13, fontWeight: 700,
              background: `${ROLES[roleIndex]?.color ?? "#8b9bb4"}1a`,
              border: `1px solid ${ROLES[roleIndex]?.color ?? "#8b9bb4"}40`,
              color: ROLES[roleIndex]?.color ?? "#8b9bb4",
            }}
          >
            <RoleIcon size={14} />
            {ROLES[roleIndex]?.label ?? "Membre"}
          </div>
        </div>
        <div
          style={{
            display: "flex", alignItems: "center", gap: 10, padding: "12px 20px",
            borderRadius: 16, background: stats.streak > 0 ? "rgba(255,120,40,0.08)" : "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,120,40,0.2)",
          }}
          title="Jours consécutifs avec au moins une activité (devoir ou quiz)"
        >
          <Flame size={28} color={stats.streak > 0 ? "#ff7828" : "rgba(255,255,255,0.25)"} />
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1 }}>
              {loading ? "…" : stats.streak}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
              jour{stats.streak > 1 ? "s" : ""} d'affilée
            </div>
          </div>
        </div>
      </div>

      {/* ——— Échelle des grades ——— */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 800, color: "#fff" }}>
          Grades Moncef IA
        </h2>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
          Les grades sont attribués par l'équipe — voici où tu te situes.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          {ROLES.map((r, i) => {
            const reached = i <= roleIndex;
            const Icon = r.icon;
            return (
              <div key={r.id} style={{ flex: 1, display: "flex", alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 80 }}>
                  <div
                    style={{
                      width: 52, height: 52, borderRadius: 16,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: reached ? `${r.color}22` : "rgba(255,255,255,0.03)",
                      border: `2px solid ${reached ? r.color : "rgba(255,255,255,0.1)"}`,
                      color: reached ? r.color : "rgba(255,255,255,0.3)",
                    }}
                    aria-current={i === roleIndex ? "step" : undefined}
                  >
                    <Icon size={22} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: reached ? "#fff" : "rgba(255,255,255,0.4)" }}>
                    {r.label}
                  </span>
                </div>
                {i < ROLES.length - 1 && (
                  <div
                    style={{
                      flex: 1, height: 3, borderRadius: 3, margin: "0 4px 26px",
                      background: i < roleIndex ? ROLES[i + 1]?.color : "rgba(255,255,255,0.08)",
                    }}
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ——— Statistiques ——— */}
      <div>
        <h2 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 800, color: "#fff" }}>
          Ton activité
        </h2>
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="card" style={{ height: 96, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                  <Loader2 size={20} color="rgba(255,255,255,0.3)" />
                </motion.div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            {statCards.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="card" style={{ padding: 18 }}>
                  <Icon size={20} color={s.color} style={{ marginBottom: 10 }} />
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", lineHeight: 1 }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>
                    {s.label}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

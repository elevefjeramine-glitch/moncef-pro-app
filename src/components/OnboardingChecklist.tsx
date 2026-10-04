"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Sparkles, Zap, BookOpen, Bot, UserCircle } from "lucide-react";
import { supabase } from "@/utils/supabase/client";
import { useUserStore } from "@/store/useUserStore";

const STORAGE_KEY = "moncef_onboarding_v1";

type Step = {
  id: string;
  label: string;
  desc: string;
  href: string;
  icon: any;
  // auto = vérifié en base ; manual = coché par l'élève
  auto?: "homework" | "thunder";
};

const STEPS: Step[] = [
  {
    id: "devoir",
    label: "Ajoute ton premier devoir",
    desc: "Tes devoirs, échéances et priorités au même endroit.",
    href: "/app",
    icon: BookOpen,
    auto: "homework",
  },
  {
    id: "thunder",
    label: "Pose ta première question à Thunder",
    desc: "Thunder répond en citant tes cours.",
    href: "/app/thunder",
    icon: Zap,
    auto: "thunder",
  },
  {
    id: "assistant",
    label: "Discute avec l'assistant IA",
    desc: "Il gère devoirs, emploi du temps et événements.",
    href: "/app/ai",
    icon: Bot,
  },
  {
    id: "profil",
    label: "Découvre ton profil",
    desc: "Grade, série et statistiques d'activité.",
    href: "/app/profil",
    icon: UserCircle,
  },
];

type Stored = { done: string[]; dismissed: boolean };

function readStored(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        done: Array.isArray(parsed.done) ? parsed.done : [],
        dismissed: parsed.dismissed === true,
      };
    }
  } catch { /* stockage indisponible : on affiche la checklist */ }
  return { done: [], dismissed: false };
}

export default function OnboardingChecklist() {
  const { user } = useUserStore();
  const [done, setDone] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const stored = readStored();
      if (cancelled) return;
      setDismissed(stored.dismissed);
      let autoDone = [...stored.done];

      // Auto-validation depuis les données réelles (jamais de faux "terminé")
      try {
        const [hw, quiz, sources] = await Promise.all([
          supabase.from("homework").select("id", { count: "exact", head: true }),
          supabase.from("thunder_quiz_attempts").select("id", { count: "exact", head: true }),
          supabase.from("thunder_sources").select("id", { count: "exact", head: true }),
        ]);
        if (cancelled) return;
        if ((hw.count ?? 0) > 0 && !autoDone.includes("devoir")) autoDone.push("devoir");
        if (((quiz.count ?? 0) > 0 || (sources.count ?? 0) > 0) && !autoDone.includes("thunder")) {
          autoDone.push("thunder");
        }
      } catch { /* pas bloquant */ }

      if (cancelled) return;
      setDone(autoDone);
      setReady(true);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ done: autoDone, dismissed: stored.dismissed }));
      } catch { /* ignore */ }
    };
    init();
    return () => { cancelled = true; };
  }, []);

  const persist = (nextDone: string[], nextDismissed: boolean) => {
    setDone(nextDone);
    setDismissed(nextDismissed);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ done: nextDone, dismissed: nextDismissed }));
    } catch { /* ignore */ }
  };

  const toggle = (id: string) => {
    const next = done.includes(id) ? done.filter((d) => d !== id) : [...done, id];
    persist(next, dismissed);
  };

  if (!ready || dismissed || done.length >= STEPS.length || !user) return null;

  const pct = Math.round((done.length / STEPS.length) * 100);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="card"
        style={{ padding: 20, marginBottom: 20, position: "relative" }}
        aria-label="Prise en main"
      >
        <button
          onClick={() => persist(done, true)}
          aria-label="Masquer la prise en main"
          style={{
            position: "absolute", top: 12, right: 12, background: "none",
            border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: 4,
          }}
        >
          <X size={16} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Sparkles size={18} color="var(--a)" />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff" }}>
            Bienvenue sur Moncef IA — {done.length}/{STEPS.length}
          </h3>
        </div>

        <div style={{ height: 6, borderRadius: 6, background: "rgba(255,255,255,0.07)", margin: "10px 0 14px", overflow: "hidden" }}>
          <motion.div
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
            style={{ height: "100%", borderRadius: 6, background: "linear-gradient(90deg, #5982ff, #00d2b6)" }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {STEPS.map((s) => {
            const checked = done.includes(s.id);
            const Icon = s.icon;
            return (
              <div
                key={s.id}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 12px", borderRadius: 12,
                  background: checked ? "rgba(46,213,115,0.06)" : "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  opacity: checked ? 0.65 : 1,
                }}
              >
                <button
                  onClick={() => toggle(s.id)}
                  aria-pressed={checked}
                  aria-label={checked ? `Marquer « ${s.label} » comme à faire` : `Marquer « ${s.label} » comme fait`}
                  style={{
                    width: 26, height: 26, borderRadius: 8, flexShrink: 0, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: checked ? "#2ed573" : "rgba(255,255,255,0.05)",
                    border: checked ? "none" : "1px solid rgba(255,255,255,0.2)",
                    color: "#fff",
                  }}
                >
                  {checked && <Check size={15} />}
                </button>
                <Icon size={18} color={checked ? "#2ed573" : "var(--a)"} style={{ flexShrink: 0 }} />
                <Link
                  href={s.href}
                  style={{ flex: 1, textDecoration: "none" }}
                >
                  <span style={{ display: "block", color: "#fff", fontWeight: 600, fontSize: 14, textDecoration: checked ? "line-through" : "none" }}>
                    {s.label}
                  </span>
                  <span style={{ display: "block", color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
                    {s.desc}
                  </span>
                </Link>
              </div>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

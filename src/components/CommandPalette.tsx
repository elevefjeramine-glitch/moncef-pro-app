"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Home, Bot, Zap, CalendarDays, MessageSquare, UserCircle,
  Plus, MessageCircle, Search, CornerDownLeft,
} from "lucide-react";
import { useLanguage, t } from "@/utils/i18n";

type Action = {
  id: string;
  label: string;
  hint: string;
  keywords: string;
  icon: any;
  run: () => void;
};

// Recherche floue : sous-séquence insensible à la casse, avec score.
// "thdr" matche "Thunder", "msg" matche "Messages".
function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  if (!q) return 1;
  if (t.includes(q)) return 100 - t.indexOf(q);
  let qi = 0;
  let score = 0;
  let lastMatch = -1;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      score += lastMatch === i - 1 ? 3 : 1;
      lastMatch = i;
      qi++;
    }
  }
  return qi === q.length ? score : -1;
}

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lang = useLanguage();

  const actions: Action[] = useMemo(
    () => [
      { id: "home", label: t(lang, "home"), hint: t(lang, "palette_hint_devoirs_jour"), keywords: "accueil home dashboard devoirs", icon: Home, run: () => router.push("/app") },
      { id: "ai", label: t(lang, "palette_assistant_ia"), hint: t(lang, "palette_hint_discuter"), keywords: "assistant ia ai chat discuter moncef", icon: Bot, run: () => router.push("/app/ai") },
      { id: "thunder", label: t(lang, "thunder"), hint: t(lang, "palette_hint_revisions"), keywords: "thunder revisions qcm fiches quiz", icon: Zap, run: () => router.push("/app/thunder") },
      { id: "schedule", label: t(lang, "palette_emploi_temps"), hint: t(lang, "palette_hint_planning"), keywords: "emploi temps edt planning schedule cours", icon: CalendarDays, run: () => router.push("/app/schedule") },
      { id: "comm", label: t(lang, "palette_messages"), hint: t(lang, "palette_hint_discussions"), keywords: "messages discussions comm chat amis", icon: MessageSquare, run: () => router.push("/app/comm") },
      { id: "profil", label: t(lang, "palette_profil"), hint: t(lang, "palette_hint_grade_stats"), keywords: "profil profile grade stats compte", icon: UserCircle, run: () => router.push("/app/profil") },
      { id: "new-hw", label: t(lang, "palette_nouveau_devoir"), hint: t(lang, "home"), keywords: "nouveau devoir ajouter homework add", icon: Plus, run: () => router.push("/app") },
      { id: "new-chat", label: t(lang, "palette_nouveau_chat"), hint: t(lang, "palette_hint_assistant"), keywords: "nouveau chat ia discuter question", icon: MessageCircle, run: () => router.push("/app/ai") },
    ],
    [router, lang]
  );

  const results = useMemo(() => {
    const scored = actions
      .map((a) => ({ a, s: fuzzyScore(query, `${a.label} ${a.keywords}`) }))
      .filter((x) => x.s >= 0)
      .sort((x, y) => y.s - x.s);
    return scored.map((x) => x.a);
  }, [actions, query]);

  useEffect(() => {
    setIndex(0);
  }, [query, open]);

  // Ouverture globale : Ctrl+K / Cmd+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        setQuery("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(timer);
    }
  }, [open ]);

  // Garder l'élément sélectionné visible
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-idx="${index}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [index]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const action = results[index];
      if (action) {
        close();
        action.run();
      }
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={close}
          style={{
            position: "fixed", inset: 0, zIndex: 10000,
            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
            display: "flex", justifyContent: "center", alignItems: "flex-start",
            paddingTop: "12vh", paddingLeft: 16, paddingRight: 16,
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            role="dialog"
            aria-modal="true"
            aria-label={t(lang, "palette_dialogue_aria")}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onKeyDown}
            style={{
              width: "100%", maxWidth: 560, overflow: "hidden",
              background: "rgba(13,18,35,0.92)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 18,
              boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
              backdropFilter: "blur(20px)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <Search size={18} color="rgba(255,255,255,0.4)" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t(lang, "palette_placeholder")}
                aria-label={t(lang, "palette_recherche_aria")}
                style={{
                  flex: 1, background: "none", border: "none", outline: "none",
                  color: "#fff", fontSize: 16,
                }}
              />
              <kbd style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.06)", padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)" }}>
                {t(lang, "palette_echap")}
              </kbd>
            </div>
            <div ref={listRef} role="listbox" aria-label={t(lang, "palette_actions_aria")} style={{ maxHeight: 340, overflowY: "auto", padding: 8 }}>
              {results.length === 0 && (
                <div style={{ padding: "24px 16px", textAlign: "center", color: "rgba(255,255,255,0.45)", fontSize: 14 }}>
                  {t(lang, "palette_aucune_action")} « {query} »
                </div>
              )}
              {results.map((a, i) => {
                const Icon = a.icon;
                const selected = i === index;
                return (
                  <div
                    key={a.id}
                    data-idx={i}
                    role="option"
                    aria-selected={selected}
                    onClick={() => { close(); a.run(); }}
                    onMouseEnter={() => setIndex(i)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 12px", borderRadius: 12, cursor: "pointer",
                      background: selected ? "rgba(89,130,255,0.14)" : "transparent",
                      border: selected ? "1px solid rgba(89,130,255,0.25)" : "1px solid transparent",
                    }}
                  >
                    <span style={{
                      width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "rgba(255,255,255,0.05)", color: "var(--a)",
                    }}>
                      <Icon size={17} />
                    </span>
                    <span style={{ flex: 1 }}>
                      <span style={{ display: "block", color: "#fff", fontWeight: 600, fontSize: 14 }}>{a.label}</span>
                      <span style={{ display: "block", color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{a.hint}</span>
                    </span>
                    {selected && <CornerDownLeft size={15} color="rgba(255,255,255,0.4)" />}
                  </div>
                );
              })}
            </div>
            <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 16, fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
              <span><kbd style={{ padding: "1px 6px", borderRadius: 4, background: "rgba(255,255,255,0.06)" }}>↑↓</kbd> {t(lang, "palette_naviguer")}</span>
              <span><kbd style={{ padding: "1px 6px", borderRadius: 4, background: "rgba(255,255,255,0.06)" }}>↵</kbd> {t(lang, "palette_ouvrir")}</span>
              <span><kbd style={{ padding: "1px 6px", borderRadius: 4, background: "rgba(255,255,255,0.06)" }}>Ctrl K</kbd> {t(lang, "palette_partout")}</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

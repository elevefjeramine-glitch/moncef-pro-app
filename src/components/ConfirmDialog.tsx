"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode, KeyboardEvent as ReactKeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Bouton de confirmation rouge (actions destructrices) */
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm doit être utilisé à l'intérieur de <ConfirmProvider>");
  return ctx;
}

interface PendingRequest {
  opts: ConfirmOptions;
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => setPending({ opts, resolve }));
  }, []);

  const close = useCallback((value: boolean) => {
    setPending((p) => {
      p?.resolve(value);
      return null;
    });
  }, []);

  // Échap → annuler
  useEffect(() => {
    if (!pending) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pending, close]);

  // Focus initial sur le bouton d'annulation
  useEffect(() => {
    if (pending) {
      dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
  }, [pending]);

  // Focus trap basique : boucle Tab à l'intérieur de la modale
  const trapTab = (e: ReactKeyboardEvent) => {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusables = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button"));
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const { title, message, confirmLabel = "Confirmer", cancelLabel = "Annuler", danger = false } =
    pending?.opts ?? { title: "", message: "" };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {pending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="msg-modal-overlay"
            onClick={() => close(false)}
          >
            <motion.div
              ref={dialogRef}
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="msg-modal"
              style={{ maxWidth: 420 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-dialog-title"
              aria-describedby="confirm-dialog-desc"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={trapTab}
            >
              <div className="msg-modal-header">
                <h3
                  id="confirm-dialog-title"
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    color: "#fff",
                    margin: 0,
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      background: danger ? "rgba(255,69,69,0.12)" : "rgba(89,130,255,0.12)",
                      border: danger
                        ? "1px solid rgba(255,69,69,0.25)"
                        : "1px solid rgba(89,130,255,0.25)",
                      flexShrink: 0,
                    }}
                  >
                    <AlertTriangle size={18} color={danger ? "#FF5C5C" : "#5982FF"} />
                  </span>
                  {title}
                </h3>
                <button
                  onClick={() => close(false)}
                  aria-label="Fermer"
                  style={{
                    background: "none",
                    border: "none",
                    color: "rgba(255,255,255,0.4)",
                    cursor: "pointer",
                  }}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="msg-modal-body">
                <p
                  id="confirm-dialog-desc"
                  style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.6, margin: 0 }}
                >
                  {message}
                </p>
              </div>
              <div className="msg-modal-footer">
                <button
                  data-autofocus
                  onClick={() => close(false)}
                  className="btn-ghost"
                  style={{ padding: "10px 20px", borderRadius: 12 }}
                >
                  {cancelLabel}
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => close(true)}
                  className={danger ? undefined : "btn"}
                  style={
                    danger
                      ? {
                          padding: "10px 24px",
                          borderRadius: 12,
                          background: "rgba(255,69,69,0.15)",
                          border: "1px solid rgba(255,69,69,0.4)",
                          color: "#FF5C5C",
                          cursor: "pointer",
                          fontWeight: 700,
                          fontFamily: "DM Sans, sans-serif",
                          fontSize: 14,
                        }
                      : { padding: "10px 24px", borderRadius: 12 }
                  }
                >
                  {confirmLabel}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}

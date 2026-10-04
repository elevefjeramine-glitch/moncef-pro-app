"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  message: string;
  title?: string;
  type?: ToastType;
  action?: ToastAction;
  /** ms avant disparition auto (défaut : 4000, 8000 pour les erreurs) */
  duration?: number;
}

interface ToastItem {
  id: number;
  message: string;
  title?: string | undefined;
  type: ToastType;
  action?: ToastAction | undefined;
  duration: number;
}

interface ToastApi {
  toast: (opts: ToastOptions) => number;
  success: (message: string, opts?: Omit<ToastOptions, "message" | "type">) => number;
  error: (message: string, opts?: Omit<ToastOptions, "message" | "type">) => number;
  info: (message: string, opts?: Omit<ToastOptions, "message" | "type">) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast doit être utilisé à l'intérieur de <ToastProvider>");
  return ctx;
}

let nextId = 1;

const ICONS: Record<ToastType, { Icon: typeof Info; color: string }> = {
  success: { Icon: CheckCircle2, color: "#00D2B6" },
  error: { Icon: AlertCircle, color: "#FF5C5C" },
  info: { Icon: Info, color: "#5982FF" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (opts: ToastOptions): number => {
      const id = nextId++;
      const type = opts.type ?? "info";
      const duration = opts.duration ?? (type === "error" ? 8000 : 4000);
      setToasts((prev) => [
        ...prev.slice(-3),
        { id, message: opts.message, title: opts.title, type, action: opts.action, duration },
      ]);
      timers.current.set(id, setTimeout(() => dismiss(id), duration));
      return id;
    },
    [dismiss]
  );

  const api: ToastApi = {
    toast,
    success: (message, opts) => toast({ ...opts, message, type: "success" }),
    error: (message, opts) => toast({ ...opts, message, type: "error" }),
    info: (message, opts) => toast({ ...opts, message, type: "info" }),
    dismiss,
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-label="Notifications"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 10001,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          maxWidth: "min(380px, calc(100vw - 32px))",
          pointerEvents: "none",
        }}
      >
        <AnimatePresence>
          {toasts.map((t) => {
            const { Icon, color } = ICONS[t.type];
            const { action } = t;
            return (
              <motion.div
                key={t.id}
                role="status"
                aria-live="polite"
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 60, transition: { duration: 0.2 } }}
                layout
                style={{
                  pointerEvents: "auto",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  background: "rgba(12,16,32,0.92)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 14,
                  padding: "14px 16px",
                  boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
                  backdropFilter: "blur(20px) saturate(160%)",
                  fontFamily: "DM Sans, sans-serif",
                }}
              >
                <Icon size={20} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {t.title && (
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>
                      {t.title}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>
                    {t.message}
                  </div>
                  {action && (
                    <button
                      onClick={() => {
                        action.onClick();
                        dismiss(t.id);
                      }}
                      style={{
                        marginTop: 8,
                        background: "none",
                        border: "none",
                        color,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        padding: 0,
                        fontFamily: "DM Sans, sans-serif",
                      }}
                    >
                      {action.label}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="Fermer la notification"
                  style={{
                    background: "none",
                    border: "none",
                    color: "rgba(255,255,255,0.35)",
                    cursor: "pointer",
                    padding: 2,
                    flexShrink: 0,
                  }}
                >
                  <X size={16} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

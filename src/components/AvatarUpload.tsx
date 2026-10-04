"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ImagePlus, Loader2, Pencil, X, ZoomIn } from "lucide-react";
import { supabase } from "@/utils/supabase/client";

const CIRCLE = 240; // diamètre (px) du crop affiché à l'écran
const EXPORT = 256; // taille (px) de l'image exportée

type Props = {
  userId: string;
  currentUrl: string | null;
  initials: string;
  /** CSS background utilisé pour le fallback initiales */
  accent: string;
  onSaved: (url: string) => void;
};

/**
 * Avatar cliquable (96px) + modale d'upload avec crop circulaire.
 * Stockage : bucket Supabase Storage « avatars », chemin {userId}/avatar.jpg.
 * Si le bucket n'existe pas encore, l'erreur est expliquée à l'utilisateur.
 */
export default function AvatarUpload({ userId, currentUrl, initials, accent, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [imgNat, setImgNat] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [googleUrl, setGoogleUrl] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const close = () => {
    setOpen(false);
    setImgSrc(null);
    setImgNat(null);
    setZoom(1);
    setPos({ x: 0, y: 0 });
    setError("");
  };

  // Bonus : proposer la photo du compte Google si la session OAuth en a une.
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const pic =
          data?.user?.user_metadata?.avatar_url ||
          data?.user?.user_metadata?.picture ||
          null;
        if (pic && pic !== currentUrl) setGoogleUrl(String(pic));
      } catch {
        /* non bloquant */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ]);

  const clamp = (x: number, y: number, z: number, nat: { w: number; h: number }) => {
    const fit = Math.max(CIRCLE / nat.w, CIRCLE / nat.h);
    const scale = fit * z;
    const mx = Math.max(0, (nat.w * scale - CIRCLE) / 2);
    const my = Math.max(0, (nat.h * scale - CIRCLE) / 2);
    return {
      x: Math.min(mx, Math.max(-mx, x)),
      y: Math.min(my, Math.max(-my, y)),
    };
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
      setError("Format accepté : JPEG, PNG ou WebP.");
      return;
    }
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      const probe = new Image();
      probe.onload = () => {
        setImgNat({ w: probe.naturalWidth, h: probe.naturalHeight });
        setImgSrc(url);
        setZoom(1);
        setPos({ x: 0, y: 0 });
      };
      probe.src = url;
    };
    reader.readAsDataURL(f);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !imgNat) return;
    setPos(clamp(d.ox + (e.clientX - d.sx), d.oy + (e.clientY - d.sy), zoom, imgNat));
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const onZoom = (z: number) => {
    setZoom(z);
    if (imgNat) setPos((p) => clamp(p.x, p.y, z, imgNat));
  };

  const persistUrl = async (url: string) => {
    const { error: dbErr } = await supabase
      .from("users")
      .update({ avatar_url: url })
      .eq("id", userId);
    if (dbErr) throw dbErr;
    onSaved(url);
  };

  const saveCropped = async () => {
    if (!imgRef.current || !imgNat) return;
    setBusy(true);
    setError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = EXPORT;
      canvas.height = EXPORT;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponible dans ce navigateur.");
      const fit = Math.max(CIRCLE / imgNat.w, CIRCLE / imgNat.h);
      const scale = fit * zoom;
      const dw = imgNat.w * scale;
      const dh = imgNat.h * scale;
      // Zone visible du cercle, convertie en coordonnées de l'image d'origine.
      const sx = ((dw - CIRCLE) / 2 - pos.x) / scale;
      const sy = ((dh - CIRCLE) / 2 - pos.y) / scale;
      const s = CIRCLE / scale;
      ctx.beginPath();
      ctx.arc(EXPORT / 2, EXPORT / 2, EXPORT / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(imgRef.current, sx, sy, s, s, 0, 0, EXPORT, EXPORT);
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/jpeg", 0.92)
      );
      if (!blob) throw new Error("Export de l'image impossible.");
      const path = `${userId}/avatar.jpg`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await persistUrl(`${data.publicUrl}?t=${Date.now()}`);
      close();
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (/bucket|not found|does not exist|NoSuchBucket/i.test(msg)) {
        setError(
          "Stockage « avatars » introuvable : fais créer le bucket Supabase Storage « avatars » (public) puis réessaie."
        );
      } else {
        setError("Échec de l'enregistrement : " + msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const useGooglePhoto = async () => {
    if (!googleUrl) return;
    setGoogleBusy(true);
    setError("");
    try {
      await persistUrl(googleUrl);
      close();
    } catch (e: any) {
      setError("Échec de l'enregistrement : " + String(e?.message ?? e));
    } finally {
      setGoogleBusy(false);
    }
  };

  const fit = imgNat ? Math.max(CIRCLE / imgNat.w, CIRCLE / imgNat.h) : 1;
  const scale = fit * zoom;
  const dw = imgNat ? imgNat.w * scale : 0;
  const dh = imgNat ? imgNat.h * scale : 0;

  return (
    <>
      {/* ——— Avatar cliquable ——— */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Changer ma photo de profil"
        aria-label="Changer ma photo de profil"
        style={{
          position: "relative",
          width: 96,
          height: 96,
          borderRadius: "50%",
          flexShrink: 0,
          border: "none",
          padding: 0,
          cursor: "pointer",
          overflow: "visible",
          background: "transparent",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            overflow: "hidden",
            background: accent,
            boxShadow: "0 8px 24px rgba(89,130,255,0.35)",
            border: "2px solid rgba(255,255,255,0.15)",
          }}
        >
          {currentUrl ? (
            <img
              src={currentUrl}
              alt="Photo de profil"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span style={{ fontSize: 34, fontWeight: 800, color: "#fff" }}>{initials}</span>
          )}
        </span>
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            right: -2,
            bottom: -2,
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "#5982ff",
            border: "2px solid #0b0b12",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <Pencil size={14} />
        </span>
      </button>

      {/* ——— Modale upload + crop ——— */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              background: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
            onClick={close}
          >
            <motion.div
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 12 }}
              onClick={(e) => e.stopPropagation()}
              className="card"
              style={{ width: 380, maxWidth: "100%", padding: 24, position: "relative" }}
              role="dialog"
              aria-label="Changer ma photo de profil"
            >
              <button
                type="button"
                onClick={close}
                aria-label="Fermer"
                style={{
                  position: "absolute", top: 14, right: 14, background: "none",
                  border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
              <h3 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 800, color: "#fff" }}>
                Photo de profil
              </h3>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: "rgba(255,255,255,0.55)" }}>
                Formats acceptés : JPEG, PNG, WebP.
              </p>

              {!imgSrc ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button type="button" className="btn" onClick={() => fileRef.current?.click()}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <ImagePlus size={16} /> Choisir une image
                  </button>
                  {googleUrl && (
                    <button type="button" className="btn-ghost" onClick={useGooglePhoto} disabled={googleBusy}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      {googleBusy ? (
                        <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} style={{ display: "inline-flex" }}>
                          <Loader2 size={16} />
                        </motion.span>
                      ) : null}
                      Utiliser ma photo Google
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  {/* Zone de crop circulaire : glisser pour cadrer */}
                  <div
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    style={{
                      width: CIRCLE,
                      height: CIRCLE,
                      borderRadius: "50%",
                      overflow: "hidden",
                      position: "relative",
                      margin: "0 auto",
                      background: "#000",
                      cursor: "grab",
                      touchAction: "none",
                      border: "2px solid rgba(255,255,255,0.2)",
                    }}
                  >
                    <img
                      ref={imgRef}
                      src={imgSrc}
                      alt="Aperçu du recadrage"
                      draggable={false}
                      style={{
                        position: "absolute",
                        width: dw,
                        height: dh,
                        left: (CIRCLE - dw) / 2 + pos.x,
                        top: (CIRCLE - dh) / 2 + pos.y,
                        maxWidth: "none",
                        userSelect: "none",
                        pointerEvents: "none",
                      }}
                    />
                  </div>
                  <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.45)", margin: "10px 0 4px" }}>
                    Glisse pour cadrer
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 8px 16px" }}>
                    <ZoomIn size={16} color="rgba(255,255,255,0.5)" />
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.01}
                      value={zoom}
                      onChange={(e) => onZoom(Number(e.target.value))}
                      aria-label="Zoom"
                      style={{ flex: 1, accentColor: "#5982ff" }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="button" className="btn-ghost" onClick={() => { setImgSrc(null); setError(""); }}>
                      Changer d'image
                    </button>
                    <button type="button" className="btn" onClick={saveCropped} disabled={busy}
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      {busy ? (
                        <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} style={{ display: "inline-flex" }}>
                          <Loader2 size={16} />
                        </motion.span>
                      ) : <Check size={16} />}
                      Enregistrer
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <p style={{ margin: "14px 0 0", fontSize: 13, color: "#ff6b6b", lineHeight: 1.5 }}>
                  {error}
                </p>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: "none" }}
                onChange={(e) => {
                  onFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

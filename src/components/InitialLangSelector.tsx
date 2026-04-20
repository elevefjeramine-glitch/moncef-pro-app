"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Globe, ArrowRight } from "lucide-react";
import TiltCard from "./TiltCard";

const languages = [
  { code: 'fr', name: 'Français', flag: '🇫🇷', desc: 'Accéder en Français' },
  { code: 'en', name: 'English', flag: '🇬🇧', desc: 'Access in English' },
  { code: 'es', name: 'Español', flag: '🇪🇸', desc: 'Acceder en Español' },
  { code: 'ar', name: 'العربية', flag: '🇲🇦', desc: 'الدخول بالعربية' },
];

export default function InitialLangSelector({ onSelect }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: "blur(20px)" }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(5, 8, 18, 0.9)',
        backdropFilter: 'blur(40px) saturate(180%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
    >
      {/* Background Glows */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <motion.div
           animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
           transition={{ duration: 10, repeat: Infinity }}
           style={{
             position: 'absolute', top: '20%', left: '20%', width: '40vw', height: '40vw',
             background: 'radial-gradient(circle, var(--p) 0%, transparent 70%)', filter: 'blur(100px)'
           }}
        />
        <motion.div
           animate={{ scale: [1.2, 1, 1.2], opacity: [0.15, 0.3, 0.15] }}
           transition={{ duration: 12, repeat: Infinity }}
           style={{
             position: 'absolute', bottom: '20%', right: '20%', width: '35vw', height: '35vw',
             background: 'radial-gradient(circle, var(--a) 0%, transparent 70%)', filter: 'blur(80px)'
           }}
        />
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        style={{ textAlign: 'center', mb: 60, position: 'relative', zIndex: 10, marginBottom: '60px' }}
      >
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 12,
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
          padding: '8px 20px', borderRadius: 99, marginBottom: 24,
          fontSize: 13, fontWeight: 700, color: 'var(--a)', textTransform: 'uppercase', letterSpacing: '0.1em'
        }}>
          <Globe size={14} /> Welcome to Moncef IA
        </div>
        <h1 style={{
          fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 800, fontFamily: 'var(--font2)',
          letterSpacing: '-0.04em', lineHeight: 1.1, color: '#fff'
        }}>
          Choisissez votre <span style={{ color: 'var(--p)' }}>langue</span>
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: 16, fontSize: 18 }}>Select your preferred language to continue</p>
      </motion.div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 24,
        width: '100%',
        maxWidth: '1100px',
        position: 'relative',
        zIndex: 10
      }}>
        {languages.map((l, i) => (
          <motion.div
            key={l.code}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + (i * 0.1), duration: 0.8 }}
          >
            <TiltCard
              onClick={() => onSelect(l.code)}
              style={{
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '40px 32px',
                borderRadius: '28px',
                textAlign: 'center',
                transition: 'all 0.3s ease',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              className="lang-card-hover"
            >
              <div style={{ fontSize: 44, marginBottom: 24, filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))' }}>{l.flag}</div>
              <h3 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 8, fontFamily: 'var(--font2)' }}>{l.name}</h3>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 24 }}>{l.desc}</p>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--a)'
              }}>
                <ArrowRight size={18} />
              </div>
            </TiltCard>
          </motion.div>
        ))}
      </div>

      <style jsx>{`
        .lang-card-hover:hover {
          background: rgba(255,255,255,0.05) !important;
          border-color: var(--p) !important;
          transform: translateY(-8px) scale(1.02);
          box-shadow: 0 40px 80px rgba(0,0,0,0.6), inset 0 0 20px rgba(89,130,255,0.1) !important;
        }
      `}</style>
    </motion.div>
  );
}

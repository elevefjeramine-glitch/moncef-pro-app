"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export default function LanguageSwitcher({ currentLang, onSwitch }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const languages = [
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'ar', name: 'العربية', flag: '🇲🇦' },
  ];

  const current = languages.find(l => l.code === currentLang) || languages[0];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="language-switcher" ref={dropdownRef} style={{ position: 'relative', zIndex: 1100 }}>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#fff',
          padding: '8px 14px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          backdropFilter: 'blur(10px)',
          fontSize: '13px',
          fontWeight: '600',
          flexShrink: 0
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>{current.flag}</span>
        <span style={{ textTransform: 'uppercase' }}>{current.code}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown size={14} opacity={0.6} />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 5, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{
              position: 'absolute',
              top: '100%',
              right: currentLang === 'ar' ? 'auto' : 0,
              left: currentLang === 'ar' ? 0 : 'auto',
              marginTop: '8px',
              background: 'rgba(10, 15, 30, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '14px',
              padding: '6px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(20px)',
              minWidth: '150px'
            }}
          >
            {languages.map((lang) => (
              <motion.div
                key={lang.code}
                whileHover={{ background: 'rgba(255, 255, 255, 0.05)' }}
                onClick={() => {
                  onSwitch(lang.code);
                  setIsOpen(false);
                }}
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  color: currentLang === lang.code ? 'var(--a)' : 'rgba(255,255,255,0.7)',
                  fontSize: '14px',
                  transition: 'color 0.2s'
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1, display: 'block' }}>{lang.flag}</span>
                <span>{lang.name}</span>
                {currentLang === lang.code && (
                  <motion.div
                    layoutId="active-lang"
                    style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--a)' }}
                  />
                )}
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

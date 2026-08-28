"use client";

/**
 * SVG flag icons to replace emoji flags (which don't render on Windows).
 * Usage: <FlagIcon code="fr" size={20} />
 */
import type { ReactElement } from "react";

export default function FlagIcon({ code, size = 20 }: { code: string; size?: number }) {
  const flags: Record<string, ReactElement> = {
    fr: (
      <svg viewBox="0 0 640 480" width={size} height={size * 0.75} style={{ borderRadius: 3, display: 'block' }}>
        <rect width="213.3" height="480" fill="#002395" />
        <rect x="213.3" width="213.4" height="480" fill="#fff" />
        <rect x="426.7" width="213.3" height="480" fill="#ED2939" />
      </svg>
    ),
    en: (
      <svg viewBox="0 0 640 480" width={size} height={size * 0.75} style={{ borderRadius: 3, display: 'block' }}>
        <rect width="640" height="480" fill="#012169" />
        <path d="M75 0l244 181L562 0h78v62L400 241l240 178v61h-80L320 302 81 480H0v-60l239-178L0 64V0z" fill="#fff" />
        <path d="M424 281l216 159v40L369 281zm-184 20l6 35L54 480H0zM640 0v3L391 191l2-44L590 0zM0 0l239 176h-60L0 42z" fill="#C8102E" />
        <path d="M241 0v480h160V0zM0 160v160h640V160z" fill="#fff" />
        <path d="M0 193v96h640v-96zM273 0v480h96V0z" fill="#C8102E" />
      </svg>
    ),
    es: (
      <svg viewBox="0 0 640 480" width={size} height={size * 0.75} style={{ borderRadius: 3, display: 'block' }}>
        <rect width="640" height="480" fill="#AA151B" />
        <rect y="120" width="640" height="240" fill="#F1BF00" />
      </svg>
    ),
    ar: (
      <svg viewBox="0 0 640 480" width={size} height={size * 0.75} style={{ borderRadius: 3, display: 'block' }}>
        <rect width="640" height="480" fill="#C1272D" />
        <path d="M320 145l21.5 66.2h69.6l-56.3 40.9 21.5 66.1-56.3-40.9-56.3 40.9 21.5-66.1-56.3-40.9h69.6z" fill="none" stroke="#006233" strokeWidth="12" />
      </svg>
    ),
    zh: (
      <svg viewBox="0 0 640 480" width={size} height={size * 0.75} style={{ borderRadius: 3, display: 'block' }}>
        <rect width="640" height="480" fill="#DE2910" />
        <path d="M128 48l16 49h52l-42 30 16 49-42-30-42 30 16-49-42-30h52z" fill="#FFDE00" />
        <path d="M248 24l6 18h19l-15 11 6 18-16-11-15 11 6-18-16-11h19z" fill="#FFDE00" />
        <path d="M288 72l6 18h19l-15 11 6 18-16-11-15 11 6-18-16-11h19z" fill="#FFDE00" />
        <path d="M288 136l6 18h19l-15 11 6 18-16-11-15 11 6-18-16-11h19z" fill="#FFDE00" />
        <path d="M248 184l6 18h19l-15 11 6 18-16-11-15 11 6-18-16-11h19z" fill="#FFDE00" />
      </svg>
    ),
    sa: (
      <svg viewBox="0 0 640 480" width={size} height={size * 0.75} style={{ borderRadius: 3, display: 'block' }}>
        <rect width="640" height="480" fill="#006C35" />
        <text x="320" y="210" fill="#fff" fontSize="80" fontFamily="serif" textAnchor="middle">لا إله إلا الله</text>
        <rect x="200" y="280" width="240" height="12" rx="6" fill="#fff" />
      </svg>
    ),
  };

  return flags[code] || <span style={{ fontSize: size, lineHeight: 1 }}>🏳</span>;
}

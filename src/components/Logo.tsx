// Logo Moncef IA — marque SVG simple (remplace l'emoji 🎓).
// Carré arrondi au dégradé de la charte (--p-g), avec un « M » blanc.
export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="moncef-logo-g" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5982FF" />
          <stop offset="50%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#moncef-logo-g)" />
      <path
        d="M13 33 V15 L24 26 L35 15 V33"
        stroke="#fff"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="35.5" cy="33.5" r="3.2" fill="#00D2B6" />
    </svg>
  );
}

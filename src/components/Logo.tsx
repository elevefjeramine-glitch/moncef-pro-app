// Logo Moncef IA — utilise le logo officiel (public/logo.png).
export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/logo.png"
      alt="Moncef IA"
      width={size}
      height={size}
      style={{ display: "block", flexShrink: 0, borderRadius: size / 4 }}
    />
  );
}

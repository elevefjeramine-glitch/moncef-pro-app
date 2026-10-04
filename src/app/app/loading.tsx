// Loading state pour l'espace connecté : skeletons qui épousent la forme
// du contenu (évite les sauts de layout, meilleur qu'un spinner).
export default function AppLoading() {
  const shimmer: React.CSSProperties = {
    background:
      'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 75%)',
    backgroundSize: '200% 100%',
    animation: 'appLoadingShimmer 1.4s ease-in-out infinite',
    borderRadius: 12,
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`@keyframes appLoadingShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      <div style={{ ...shimmer, height: 56, maxWidth: 480 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ ...shimmer, height: 110 }} />
        ))}
      </div>
      <div style={{ ...shimmer, height: 320 }} />
    </div>
  );
}

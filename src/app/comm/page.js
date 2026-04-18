"use client";

// This is the old comm route. Redirect to the new /app/comm route.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CommRedirectPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/app/comm'); }, [router]);
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg)' }}>
      <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--a)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

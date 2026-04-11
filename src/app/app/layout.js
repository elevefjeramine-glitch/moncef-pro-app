"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Bot, CalendarDays, MessageSquare, LogOut, Settings, X, Palette, UserCircle, Save, Crown } from "lucide-react";

export default function AppLayout({ children }) {
  const [user, setUser] = useState(null);
  const [tokens, setTokens] = useState(700);
  const [showSettings, setShowSettings] = useState(false);
  const pathname = usePathname();

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/auth"; return; }
    
    const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
    if (data) { setUser(data); setTokens(data.tokens || 700); } 
    else { setUser(user); }
  };

  useEffect(() => { loadUser(); }, []);

  const handleLogout = async (e) => { e.stopPropagation(); await supabase.auth.signOut(); window.location.href = "/"; };

  if (!user) return <div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh',background:'var(--bg)'}}>
    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--a)', borderRadius: '50%' }} />
  </div>;

  const activeColor = user.theme_color || '#00D2B6';

  let navItems = [
    { name: 'Accueil', path: '/app', icon: Home },
    { name: 'Moncef IA', path: '/app/ai', icon: Bot },
    { name: 'Calendrier', path: '/app/schedule', icon: CalendarDays },
    { name: 'Messagerie', path: '/app/comm', icon: MessageSquare }
  ];

  if (user.role === 'founder') {
    navItems.splice(2, 0, { name: 'ALPHA AI', path: '/app/alpha', icon: Crown, isAlpha: true });
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Surcharge dynamique de la couleur d'accent */}
      <style dangerouslySetInnerHTML={{__html: ` :root { --a: ${activeColor} !important; } `}} />

      <div className="mesh" />
      
      <motion.nav initial={{ x: -300 }} animate={{ x: 0 }} transition={{ type: "spring", stiffness: 100, damping: 20 }} className="sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo.png" alt="Logo" style={{ width: 32, height: 32, borderRadius: 8, boxShadow: '0 0 10px rgba(0,210,182,0.3)' }} />
          Moncef <span style={{ color: 'var(--a)' }}>IA</span>
        </div>
        <div className="nav-items">
          {navItems.map((item, i) => {
            const isActive = pathname === item.path || (item.path !== '/app' && pathname.startsWith(item.path));
            const Icon = item.icon;
            return (
              <Link href={item.path} key={item.path}>
                <motion.div whileHover={{ scale: 1.02, x: 5 }} whileTap={{ scale: 0.98 }} className={`nav-item ${isActive ? 'active' : ''}`} style={item.isAlpha ? { background: isActive ? 'linear-gradient(90deg, rgba(255,215,0,0.15), transparent)' : 'rgba(255,215,0,0.05)', color: isActive ? '#FFD700' : 'rgba(255,215,0,0.7)', border: '1px solid rgba(255,215,0,0.1)' } : {}}>
                  <Icon size={20} style={{ color: isActive ? (item.isAlpha ? '#FFD700' : 'var(--a)') : 'rgba(255,255,255,0.5)' }} />
                  <span style={{ fontWeight: item.isAlpha ? 700 : (isActive ? 600 : 500) }}>{item.name}</span>
                  {item.isAlpha && <div style={{ marginLeft: 'auto', background: '#FFD700', color: '#000', fontSize: '10px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px' }}>PRO</div>}
                </motion.div>
              </Link>
            )
          })}
        </div>
        
        {/* BOUTON PROFIL CLIQUABLE */}
        <motion.div 
          whileHover={{ scale: 1.02, background: 'rgba(255,255,255,0.06)' }} 
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowSettings(true)}
          className="user-profile" 
          style={{ cursor: 'pointer', position: 'relative', marginTop: 'auto' }}
        >
          <motion.div className="av">
            {user.first_name ? user.first_name[0] : '?'}
          </motion.div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.first_name || 'Utilisateur'}</div>
            <div className="role-badge">{user.role === 'founder' ? '👑 ALPHA' : '👤 Normal'}</div>
          </div>
          <button style={{ background:'none', border:'none', color:'var(--err)', cursor:'pointer', padding: '4px' }} onClick={handleLogout} title="Déconnexion">
            <LogOut size={18} />
          </button>
        </motion.div>
      </motion.nav>

      <main className="main-content" style={{ flex: 1, position: 'relative' }}>
        <header className="glass-header">
          <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            {pathname === '/app' ? 'Tableau de Bord' 
             : pathname === '/app/ai' ? 'Intelligence Artificielle' 
             : pathname === '/app/alpha' ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FFD700' }}>
                  <Crown size={22} /> ALPHA AI
                </span>
             )
             : pathname === '/app/schedule' ? 'Mon Emploi du Temps' 
             : pathname === '/app/comm' ? 'Messagerie Interne'
             : 'Moncef IA'}
          </motion.h2>
          
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="header-actions">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', padding: '6px 14px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', color: 'var(--a)', fontWeight: 700, fontSize: 14 }}>
               ⚡ {tokens} cr.
            </div>
          </motion.div>
        </header>
        
        <div style={{ padding: '30px 40px', height: 'calc(100vh - var(--hh))', overflowY: 'auto' }}>
          {children}
        </div>
      </main>

      {/* MODALE PARAMÈTRES */}
      <AnimatePresence>
        {showSettings && (
          <SettingsModal 
            user={user} 
            close={() => { setShowSettings(false); loadUser(); }} 
          />
        )}
      </AnimatePresence>

    </div>
  );
}

// ----------------------------------------------------
// COMPOSANT MODALE POUR LES PARAMÈTRES
// ----------------------------------------------------
function SettingsModal({ user, close }) {
  const [tab, setTab] = useState('profil');
  const [firstName, setFirstName] = useState(user.first_name || "");
  const [themeColor, setThemeColor] = useState(user.theme_color || "#00D2B6");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const saveSettings = async () => {
    setLoading(true); setMsg("");
    try {
      const { error } = await supabase.from('users').update({
        first_name: firstName,
        theme_color: themeColor
      }).eq('id', user.id);

      if (error) {
        // Fallback gracefully si la colonne theme_color n'existe pas encore dans SQL
        if(error.message.includes("could not find the 'theme_color' column")) {
          setMsg("⚠️ Attention: L'Admin doit rajouter la colonne SQL 'theme_color' en base de données.");
        } else {
          throw error;
        }
      } else {
        setMsg("Paramètres sauvegardés avec succès ! ✅");
        setTimeout(() => close(), 1500);
      }
    } catch(err) {
      setMsg("Erreur de sauvegarde: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const colors = [
    { name: "Cyan Alpha", hex: "#00D2B6" },
    { name: "Rose Galactique", hex: "#FF3366" },
    { name: "Or Royal", hex: "#FFD700" },
    { name: "Neon Violet", hex: "#9D00FF" }
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)' }} />
      
      <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="card" style={{ width: '100%', maxWidth: '500px', background: 'var(--sb)', position: 'relative', zIndex: 10000, padding: 0 }}>
        
        <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '20px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><Settings size={20} color="var(--a)" /> Paramètres du Compte</h2>
          <button onClick={close} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}><X size={20}/></button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
          <button onClick={() => setTab('profil')} style={{ flex: 1, padding: '16px', background: tab === 'profil' ? 'rgba(255,255,255,0.05)' : 'none', border: 'none', borderBottom: tab === 'profil' ? '2px solid var(--a)' : '2px solid transparent', color: tab === 'profil' ? '#fff' : 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '8px', fontWeight: 600 }}>
            <UserCircle size={18}/> Mon Profil
          </button>
          <button onClick={() => setTab('interface')} style={{ flex: 1, padding: '16px', background: tab === 'interface' ? 'rgba(255,255,255,0.05)' : 'none', border: 'none', borderBottom: tab === 'interface' ? '2px solid var(--a)' : '2px solid transparent', color: tab === 'interface' ? '#fff' : 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '8px', fontWeight: 600 }}>
            <Palette size={18}/> Interface
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          {tab === 'profil' && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', textTransform: 'uppercase' }}>Prénom / Pseudo</label>
                <input className="fi" value={firstName} onChange={e => setFirstName(e.target.value)} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', textTransform: 'uppercase' }}>Email (Fixe)</label>
                <input className="fi" value={user.email} disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} />
              </div>
              <div className="role-badge" style={{ fontSize: '14px', padding: '8px 16px', display: 'inline-block' }}>Grade : {user.role === 'founder' ? '👑 Fondateur Alpha' : 'Membre'}</div>
            </motion.div>
          )}

          {tab === 'interface' && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '12px', textTransform: 'uppercase' }}>Couleur d'Accentuation Unique</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  {colors.map(c => (
                    <div 
                      key={c.hex} 
                      onClick={() => setThemeColor(c.hex)}
                      style={{ padding: '12px', borderRadius: '12px', border: themeColor === c.hex ? `2px solid ${c.hex}` : '2px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
                    >
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: c.hex, boxShadow: `0 0 10px ${c.hex}` }} />
                      <span style={{ fontSize: '13px', color: themeColor === c.hex ? '#fff' : 'rgba(255,255,255,0.6)' }}>{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {msg && <div style={{ marginTop: '20px', fontSize: '13px', color: msg.includes('Erreur') || msg.includes('Attention') ? 'var(--warn)' : 'var(--ok)', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}>{msg}</div>}

          <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button onClick={close} style={{ padding: '10px 20px', background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '10px', cursor: 'pointer' }}>Annuler</button>
            <button onClick={saveSettings} disabled={loading} className="btn" style={{ padding: '10px 24px', minHeight: 'auto', borderRadius: '10px' }}>
              {loading ? '...' : <><Save size={16}/> Enregistrer</>}
            </button>
          </div>
        </div>

      </motion.div>
    </div>
  )
}

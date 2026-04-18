"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Crown, Sparkles, RefreshCw, Terminal, Users, BookOpen, MessageSquare, Calendar, Trash2, Shield, Zap, BarChart3, ChevronDown, ChevronUp, AlertTriangle, Check, X, Database } from "lucide-react";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

const ROLE_COLORS = {
  founder: { color: '#FFD700', bg: 'rgba(255,215,0,0.15)', label: '👑 Fondateur' },
  moderator: { color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', label: '🛡️ Modérateur' },
  normal: { color: 'rgba(255,255,255,0.6)', bg: 'rgba(255,255,255,0.05)', label: '👤 Utilisateur' },
};

function StatCard({ icon: Icon, label, value, sub, color = '#FFD700', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${color}22`, borderRadius: 18, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}
    >
      <div style={{ width: 46, height: 46, borderRadius: 14, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0, border: `1px solid ${color}33` }}>
        <Icon size={22} />
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value ?? '—'}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: `${color}99`, marginTop: 2 }}>{sub}</div>}
      </div>
    </motion.div>
  );
}

export default function AlphaPage() {
  const router = useRouter();
  const [isFounder, setIsFounder] = useState(false);
  const [authToken, setAuthToken] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [allHomework, setAllHomework] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editRole, setEditRole] = useState('');
  const [editTokens, setEditTokens] = useState(0);
  const [actionMsg, setActionMsg] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);
  const [serviceKeyMissing, setServiceKeyMissing] = useState(false); // Bug #9 fix

  // AI Console
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '👑 ALPHA — Interface d\'administration activée. Je peux analyser vos données, gérer les utilisateurs et vous fournir des statistiques en temps réel. Quelle est votre directive ?' }
  ]);
  const [input, setInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auth check
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/auth'); return; }
      setAuthToken(session.access_token);
      const { data } = await supabase.from('users').select('role').eq('id', session.user.id).single();
      if (data?.role === 'founder') {
        setIsFounder(true);
      } else {
        router.push('/app');
      }
    };
    init();
  }, [router]);

  const alphaFetch = useCallback(async (action, payload = {}) => {
    if (!authToken) return null;
    const res = await fetch('/api/alpha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, authToken, payload })
    });
    return res.json();
  }, [authToken]);

  const loadStats = useCallback(async () => {
    if (!authToken) return;
    setLoadingData(true);
    const data = await alphaFetch('GET_STATS');
    if (data && !data.error) {
      setStats(data);
      setUsers(data.users?.data || []);
      setLastRefresh(new Date());
      setServiceKeyMissing(false);
    } else if (data?.error?.includes('Service role') || data?.error?.includes('service_role')) {
      // Bug #9 fix: flag missing key so UI can show a clear setup guide
      setServiceKeyMissing(true);
      setActionMsg('');
    }
    setLoadingData(false);
  }, [alphaFetch, authToken]);

  const loadAllHomework = useCallback(async () => {
    const data = await alphaFetch('GET_ALL_HOMEWORK');
    if (data && !data.error) setAllHomework(data.data || []);
  }, [alphaFetch]);

  useEffect(() => {
    if (isFounder && authToken) {
      loadStats();
    }
  }, [isFounder, authToken, loadStats]);

  useEffect(() => {
    if (tab === 'homework' && isFounder) loadAllHomework();
  }, [tab, isFounder, loadAllHomework]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!isFounder) return;
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [isFounder, loadStats]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, aiLoading]);

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    const res = await alphaFetch('UPDATE_USER', { userId: editingUser.id, updates: { role: editRole, tokens: Number(editTokens) } });
    if (res?.success) {
      setActionMsg(`✅ ${editingUser.first_name || editingUser.email} mis à jour`);
      setEditingUser(null);
      loadStats();
    } else {
      setActionMsg(`❌ ${res?.error}`);
    }
    setTimeout(() => setActionMsg(''), 3000);
  };

  const handleDeleteUser = async (userId, name) => {
    if (!confirm(`Supprimer ${name} ? Cette action est irréversible.`)) return;
    const res = await alphaFetch('DELETE_USER', { userId });
    if (res?.success) {
      setActionMsg(`✅ Utilisateur supprimé`);
      loadStats();
    } else {
      setActionMsg(`❌ ${res?.error}`);
    }
    setTimeout(() => setActionMsg(''), 3000);
  };

  const handleDeleteHomework = async (hwId, subject) => {
    const res = await alphaFetch('DELETE_HOMEWORK', { hwId });
    if (res?.success) {
      setActionMsg(`✅ Devoir "${subject}" supprimé`);
      setAllHomework(prev => prev.filter(h => h.id !== hwId));
    } else setActionMsg(`❌ ${res?.error}`);
    setTimeout(() => setActionMsg(''), 3000);
  };

  const sendAiMessage = async () => {
    if (!input.trim() || aiLoading) return;
    const userMsg = input.trim();
    setInput('');
    const ctx = [...messages, { role: 'user', content: userMsg }];
    setMessages(ctx);
    setAiLoading(true);

    // Build context summary for the AI
    const statsSummary = stats ? `
DONNÉES EN TEMPS RÉEL:
- Utilisateurs total: ${stats.users?.count}
- Devoirs total: ${stats.homework?.count}
- Messages total: ${stats.messages?.count}
- Cours emploi du temps: ${stats.schedule?.count}
- Liste utilisateurs: ${JSON.stringify(stats.users?.data?.map(u => ({ id: u.id, email: u.email, nom: u.first_name, role: u.role, tokens: u.tokens, inscrit: u.created_at })))}
- Devoirs par statut: todo=${stats.homework?.data?.filter(h => h.status === 'todo').length}, en_cours=${stats.homework?.data?.filter(h => h.status === 'in_progress').length}, fait=${stats.homework?.data?.filter(h => h.status === 'done').length}
` : 'Statistiques en cours de chargement.';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: ctx.map(m => ({ role: m.role, content: m.content })),
          system: `Tu es ALPHA, l'IA d'administration de la plateforme "Moncef IA", créée par Amine FJER. Tu as accès à toutes les données de la plateforme en temps réel. 
Tu es ultra-précis, direct, et tu fournis des analyses détaillées. 
Tu peux expliquer comment effectuer des actions admin comme changer un rôle utilisateur, supprimer un compte, réinitialiser des tokens.
La date actuelle est le ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

${statsSummary}

Tu peux suggérer des actions spécifiques en formatant tes réponses de manière claire avec des tableaux ou statistiques quand c'est pertinent.`
        })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.response || 'Erreur.' }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Erreur de connexion.' }]);
    } finally {
      setAiLoading(false);
    }
  };

  if (!isFounder) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 16 }}>
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
        <Crown size={40} color="#FFD700" />
      </motion.div>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>{t(lang,'alpha_verifying')}</div>
    </div>
  );

  const hwByStatus = {
    todo: stats?.homework?.data?.filter(h => h.status === 'todo').length ?? 0,
    in_progress: stats?.homework?.data?.filter(h => h.status === 'in_progress').length ?? 0,
    done: stats?.homework?.data?.filter(h => h.status === 'done').length ?? 0,
  };

  const TABS = [
    { id: 'dashboard', label: t(lang,'alpha_tab_dashboard'), icon: BarChart3 },
    { id: 'users', label: t(lang,'alpha_tab_users'), icon: Users },
    { id: 'homework', label: t(lang,'alpha_tab_homework'), icon: BookOpen },
    { id: 'ai', label: t(lang,'alpha_tab_console'), icon: Terminal },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Bug #9 fix: Service Key Setup Banner */}
      {serviceKeyMissing && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          style={{ padding: '16px 22px', borderRadius: 16, background: 'rgba(255,165,2,0.1)', border: '1px solid rgba(255,165,2,0.4)', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <AlertTriangle size={20} color="#ffa502" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ color: '#ffa502', fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{t(lang,'alpha_setup_title')}</div>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 1.7 }}>
              Pour activer les statistiques et la gestion des utilisateurs :
              <ol style={{ margin: '8px 0 0 18px', padding: 0 }}>
                <li>{t(lang,'alpha_setup_p1')} <strong style={{color:'#ffa502'}}>{t(lang,'alpha_setup_p1b')}</strong></li>
                <li>{t(lang,'alpha_setup_p2')} <code style={{background:'rgba(255,165,2,0.15)',padding:'1px 6px',borderRadius:4}}>{t(lang,'alpha_setup_p2b')}</code></li>
                <li>{t(lang,'alpha_setup_p3')} <strong style={{color:'#ffa502'}}>{t(lang,'alpha_setup_p3b')}</strong> {t(lang,'alpha_setup_p3')} <code style={{background:'rgba(255,165,2,0.15)',padding:'1px 6px',borderRadius:4}}>{t(lang,'alpha_setup_p3c')}</code></li>
                <li>{t(lang,'alpha_setup_p4')}</li>
              </ol>
            </div>
          </div>
        </motion.div>
      )}

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        style={{ padding: '20px 28px', borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, rgba(255,215,0,0.12), rgba(200,150,0,0.06))', border: '1px solid rgba(255,215,0,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 50, height: 50, borderRadius: 16, background: 'linear-gradient(135deg, #FFD700, #D4AF37)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(255,215,0,0.4)' }}>
            <Crown size={28} color="#000" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, color: '#FFD700', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
              {t(lang,'alpha_title')} <Sparkles size={16} color="#FFD700" />
            </h2>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
              {lastRefresh ? `${t(lang,'alpha_last_refresh')} ${lastRefresh.toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US')}` : t(lang,'alpha_loading')} • {t(lang,'alpha_founder_access')}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={loadStats} disabled={loadingData}
            style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.25)', padding: '8px 16px', borderRadius: 12, color: '#FFD700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}>
            <RefreshCw size={14} style={{ animation: loadingData ? 'spin 1s linear infinite' : 'none' }} />
            Actualiser
          </motion.button>
        </div>
      </motion.div>

      {/* Action message */}
      <AnimatePresence>
        {actionMsg && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ padding: '12px 20px', borderRadius: 12, background: actionMsg.startsWith('✅') ? 'rgba(0,230,138,0.1)' : 'rgba(255,71,87,0.1)', border: `1px solid ${actionMsg.startsWith('✅') ? 'rgba(0,230,138,0.3)' : 'rgba(255,71,87,0.3)'}`, color: '#fff', fontSize: 14, textAlign: 'center' }}>
            {actionMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, background: 'rgba(0,0,0,0.3)', padding: 6, borderRadius: 18, border: '1px solid rgba(255,215,0,0.1)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ flex: 1, padding: '10px 16px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: tab === t.id ? 'linear-gradient(135deg, #FFD700, #D4AF37)' : 'transparent', color: tab === t.id ? '#000' : 'rgba(255,215,0,0.6)', transition: 'all 0.2s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* DASHBOARD TAB */}
      {tab === 'dashboard' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <StatCard icon={Users} label="Utilisateurs inscrits" value={stats?.users?.count} color="#FFD700" delay={0} />
            <StatCard icon={BookOpen} label="Devoirs total" value={stats?.homework?.count} color="#a78bfa" delay={0.05}
              sub={`${hwByStatus.todo} à faire • ${hwByStatus.in_progress} en cours`} />
            <StatCard icon={MessageSquare} label="Messages envoyés" value={stats?.messages?.count} color="#00D2B6" delay={0.1} />
            <StatCard icon={Calendar} label="Cours planifiés" value={stats?.schedule?.count} color="#f97316" delay={0.15} />
          </div>

          {/* Homework status breakdown */}
          {stats?.homework?.count > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 20, padding: 24, border: '1px solid rgba(255,215,0,0.1)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#FFD700', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart3 size={18} /> Répartition des Devoirs
              </h3>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {[
                  { label: '📋 À faire', count: hwByStatus.todo, color: 'rgba(255,255,255,0.6)' },
                  { label: '⏳ En cours', count: hwByStatus.in_progress, color: '#00D2B6' },
                  { label: '✅ Terminés', count: hwByStatus.done, color: '#2ed573' },
                ].map(item => (
                  <div key={item.label} style={{ flex: 1, minWidth: 100, padding: '14px 18px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: item.color }}>{item.count}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{item.label}</div>
                  </div>
                ))}
              </div>
              {/* Progress bar */}
              {stats?.homework?.count > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
                    <span>Taux de complétion global</span>
                    <span style={{ color: '#2ed573', fontWeight: 700 }}>{Math.round((hwByStatus.done / stats.homework.count) * 100)}%</span>
                  </div>
                  <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.round((hwByStatus.done / stats.homework.count) * 100)}%` }}
                      transition={{ duration: 1, delay: 0.3 }}
                      style={{ height: '100%', background: 'linear-gradient(90deg, #2e5bff, #2ed573)', borderRadius: 10 }} />
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Recent users */}
          {users.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 20, padding: 24, border: '1px solid rgba(255,215,0,0.1)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#FFD700', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={18} /> Inscrits récents
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {users.slice(0, 5).map(u => {
                  const rc = ROLE_COLORS[u.role] || ROLE_COLORS.normal;
                  return (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: rc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                        {u.role === 'founder' ? '👑' : u.role === 'moderator' ? '🛡️' : '👤'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{u.first_name || 'Inconnu'} {u.last_name || ''}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{u.email}</div>
                      </div>
                      <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 8, background: rc.bg, color: rc.color, fontWeight: 700 }}>{rc.label}</span>
                      <span style={{ fontSize: 11, color: '#FFD700', fontWeight: 700 }}>⚡ {u.tokens}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* No service role warning */}
          {(!stats || stats.error) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ padding: 20, borderRadius: 16, background: 'rgba(255,165,2,0.08)', border: '1px solid rgba(255,165,2,0.25)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <AlertTriangle size={20} color="#ffa502" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#ffa502' }}>Clé Service Role manquante</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                  Pour activer toutes les fonctionnalités admin, ajoutez <code style={{ background: 'rgba(0,0,0,0.4)', padding: '1px 6px', borderRadius: 4 }}>SUPABASE_SERVICE_ROLE_KEY</code> dans vos variables d'environnement Netlify et dans <code style={{ background: 'rgba(0,0,0,0.4)', padding: '1px 6px', borderRadius: 4 }}>.env.local</code>.
                  <br />Trouvez-la dans : Supabase → Settings → API → service_role key.
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* USERS TAB */}
      {tab === 'users' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{users.length} utilisateurs enregistrés</div>
          {users.map(u => {
            const rc = ROLE_COLORS[u.role] || ROLE_COLORS.normal;
            const isEditing = editingUser?.id === u.id;
            return (
              <motion.div key={u.id} layout
                style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 18, border: `1px solid ${isEditing ? '#FFD700' : 'rgba(255,255,255,0.07)'}`, overflow: 'hidden', transition: 'border 0.2s' }}>
                <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: rc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, border: `1px solid ${rc.color}33`, flexShrink: 0 }}>
                    {u.role === 'founder' ? '👑' : u.role === 'moderator' ? '🛡️' : '👤'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: '#fff', fontSize: 15 }}>{u.first_name || 'N/A'} {u.last_name || ''}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>Inscrit {new Date(u.created_at).toLocaleDateString('fr-FR')}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, padding: '4px 12px', borderRadius: 10, background: rc.bg, color: rc.color, fontWeight: 700 }}>{rc.label}</span>
                    <span style={{ fontSize: 12, color: '#FFD700', fontWeight: 700 }}>⚡ {u.tokens}</span>
                    {u.role !== 'founder' && (
                      <>
                        <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.93 }}
                          onClick={() => { setEditingUser(u); setEditRole(u.role); setEditTokens(u.tokens); }}
                          style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.25)', borderRadius: 10, padding: '6px 12px', color: '#FFD700', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                          <Shield size={14} />
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.08, color: '#ff4757' }} whileTap={{ scale: 0.93 }}
                          onClick={() => handleDeleteUser(u.id, u.first_name || u.email)}
                          style={{ background: 'none', border: 'none', color: 'rgba(255,71,87,0.5)', cursor: 'pointer', padding: 4 }}>
                          <Trash2 size={16} />
                        </motion.button>
                      </>
                    )}
                  </div>
                </div>
                {/* Edit panel */}
                <AnimatePresence>
                  {isEditing && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      style={{ overflow: 'hidden', borderTop: '1px solid rgba(255,215,0,0.15)' }}>
                      <div style={{ padding: '16px 20px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', background: 'rgba(255,215,0,0.03)' }}>
                        <div style={{ flex: '1 1 150px' }}>
                          <label style={{ fontSize: 11, color: 'rgba(255,215,0,0.7)', fontWeight: 700, display: 'block', marginBottom: 6 }}>RÔLE</label>
                          <select value={editRole} onChange={e => setEditRole(e.target.value)}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,215,0,0.3)', color: '#fff', fontSize: 13, outline: 'none' }}>
                            <option value="normal">👤 Normal</option>
                            <option value="moderator">🛡️ Modérateur</option>
                            <option value="founder">👑 Fondateur</option>
                          </select>
                        </div>
                        <div style={{ flex: '1 1 120px' }}>
                          <label style={{ fontSize: 11, color: 'rgba(255,215,0,0.7)', fontWeight: 700, display: 'block', marginBottom: 6 }}>TOKENS</label>
                          <input type="number" value={editTokens} onChange={e => setEditTokens(e.target.value)} min={0} max={999999}
                            style={{ width: '100%', padding: '8px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,215,0,0.3)', color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', paddingBottom: 1 }}>
                          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleUpdateUser}
                            style={{ padding: '8px 16px', borderRadius: 10, background: '#FFD700', border: 'none', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Check size={14} /> Sauvegarder
                          </motion.button>
                          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setEditingUser(null)}
                            style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <X size={14} />
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
          {users.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
              {loadingData ? 'Chargement...' : 'Aucun utilisateur trouvé — clé service role requise'}
            </div>
          )}
        </motion.div>
      )}

      {/* HOMEWORK TAB */}
      {tab === 'homework' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{allHomework.length} devoirs au total</div>
          {allHomework.map(hw => (
            <div key={hw.id} style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 14, padding: '14px 18px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: hw.priority === 'urgent' ? '#ff4757' : hw.priority === 'low' ? '#2ed573' : '#ffa502', textTransform: 'uppercase' }}>
                    {hw.priority === 'urgent' ? '🔴' : hw.priority === 'low' ? '🟢' : '🟡'} {hw.subject}
                  </span>
                  {hw.users && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>👤 {hw.users.first_name || hw.users.email}</span>}
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{hw.status === 'done' ? '✅' : hw.status === 'in_progress' ? '⏳' : '📋'} {hw.status}</span>
                  {hw.due_date && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>📅 {hw.due_date}</span>}
                </div>
                <div style={{ fontSize: 13, color: '#fff' }}>{hw.task}</div>
                {hw.progression > 0 && (
                  <div style={{ marginTop: 8, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', width: '60%' }}>
                    <div style={{ height: '100%', width: `${hw.progression}%`, background: 'linear-gradient(90deg, #2e5bff, #00D2B6)', borderRadius: 4 }} />
                  </div>
                )}
              </div>
              <motion.button whileHover={{ scale: 1.1, color: '#ff4757' }} whileTap={{ scale: 0.9 }}
                onClick={() => handleDeleteHomework(hw.id, hw.subject)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,71,87,0.4)', cursor: 'pointer', flexShrink: 0 }}>
                <Trash2 size={16} />
              </motion.button>
            </div>
          ))}
          {allHomework.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
              {loadingData ? 'Chargement...' : 'Aucun devoir trouvé — clé service role requise'}
            </div>
          )}
        </motion.div>
      )}

      {/* AI CONSOLE TAB */}
      {tab === 'ai' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 24, border: '1px solid rgba(255,215,0,0.15)', display: 'flex', flexDirection: 'column', minHeight: 520, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: 28, display: 'flex', flexDirection: 'column', gap: 20, maxHeight: 500 }}>
            <AnimatePresence>
              {messages.map((msg, idx) => {
                const isAi = msg.role === 'assistant';
                return (
                  <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    style={{ alignSelf: isAi ? 'flex-start' : 'flex-end', maxWidth: '85%', display: 'flex', gap: 10 }}>
                    {isAi && <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,215,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD700', flexShrink: 0, border: '1px solid rgba(255,215,0,0.25)' }}><Crown size={18} /></div>}
                    <div style={{ padding: '14px 18px', borderRadius: 18, borderTopLeftRadius: isAi ? 4 : 18, borderTopRightRadius: isAi ? 18 : 4, background: isAi ? 'rgba(255,215,0,0.04)' : 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,215,0,0.05))', border: `1px solid ${isAi ? 'rgba(255,215,0,0.12)' : 'rgba(255,215,0,0.3)'}`, color: isAi ? '#EEDD88' : '#fff', fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                      {msg.content}
                    </div>
                  </motion.div>
                );
              })}
              {aiLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ alignSelf: 'flex-start', display: 'flex', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,215,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD700', border: '1px solid rgba(255,215,0,0.25)' }}><Crown size={18} /></div>
                  <div style={{ padding: '14px 18px', borderRadius: 18, borderTopLeftRadius: 4, background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.12)', display: 'flex', gap: 6, alignItems: 'center' }}>
                    {[0, 0.2, 0.4].map((d, i) => (
                      <motion.div key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.4, delay: d }}
                        style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFD700' }} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
          {/* Quick commands */}
          <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(255,215,0,0.1)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['Donne-moi les stats complètes', 'Qui sont les utilisateurs ?', 'Analyse la progression des devoirs', 'Combien de messages aujourd\'hui ?'].map(cmd => (
              <button key={cmd} onClick={() => setInput(cmd)}
                style={{ padding: '5px 12px', borderRadius: 8, background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.15)', color: 'rgba(255,215,0,0.7)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                {cmd}
              </button>
            ))}
          </div>
          <div style={{ padding: '16px 24px', background: 'rgba(0,0,0,0.5)', borderTop: '1px solid rgba(255,215,0,0.15)' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'rgba(255,215,0,0.03)', border: '1px solid rgba(255,215,0,0.2)', padding: '8px 8px 8px 20px', borderRadius: 20 }}>
              <Terminal size={16} color="#FFD700" style={{ opacity: 0.6 }} />
              <input style={{ flex: 1, background: 'none', border: 'none', color: '#fff', fontSize: 14, outline: 'none', fontFamily: 'monospace' }}
                placeholder="Directive ALPHA..." value={input}
                onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendAiMessage()} disabled={aiLoading} />
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={sendAiMessage} disabled={aiLoading}
                style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #FFD700, #D4AF37)', border: 'none', color: '#000', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(255,215,0,0.25)' }}>
                <Send size={18} />
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}

    </div>
  );
}

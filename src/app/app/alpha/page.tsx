"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Crown, Sparkles, RefreshCw, Terminal, Users, BookOpen, MessageSquare, Calendar, Trash2, Shield, Zap, BarChart3, ChevronDown, ChevronUp, AlertTriangle, Check, X, Database } from "lucide-react";
import { supabase } from "@/utils/supabase/client";
import { useLanguage, t } from "@/utils/i18n";
import { useRouter } from "next/navigation";
import DOMPurify from "isomorphic-dompurify";
import { marked } from "marked";

const ROLE_COLORS: Record<string, any> = {
  founder: { color: '#FFD700', bg: 'rgba(255,215,0,0.15)', label: '👑 Fondateur' },
  moderator: { color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', label: '🛡️ Modérateur' },
  normal: { color: 'rgba(255,255,255,0.6)', bg: 'rgba(255,255,255,0.05)', label: '👤 Utilisateur' },
};

function StatCard({ icon: Icon, label, value, sub, color = '#FFD700', delay = 0 }: any) {
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
  const lang = useLanguage();
  const router = useRouter();
  const [isAuthorizedAdmin, setIsAuthorizedAdmin] = useState(false);
  const [userRole, setUserRole] = useState<any>(null);
  const [authToken, setAuthToken] = useState<any>(null);
  const [tab, setTab] = useState('dashboard');
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [allHomework, setAllHomework] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editRole, setEditRole] = useState('');
  const [editTokens, setEditTokens] = useState(0);
  const [actionMsg, setActionMsg] = useState('');
  const [lastRefresh, setLastRefresh] = useState<any>(null);
  const [serviceKeyMissing, setServiceKeyMissing] = useState(false); // Bug #9 fix

  // AI Console
  // Un tour peut porter les actions réellement exécutées par le serveur, et les
  // suppressions que l'humain doit encore confirmer.
  type Tour = { role: string; content: string; actions?: { outil: string; cible?: string; resultat: Record<string, any> }[]; aExecuter?: { cible: string; id: string; email: string }[]; avertissements?: string[] };
  const [messages, setMessages] = useState<Tour[]>([
    { role: 'assistant', content: '👑 ALPHA — Interface d\'administration activée. Je peux analyser vos données, gérer les utilisateurs et vous fournir des statistiques en temps réel. Quelle est votre directive ?' }
  ]);
  const [input, setInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const messagesEndRef = useRef<any>(null);

  // Auth check
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/auth'); return; }
      setAuthToken(session.access_token);
      const { data: meRows } = await supabase.rpc('get_me');
        const data = meRows?.[0] ? { role: meRows[0].role } : null;
      if (['founder', 'moderator'].includes(data?.role)) {
        setIsAuthorizedAdmin(true);
        setUserRole(data?.role);
      } else {
        router.push('/app');
      }
    };
    init();
  }, [router]);

  const alphaFetch = useCallback(async (action: string, payload: any = {}) => {
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
    if (isAuthorizedAdmin && authToken) {
      loadStats();
    }
  }, [isAuthorizedAdmin, authToken, loadStats]);

  useEffect(() => {
    if (tab === 'homework' && isAuthorizedAdmin) loadAllHomework();
  }, [tab, isAuthorizedAdmin, loadAllHomework]);

  // Si le rôle change en cours de séance (fondateur qui rétrograde, onglet resté
  // ouvert), on ne laisse pas la page sur un écran qui n'existe plus pour elle.
  // Posé ici, parmi les autres effets : placé plus bas, après les `return` de
  // garde, il aurait été un hook conditionnel — eslint le refuse à juste titre.
  useEffect(() => {
    if (tab === 'ai' && userRole !== 'founder') setTab('dashboard');
  }, [tab, userRole]);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!isAuthorizedAdmin) return;
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [isAuthorizedAdmin, loadStats]);

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

  const handleDeleteUser = async (userId: any, name: any) => {
    if (!confirm(`Supprimer ${name} ? Cette action est irréversible.`)) return;
    const res = await alphaFetch('DELETE_USER', { userId });
    if (res?.success) {
      setActionMsg(`✅ Utilisateur supprimé`);
      setUsers(prev => prev.filter(u => u.id !== userId)); // Instant UI update
      loadStats();
    } else {
      setActionMsg(`❌ ${res?.error}`);
    }
    setTimeout(() => setActionMsg(''), 3000);
  };

  const handleDeleteHomework = async (hwId: any, subject: any) => {
    const res = await alphaFetch('DELETE_HOMEWORK', { hwId });
    if (res?.success) {
      setActionMsg(`✅ Devoir "${subject}" supprimé`);
      setAllHomework(prev => prev.filter((h: any) => h.id !== hwId));
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


    try {
      // La console appelait /api/chat : une IA sans aucun outil, dont le propre
      // prompt disait « tu peux expliquer comment effectuer des actions admin ».
      // Un admin qui écrit « passe Amina en modératrice » repartait donc avec un
      // mode d'emploi. /api/alpha/assistant, lui, exécute la fonction demandée
      // avec TA session, puis relit la base avant de répondre.
      const res = await fetch('/api/alpha/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authToken,
          messages: ctx.map((m) => ({ role: m.role, content: String(m.content || '').slice(0, 4000) })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: `\u274c ${data?.error || 'Assistant indisponible.'}` }]);
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reponse || 'Réponse vide.',
          actions: Array.isArray(data.actions) ? data.actions : [],
          aExecuter: Array.isArray(data.a_executer) ? data.a_executer : [],
          avertissements: Array.isArray(data.avertissements) ? data.avertissements : [],
        },
      ]);
      loadStats();
    } catch {
      // Panne réseau, réponse illisible : la bulle le dit au lieu de s'éteindre
      // en silence en laissant l'admin croire que la commande est partie.
      setMessages((prev) => [...prev, { role: 'assistant', content: '❌ Le serveur na pas répondu — aucune action na été exécutée.' }]);
    } finally {
      setAiLoading(false);
    }
  };

  if (!isAuthorizedAdmin) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 16 }}>
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
        <Crown size={40} color="#FFD700" />
      </motion.div>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>{t(lang,'alpha_verifying')}</div>
    </div>
  );

  const hwByStatus = {
    todo: stats?.homework?.data?.filter((h: any) => h.status === 'todo').length ?? 0,
    in_progress: stats?.homework?.data?.filter((h: any) => h.status === 'in_progress').length ?? 0,
    done: stats?.homework?.data?.filter((h: any) => h.status === 'done').length ?? 0,
  };

  const TABS = [
    { id: 'dashboard', label: t(lang,'alpha_tab_dashboard'), icon: BarChart3 },
    { id: 'users', label: t(lang,'alpha_tab_users'), icon: Users },
    { id: 'homework', label: t(lang,'alpha_tab_homework'), icon: BookOpen },
    // La console IA est retirée aux modérateurs : elle exécute des gestes de
    // fondateur (grade, solde, suppression à confirmer). L'onglet disparaît pour
    // que l'interface ne promette pas ce que le serveur refuse — le vrai garde est
    // dans /api/alpha/assistant, qui renvoie 403 à un compte non fondateur.
    ...(userRole === 'founder' ? [{ id: 'ai', label: t(lang,'alpha_tab_console'), icon: Terminal }] : []),
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
              {t(lang,'alpha_title')} ({userRole === 'founder' ? '👑 Fondateur' : '🛡️ Modérateur'}) <Sparkles size={16} color="#FFD700" />
            </h2>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
              {lastRefresh ? `${t(lang,'alpha_last_refresh')} ${lastRefresh.toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US')}` : t(lang,'alpha_loading')} • {userRole === 'founder' ? t(lang,'alpha_founder_access') : 'Accès Modérateur'}
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
                  const rc = ROLE_COLORS[u.role as string] || ROLE_COLORS.normal || {};
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
                  Pour activer toutes les fonctionnalités admin, ajoutez <code style={{ background: 'rgba(0,0,0,0.4)', padding: '1px 6px', borderRadius: 4 }}>SUPABASE_SERVICE_ROLE_KEY</code> dans vos variables d’environnement Netlify et dans <code style={{ background: 'rgba(0,0,0,0.4)', padding: '1px 6px', borderRadius: 4 }}>.env.local</code>.
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
          {userRole !== 'founder' && (
            // Dit, pas caché : un modérateur qui cherche le crayon ou la corbeille
            // doit comprendre pourquoi ils ne sont pas là.
            <div style={{ fontSize: 12.5, lineHeight: 1.6, color: '#d9ccff', background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.24)', borderRadius: 12, padding: '10px 14px' }}>
              {t(lang,'alpha_readonly_admin')}
            </div>
          )}
          {users.map(u => {
            const rc = ROLE_COLORS[u.role as string] || ROLE_COLORS.normal || {};
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
                    {userRole === 'founder' && u.role !== 'founder' && (
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
                            {userRole === 'founder' && <option value="founder">👑 Fondateur</option>}
                          </select>
                        </div>
                        <div style={{ flex: '1 1 120px' }}>
                          <label style={{ fontSize: 11, color: 'rgba(255,215,0,0.7)', fontWeight: 700, display: 'block', marginBottom: 6 }}>TOKENS</label>
                          <input type="number" value={editTokens} onChange={e => setEditTokens(Math.max(0, Math.min(999999, Number(e.target.value) || 0)))} min={0} max={999999}
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
              {loadingData ? 'Chargement...' : (serviceKeyMissing ? 'Clé service role requise' : 'Aucun utilisateur trouvé.')}
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
              {loadingData ? 'Chargement...' : (serviceKeyMissing ? 'Clé service role requise' : 'Aucun devoir pour le moment.')}
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
                    <div className={isAi ? "alpha-markdown" : ""} style={{ padding: '14px 18px', borderRadius: 18, borderTopLeftRadius: isAi ? 4 : 18, borderTopRightRadius: isAi ? 18 : 4, background: isAi ? 'rgba(255,215,0,0.04)' : 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,215,0,0.05))', border: `1px solid ${isAi ? 'rgba(255,215,0,0.12)' : 'rgba(255,215,0,0.3)'}`, color: isAi ? '#EEDD88' : '#fff', fontSize: 14, lineHeight: 1.65, whiteSpace: 'normal', wordBreak: 'break-word' }}
                      dangerouslySetInnerHTML={{ __html: isAi ? DOMPurify.sanitize(marked.parse(msg.content || '') as string) : msg.content }}
                    />
                    {isAi && (msg.actions?.length || msg.aExecuter?.length || msg.avertissements?.length) ? (
                      <div style={{ maxWidth: 430, display: 'flex', flexDirection: 'column', gap: 6, marginTop: 2 }}>
                        {(msg.actions || []).map((a, i) => (
                          <div key={a.outil + i} style={{ fontSize: 11.5, lineHeight: 1.45, padding: '6px 10px', borderRadius: 10, background: 'rgba(167,139,250,0.09)', border: '1px solid rgba(167,139,250,0.28)', color: '#d9ccff' }}>
                            <strong style={{ color: '#a78bfa' }}>{a.outil}</strong>
                            {a.cible ? ` · ${a.cible}` : ''}
                            {a.resultat?.avant !== undefined ? ` · ${a.resultat.avant} → ${a.resultat.relu_en_base ?? '?'}` : ''}
                            {a.resultat?.relu_en_base !== undefined && a.resultat?.avant === undefined ? ` · relu : ${typeof a.resultat.relu_en_base === 'object' ? JSON.stringify(a.resultat.relu_en_base) : a.resultat.relu_en_base}` : ''}
                            {a.resultat?.erreur ? ` · ${a.resultat.erreur}` : ''}
                            {a.resultat?.ligne_cree ? ' · profil recréé' : ''}
                            {a.resultat?.rappel ? ` · ${a.resultat.rappel}` : ''}
                          </div>
                        ))}
                        {(msg.aExecuter || []).map((pr) => (
                          <div key={pr.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11.5, padding: '7px 10px', borderRadius: 10, background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.3)' }}>
                            <span>Suppression à confirmer : <strong>{pr.email}</strong></span>
                            <button
                              type="button"
                              onClick={async () => {
                                const r = await alphaFetch('DELETE_USER', { userId: pr.id });
                                setActionMsg(r?.success ? `\u2705 ${pr.email} supprimé` : `\u274c ${r?.error}`);
                                setTimeout(() => setActionMsg(''), 4000);
                              }}
                              style={{ background: '#ff6b6b', color: '#12060a', border: 0, borderRadius: 8, padding: '4px 9px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
                            >
                              Confirmer
                            </button>
                          </div>
                        ))}
                        {(msg.avertissements || []).map((w) => (
                          <div key={w} style={{ fontSize: 11, opacity: 0.72 }}>{w}</div>
                        ))}
                      </div>
                    ) : null}
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

"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Circle, Trash2, Plus, Sparkles, LayoutList } from "lucide-react";
import TiltCard from "@/components/TiltCard";
import { useLanguage, t } from "@/utils/i18n";

export default function DashboardPage() {
  const lang = useLanguage();
  const [userName, setUserName] = useState("Utilisateur");
  const [homeworks, setHomeworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newSubj, setNewSubj] = useState("");
  const [newTask, setNewTask] = useState("");

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data: userData } = await supabase.from('users').select('first_name').eq('id', user.id).single();
    if (userData?.first_name) setUserName(userData.first_name);

    const { data: hwData } = await supabase.from('homework').select('*').order('created_at', { ascending: false });
    if (hwData) setHomeworks(hwData);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const addHomework = async () => {
    if (!newSubj || !newTask) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('homework').insert([{ user_id: user.id, subject: newSubj, task: newTask, is_done: false }]);
    setNewSubj(""); setNewTask(""); loadData();
  };

  const toggleHomework = async (id, currentStatus) => {
    await supabase.from('homework').update({ is_done: !currentStatus }).eq('id', id);
    loadData();
  };

  const deleteHomework = async (id) => {
    await supabase.from('homework').delete().eq('id', id);
    loadData();
  };

  const productivity = homeworks.length > 0 ? (homeworks.filter(h => h.is_done).length / homeworks.length * 100).toFixed(0) : 0;
  const remaining = homeworks.filter(h => !h.is_done).length;

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" style={{ maxWidth: '900px', margin: '0 auto', direction: lang === 'ar' ? 'rtl' : 'ltr' }}>
      
      <TiltCard delay={0.1} style={{ marginBottom: 40, background: 'linear-gradient(135deg, rgba(46,91,255,0.1), rgba(0,210,182,0.1))', padding: 30, borderRadius: 24, border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
        <Sparkles size={120} style={{ position: 'absolute', right: lang === 'ar' ? 'auto' : -20, left: lang === 'ar' ? -20 : 'auto', top: -20, color: 'rgba(0,210,182,0.1)', transform: 'rotate(15deg)' }} />
        <h1 style={{ fontSize: 32, marginBottom: 8, color: '#fff' }}>{t(lang, 'hello')}, <span style={{ color: 'var(--a)' }}>{userName}</span> 👋</h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16 }}>{t(lang, 'ready')}</p>
      </TiltCard>

      <motion.div variants={itemVariants} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 40 }}>
        <TiltCard delay={0.2} className="stat-card" style={{ padding: 24, textAlign: 'center', borderRadius: 20 }}>
          <div style={{ fontSize: 40, fontWeight: 700, color: 'var(--a)', fontFamily: 'Cinzel', marginBottom: 4 }}>{productivity}%</div>
          <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{t(lang, 'productivity')}</div>
        </TiltCard>
        <TiltCard delay={0.3} className="stat-card" style={{ padding: 24, textAlign: 'center', borderRadius: 20 }}>
          <div style={{ fontSize: 40, fontWeight: 700, color: 'var(--p)', fontFamily: 'Cinzel', marginBottom: 4 }}>{remaining}</div>
          <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{t(lang, 'remaining_hw')}</div>
        </TiltCard>
      </motion.div>

      <motion.div variants={itemVariants} className="card" style={{ padding: 30, borderRadius: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <LayoutList color="var(--a)" />
          <h3 style={{ fontSize: 20, fontWeight: 600, color: '#fff' }}>{t(lang, 'hw_list')}</h3>
        </div>
        
        <div style={{ display: 'flex', gap: 12, marginBottom: 30 }}>
          <input className="fi" style={{ flex: 1, height: 44 }} placeholder={t(lang, 'subject_ph')} value={newSubj} onChange={(e) => setNewSubj(e.target.value)} />
          <input className="fi" style={{ flex: 2, height: 44 }} placeholder={t(lang, 'task_ph')} value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addHomework()} />
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn" style={{ height: 44, padding: '0 20px', borderRadius: 10 }} onClick={addHomework}>
            <Plus size={18} /> {t(lang, 'btn_add')}
          </motion.button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
             <div className="empty-state">{t(lang, 'loading_hw')}</div>
          ) : homeworks.length === 0 ? (
             <div className="empty-state" style={{ padding: 40 }}>{t(lang, 'empty_hw')}</div>
          ) : (
            <AnimatePresence>
              {homeworks.map(hw => (
                <motion.div 
                  key={hw.id}
                  initial={{ opacity: 0, height: 0, scale: 0.9 }}
                  animate={{ opacity: hw.is_done ? 0.6 : 1, height: 'auto', scale: 1 }}
                  exit={{ opacity: 0, x: -50, height: 0, overflow: 'hidden' }}
                  transition={{ duration: 0.3 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'rgba(255,255,255,0.03)', padding: '16px 20px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <motion.div whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }} onClick={() => toggleHomework(hw.id, hw.is_done)} style={{ cursor: 'pointer', color: hw.is_done ? 'var(--ok)' : 'rgba(255,255,255,0.3)' }}>
                    {hw.is_done ? <Check size={24} /> : <Circle size={24} />}
                  </motion.div>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: 'var(--a)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>{hw.subject}</div>
                    <div style={{ fontSize: 16, color: '#fff', textDecoration: hw.is_done ? 'line-through' : 'none' }}>{hw.task}</div>
                  </div>
                  
                  <motion.button whileHover={{ scale: 1.1, color: 'var(--err)' }} whileTap={{ scale: 0.9 }} onClick={() => deleteHomework(hw.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer' }}>
                    <Trash2 size={18} />
                  </motion.button>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

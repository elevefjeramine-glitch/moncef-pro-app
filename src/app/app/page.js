"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Circle, Trash2, Plus, Sparkles, LayoutList, Clock, AlertTriangle, ChevronDown, ChevronUp, X, User as UserIcon, BookOpen, CalendarDays, Flag, BarChart3 } from "lucide-react";
import TiltCard from "@/components/TiltCard";
import { useLanguage, t } from "@/utils/i18n";

import { Skeleton } from "@/components/ui/Skeleton";
import { useUserStore } from "@/store/useUserStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function DashboardPage() {
  const lang = useLanguage();
  const queryClient = useQueryClient();
  const { user } = useUserStore();

  // Translation-aware configs (must live inside component to use t())
  const PRIORITY_CONFIG = {
    urgent: { label: t(lang,'hw_urgent'), color: '#ff4757', bg: 'rgba(255,71,87,0.15)', border: 'rgba(255,71,87,0.4)' },
    normal: { label: t(lang,'hw_normal'), color: '#ffa502', bg: 'rgba(255,165,2,0.1)',  border: 'rgba(255,165,2,0.25)' },
    low:    { label: t(lang,'hw_low'),    color: '#2ed573', bg: 'rgba(46,213,115,0.1)', border: 'rgba(46,213,115,0.25)' }
  };
  const STATUS_CONFIG = {
    todo:        { label: t(lang,'hw_todo'),        icon: '📋', color: 'rgba(255,255,255,0.6)' },
    in_progress: { label: t(lang,'hw_in_progress'), icon: '⏳', color: 'var(--a)' },
    done:        { label: t(lang,'hw_done'),         icon: '✅', color: 'var(--ok)' },
    forgotten:   { label: t(lang,'hw_forgotten'),   icon: '💤', color: 'rgba(255,255,255,0.3)' }
  };

  const userName = user?.first_name || "Utilisateur";
  const [showForm, setShowForm] = useState(false);
  const [cleanedCount, setCleanedCount] = useState(0);

  // Inline edit states
  const [editingDateId, setEditingDateId] = useState(null);
  const [editingProgId, setEditingProgId] = useState(null);

  // Form states
  const [newSubj, setNewSubj] = useState("");
  const [newTask, setNewTask] = useState("");
  const [newTeacher, setNewTeacher] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newPriority, setNewPriority] = useState("normal");
  const [newStatus, setNewStatus] = useState("todo");
  const [newProgression, setNewProgression] = useState(0);

  // React Query pour le chargement et cache des devoirs
  const { data: homeworks = [], isLoading: loading } = useQuery({
    queryKey: ['homeworks', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('homework').select('*').order('created_at', { ascending: false });
      if (!data) return [];
      
      const today = new Date().toISOString().split('T')[0];
      const expired = data.filter(hw => hw.due_date && hw.due_date < today && (hw.status === 'done' || hw.is_done));
      
      if (expired.length > 0) {
        for (const hw of expired) {
          await supabase.from('homework').delete().eq('id', hw.id);
        }
        setCleanedCount(expired.length);
        setTimeout(() => setCleanedCount(0), 5000);
        
        // Re-fetch clean data
        const { data: fresh } = await supabase.from('homework').select('*').order('created_at', { ascending: false });
        return fresh || [];
      }
      return data;
    },
    enabled: !!user?.id, // Ne lance la requête que si l'utilisateur est connu
  });

  const addHomework = async () => {
    if (!newSubj || !newTask) return;
    if (!user) return;
    
    await supabase.from('homework').insert([{ 
      user_id: user.id, 
      subject: newSubj, 
      task: newTask,
      teacher: newTeacher,
      due_date: newDueDate || null,
      priority: newPriority,
      status: newStatus,
      progression: newProgression,
      is_done: newStatus === 'done'
    }]);
    
    // Reset form
    setNewSubj(""); setNewTask(""); setNewTeacher(""); 
    setNewDueDate(""); setNewPriority("normal"); setNewStatus("todo"); 
    setNewProgression(0); setShowForm(false);
    queryClient.invalidateQueries(['homeworks', user.id]);
  };

  const updateHomework = async (id, updates) => {
    if (updates.status === 'done') {
      updates.is_done = true;
      updates.progression = 100;
    }
    if (updates.status && updates.status !== 'done') {
      updates.is_done = false;
    }
    await supabase.from('homework').update(updates).eq('id', id);
    queryClient.invalidateQueries(['homeworks', user?.id]);
  };

  const deleteHomework = async (id) => {
    if (!window.confirm(t(lang, 'hw_confirm_delete'))) return;
    await supabase.from('homework').delete().eq('id', id);
    queryClient.invalidateQueries(['homeworks', user?.id]);
  };

  const getDaysRemaining = (dueDate) => {
    if (!dueDate) return null;
    const today = new Date();
    today.setHours(0,0,0,0);
    const due = new Date(dueDate);
    const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const productivity = homeworks.length > 0 ? (homeworks.filter(h => h.is_done || h.status === 'done').length / homeworks.length * 100).toFixed(0) : 0;
  const remaining = homeworks.filter(h => !h.is_done && h.status !== 'done').length;
  const urgentCount = homeworks.filter(h => h.priority === 'urgent' && h.status !== 'done').length;

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" style={{ maxWidth: '900px', margin: '0 auto', direction: lang === 'ar' ? 'rtl' : 'ltr' }}>
      
      {/* Bug #6 fix: Auto-clean toast notification */}
      <AnimatePresence>
        {cleanedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, background: 'rgba(46,213,115,0.15)', border: '1px solid rgba(46,213,115,0.4)', borderRadius: 14, padding: '12px 20px', color: '#2ed573', fontSize: 14, fontWeight: 600, backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            🧹 {cleanedCount} {t(lang,'hw_auto_cleaned')}
          </motion.div>
        )}
      </AnimatePresence>
      
      <TiltCard delay={0.1} style={{ marginBottom: 40, background: 'linear-gradient(135deg, rgba(46,91,255,0.1), rgba(0,210,182,0.1))', padding: 30, borderRadius: 24, border: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}>
        <Sparkles size={120} style={{ position: 'absolute', right: lang === 'ar' ? 'auto' : -20, left: lang === 'ar' ? -20 : 'auto', top: -20, color: 'rgba(0,210,182,0.1)', transform: 'rotate(15deg)' }} />
        <h1 style={{ fontSize: 32, marginBottom: 8, color: '#fff' }}>{t(lang, 'hello')}, <span style={{ color: 'var(--a)' }}>{userName}</span> 👋</h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16 }}>{t(lang, 'ready')}</p>
      </TiltCard>

      <motion.div variants={itemVariants} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20, marginBottom: 40 }}>
        <TiltCard delay={0.2} className="stat-card" style={{ padding: 24, textAlign: 'center', borderRadius: 20 }}>
          <div style={{ fontSize: 40, fontWeight: 700, color: 'var(--a)', fontFamily: 'Cinzel', marginBottom: 4 }}>{productivity}%</div>
          <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{t(lang, 'productivity')}</div>
        </TiltCard>
        <TiltCard delay={0.3} className="stat-card" style={{ padding: 24, textAlign: 'center', borderRadius: 20 }}>
          <div style={{ fontSize: 40, fontWeight: 700, color: 'var(--p)', fontFamily: 'Cinzel', marginBottom: 4 }}>{remaining}</div>
          <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{t(lang, 'remaining_hw')}</div>
        </TiltCard>
        {urgentCount > 0 && (
          <TiltCard delay={0.35} className="stat-card" style={{ padding: 24, textAlign: 'center', borderRadius: 20, border: '1px solid rgba(255,71,87,0.3)' }}>
            <div style={{ fontSize: 40, fontWeight: 700, color: '#ff4757', fontFamily: 'Cinzel', marginBottom: 4 }}>{urgentCount}</div>
            <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,71,87,0.7)', fontWeight: 600 }}>🔴 {t(lang,'hw_urgents')}</div>
          </TiltCard>
        )}
      </motion.div>

      <motion.div variants={itemVariants} className="card" style={{ padding: 30, borderRadius: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LayoutList color="var(--a)" />
            <h3 style={{ fontSize: 20, fontWeight: 600, color: '#fff' }}>{t(lang, 'hw_list')}</h3>
          </div>
          <motion.button 
            whileHover={{ scale: 1.05 }} 
            whileTap={{ scale: 0.95 }} 
            className="btn" 
            style={{ height: 44, padding: '0 20px', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 8 }} 
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? <ChevronUp size={18} /> : <Plus size={18} />}
            {showForm ? t(lang,'btn_close') : t(lang, 'btn_add')}
          </motion.button>
        </div>

        {/* ============ ADD HOMEWORK FORM ============ */}
        <AnimatePresence>
          {showForm && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }} 
              animate={{ opacity: 1, height: 'auto' }} 
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden', marginBottom: 30 }}
            >
              <div style={{ 
                padding: 24, 
                background: 'linear-gradient(135deg, rgba(46,91,255,0.08), rgba(0,210,182,0.05))', 
                border: '1px solid rgba(255,255,255,0.08)', 
                borderRadius: 20,
                display: 'flex', flexDirection: 'column', gap: 16
              }}>
                {/* Row 1: Subject + Teacher */}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 200px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--a)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 1 }}>
                      <BookOpen size={13} /> {t(lang,'hw_subject')} *
                    </label>
                    <input className="fi" placeholder={t(lang,'hw_ex_subj')} value={newSubj} onChange={e => setNewSubj(e.target.value)} style={{ height: 44 }} />
                  </div>
                  <div style={{ flex: '1 1 200px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--a)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 1 }}>
                      <UserIcon size={13} /> {t(lang,'hw_teacher')}
                    </label>
                    <input className="fi" placeholder={t(lang,'hw_ex_teacher')} value={newTeacher} onChange={e => setNewTeacher(e.target.value)} style={{ height: 44 }} />
                  </div>
                </div>

                {/* Row 2: Task */}
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--a)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 1 }}>
                    📝 {t(lang,'hw_task')} *
                  </label>
                  <input className="fi" placeholder={t(lang,'task_ph')} value={newTask} onChange={e => setNewTask(e.target.value)} style={{ height: 44 }} />
                </div>

                {/* Row 3: Due Date + Priority + Status */}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 180px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--a)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 1 }}>
                      <CalendarDays size={13} /> {t(lang,'hw_due_date')}
                    </label>
                    <input className="fi" type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} style={{ height: 44, colorScheme: 'dark' }} />
                  </div>
                  <div style={{ flex: '1 1 150px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--a)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 1 }}>
                      <Flag size={13} /> {t(lang,'hw_priority')}
                    </label>
                    <select className="fi" value={newPriority} onChange={e => setNewPriority(e.target.value)} style={{ height: 44, appearance: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.3)' }}>
                      <option value="urgent" style={{ color: '#000' }}>{t(lang,'hw_urgent')}</option>
                      <option value="normal" style={{ color: '#000' }}>{t(lang,'hw_normal')}</option>
                      <option value="low" style={{ color: '#000' }}>{t(lang,'hw_low')}</option>
                    </select>
                  </div>
                  <div style={{ flex: '1 1 150px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--a)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 1 }}>
                      📊 {t(lang,'hw_status')}
                    </label>
                    <select className="fi" value={newStatus} onChange={e => setNewStatus(e.target.value)} style={{ height: 44, appearance: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.3)' }}>
                      <option value="todo" style={{ color: '#000' }}>{t(lang,'hw_todo')}</option>
                      <option value="in_progress" style={{ color: '#000' }}>{t(lang,'hw_in_progress')}</option>
                      <option value="done" style={{ color: '#000' }}>{t(lang,'hw_done')}</option>
                      <option value="forgotten" style={{ color: '#000' }}>{t(lang,'hw_forgotten')}</option>
                    </select>
                  </div>
                </div>

                {/* Row 4: Progression */}
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: 'var(--a)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 1 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><BarChart3 size={13} /> {t(lang,'hw_progression')}</span>
                    <span style={{ color: '#fff', fontSize: 14 }}>{newProgression}%</span>
                  </label>
                  <div style={{ position: 'relative', height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${newProgression}%`, background: 'linear-gradient(90deg, var(--p), var(--a))', borderRadius: 10, transition: 'width 0.3s' }} />
                  </div>
                  <input type="range" min="0" max="100" step="5" value={newProgression} onChange={e => setNewProgression(Number(e.target.value))} style={{ width: '100%', marginTop: 8, accentColor: 'var(--a)' }} />
                </div>

                {/* Submit */}
                <motion.button 
                  whileHover={{ scale: 1.02 }} 
                  whileTap={{ scale: 0.98 }} 
                  className="btn" 
                  style={{ height: 50, borderRadius: 14, fontSize: 16, fontWeight: 700, gap: 10 }} 
                  onClick={addHomework}
                >
                  <Plus size={20} /> {t(lang,'btn_add')} {t(lang,'hw_task')}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ============ HOMEWORK LIST ============ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {loading ? (
             <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
               <Skeleton style={{ height: 120, borderRadius: 18 }} />
               <Skeleton style={{ height: 120, borderRadius: 18 }} />
               <Skeleton style={{ height: 120, borderRadius: 18 }} />
             </div>
          ) : homeworks.length === 0 ? (
             <div className="empty-state" style={{ padding: 40, border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
               <div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div>
               <div style={{ color: '#fff', fontWeight: 600 }}>{t(lang, 'empty_hw')}</div>
             </div>
          ) : (
            <AnimatePresence>
              {homeworks.map(hw => {
                const pConfig = PRIORITY_CONFIG[hw.priority] || PRIORITY_CONFIG.normal;
                const sConfig = STATUS_CONFIG[hw.status] || STATUS_CONFIG.todo;
                const daysRemaining = getDaysRemaining(hw.due_date);
                const isOverdue = daysRemaining !== null && daysRemaining < 0;
                const isDueSoon = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 2;
                const prog = hw.progression || 0;

                return (
                  <motion.div 
                    key={hw.id}
                    initial={{ opacity: 0, height: 0, scale: 0.95 }}
                    animate={{ opacity: hw.status === 'done' ? 0.6 : 1, height: 'auto', scale: 1 }}
                    exit={{ opacity: 0, x: -50, height: 0, overflow: 'hidden' }}
                    transition={{ duration: 0.3 }}
                    style={{ 
                      background: pConfig.bg, 
                      padding: '18px 20px', 
                      borderRadius: 18, 
                      border: `1px solid ${pConfig.border}`,
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Priority bar */}
                    <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', background: pConfig.color }} />

                    {/* Main content */}
                    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                      
                      {/* Toggle done */}
                      <motion.div 
                        whileHover={{ scale: 1.2 }} 
                        whileTap={{ scale: 0.9 }} 
                        onClick={() => updateHomework(hw.id, { status: hw.status === 'done' ? 'todo' : 'done' })} 
                        style={{ cursor: 'pointer', color: hw.status === 'done' ? 'var(--ok)' : 'rgba(255,255,255,0.3)', marginTop: 2, flexShrink: 0 }}
                      >
                        {hw.status === 'done' ? <Check size={24} /> : <Circle size={24} />}
                      </motion.div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Subject + Teacher row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, color: pConfig.color, fontWeight: 700, textTransform: 'uppercase' }}>{hw.subject}</span>
                          {hw.teacher && (
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <UserIcon size={10} /> {hw.teacher}
                            </span>
                          )}
                        </div>

                        {/* Task */}
                        <div style={{ fontSize: 15, color: '#fff', textDecoration: hw.status === 'done' ? 'line-through' : 'none', marginBottom: 8 }}>
                          {hw.task}
                        </div>

                        {/* Tags row */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          {/* Priority badge */}
                          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', color: pConfig.color, fontWeight: 600 }}>
                            {pConfig.label}
                          </span>

                          {/* Status badge */}
                          <select 
                            value={hw.status || 'todo'} 
                            onChange={e => updateHomework(hw.id, { status: e.target.value })}
                            style={{ fontSize: 11, padding: '3px 8px', borderRadius: 8, background: 'rgba(0,0,0,0.3)', color: sConfig.color, border: 'none', cursor: 'pointer', fontWeight: 600, outline: 'none' }}
                          >
                            <option value="todo" style={{ color: '#000' }}>{t(lang,'hw_todo')}</option>
                            <option value="in_progress" style={{ color: '#000' }}>{t(lang,'hw_in_progress')}</option>
                            <option value="done" style={{ color: '#000' }}>{t(lang,'hw_done')}</option>
                            <option value="forgotten" style={{ color: '#000' }}>{t(lang,'hw_forgotten')}</option>
                          </select>

                          {/* Due date — cliquable pour éditer */}
                          {editingDateId === hw.id ? (
                            <input
                              type="date"
                              defaultValue={hw.due_date || ''}
                              autoFocus
                              onBlur={e => { updateHomework(hw.id, { due_date: e.target.value || null }); setEditingDateId(null); }}
                              onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingDateId(null); }}
                              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 8, background: 'rgba(0,0,0,0.5)', color: '#fff', border: '1px solid var(--a)', colorScheme: 'dark', outline: 'none' }}
                            />
                          ) : (
                            <span
                              onClick={() => setEditingDateId(hw.id)}
                              title="Cliquer pour modifier la date"
                              style={{ 
                                fontSize: 11, padding: '3px 10px', borderRadius: 8, 
                                background: isOverdue ? 'rgba(255,71,87,0.3)' : isDueSoon ? 'rgba(255,165,2,0.3)' : 'rgba(0,0,0,0.3)', 
                                color: isOverdue ? '#ff4757' : isDueSoon ? '#ffa502' : 'rgba(255,255,255,0.5)', 
                                fontWeight: 600,
                                display: 'flex', alignItems: 'center', gap: 4,
                                cursor: 'pointer',
                                border: '1px solid transparent'
                              }}
                            >
                              <Clock size={10} />
                              {hw.due_date
                                ? isOverdue 
                                  ? `${t(lang,'hw_overdue')} ${Math.abs(daysRemaining)}j`
                                  : daysRemaining === 0
                                    ? t(lang,'hw_due_today')
                                    : daysRemaining === 1
                                      ? t(lang,'hw_due_tomorrow')
                                      : `${daysRemaining} ${t(lang,'hw_days_left')}`
                                : `📅 ${t(lang,'hw_add_date')}`
                              }
                            </span>
                          )}
                        </div>

                        {/* Progression — slider inline */}
                        <div style={{ marginTop: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <BarChart3 size={10} /> {t(lang,'hw_progression')}
                            </span>
                            <span
                              onClick={() => setEditingProgId(editingProgId === hw.id ? null : hw.id)}
                              style={{ fontSize: 11, color: 'var(--a)', fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}
                              title="Cliquer pour modifier"
                            >
                              {prog}%
                            </span>
                          </div>
                          <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}>
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${prog}%` }}
                              style={{ height: '100%', background: 'linear-gradient(90deg, var(--p), var(--a))', borderRadius: 10 }} 
                            />
                          </div>
                          {editingProgId === hw.id && (
                            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} style={{ marginTop: 8 }}>
                              <input
                                type="range" min="0" max="100" step="5"
                                defaultValue={prog}
                                onMouseUp={e => { updateHomework(hw.id, { progression: Number(e.target.value) }); setEditingProgId(null); }}
                                onTouchEnd={e => { updateHomework(hw.id, { progression: Number(e.target.value) }); setEditingProgId(null); }}
                                style={{ width: '100%', accentColor: 'var(--a)', cursor: 'pointer' }}
                              />
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                                <span>0%</span><span>50%</span><span>100%</span>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      </div>

                      {/* Delete button */}
                      <motion.button 
                        whileHover={{ scale: 1.1, color: 'var(--err)' }} 
                        whileTap={{ scale: 0.9 }} 
                        onClick={() => deleteHomework(hw.id)} 
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', flexShrink: 0, marginTop: 2 }}
                      >
                        <Trash2 size={18} />
                      </motion.button>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { Plus, Trash2, Calendar, Clock, BookOpen } from "lucide-react";
import { useLanguage, t } from "@/utils/i18n";

export default function SchedulePage() {
  const lang = useLanguage();
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const DAYS = [t(lang, 'd0'), t(lang, 'd1'), t(lang, 'd2'), t(lang, 'd3'), t(lang, 'd4'), t(lang, 'd5'), t(lang, 'd6')];
  
  // States for adding a new slot
  const [selectedDay, setSelectedDay] = useState(0);
  const [newSubj, setNewSubj] = useState("");
  const [newTime, setNewTime] = useState("");

  const loadSchedule = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data } = await supabase.from('schedule').select('*').order('time_slot', { ascending: true });
    if (data) setSchedule(data);
    setLoading(false);
  };

  useEffect(() => { loadSchedule(); }, []);

  const addSlot = async () => {
    if (!newSubj || !newTime) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    await supabase.from('schedule').insert([
      { user_id: user.id, day_index: selectedDay, subject: newSubj, time_slot: newTime }
    ]);
    
    setNewSubj("");
    setNewTime("");
    loadSchedule();
  };

  const deleteSlot = async (id) => {
    await supabase.from('schedule').delete().eq('id', id);
    loadSchedule();
  };

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      
      <motion.div variants={itemVariants} className="card" style={{ padding: '30px', borderRadius: '24px', marginBottom: '30px', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-end', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--a)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 }}><Calendar size={14} style={{ display:'inline', verticalAlign:'middle', marginRight:4 }}/> {t(lang, 'sch_day')}</label>
          <select className="fi" value={selectedDay} onChange={(e) => setSelectedDay(Number(e.target.value))} style={{ appearance: 'none', background: 'rgba(0,0,0,0.3)', cursor: 'pointer' }}>
            {DAYS.map((d, i) => <option key={i} value={i} style={{ color: '#000' }}>{d}</option>)}
          </select>
        </div>
        
        <div style={{ flex: '2 1 200px' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--a)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 }}><Clock size={14} style={{ display:'inline', verticalAlign:'middle', marginRight:4 }}/> {t(lang, 'sch_time')}</label>
          <input className="fi" placeholder={t(lang, 'sch_time_ph')} value={newTime} onChange={(e) => setNewTime(e.target.value)} />
        </div>

        <div style={{ flex: '3 1 250px' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--a)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 }}><BookOpen size={14} style={{ display:'inline', verticalAlign:'middle', marginRight:4 }}/> {t(lang, 'sch_subj')}</label>
          <input className="fi" placeholder={t(lang, 'sch_subj_ph')} value={newSubj} onChange={(e) => setNewSubj(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSlot()} />
        </div>

        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn" style={{ height: 50, padding: '0 24px', flex: '0 0 auto' }} onClick={addSlot}>
          <Plus size={18} /> {t(lang, 'sch_add')}
        </motion.button>
      </motion.div>

      <motion.div variants={itemVariants} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {DAYS.map((day, i) => {
          const slots = schedule.filter(s => s.day_index === i);
          
          return (
            <div key={i} className="card" style={{ padding: '24px', borderRadius: '20px', minHeight: '300px' }}>
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '18px', color: '#fff', fontWeight: 600 }}>{day}</h3>
                <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '12px', color: 'rgba(255,255,255,0.6)' }}>{slots.length} {t(lang, 'sch_courses')}</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {loading ? (
                  <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '13px', padding: '20px 0' }}>{t(lang, 'sch_loading')}</div>
                ) : slots.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '13px', fontStyle: 'italic', padding: '20px 0' }}>{t(lang, 'sch_empty')}</div>
                ) : (
                  <AnimatePresence>
                    {slots.map(slot => (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.8 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        exit={{ opacity: 0, scale: 0.8, height: 0, overflow: 'hidden' }}
                        key={slot.id} 
                        style={{ background: 'linear-gradient(135deg, rgba(46,91,255,0.15), rgba(46,91,255,0.05))', border: '1px solid rgba(46,91,255,0.3)', borderRadius: '12px', padding: '12px 14px', position: 'relative', overflow: 'hidden' }}
                      >
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--p)' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{slot.subject}</div>
                            <div style={{ fontSize: 11, color: 'var(--a)', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12}/> {slot.time_slot}</div>
                          </div>
                          <motion.button whileHover={{ scale: 1.1, color: 'var(--err)' }} onClick={() => deleteSlot(slot.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 4 }}>
                            <Trash2 size={16} />
                          </motion.button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </div>
          )
        })}
      </motion.div>

    </motion.div>
  );
}

"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Users, Activity } from "lucide-react";

export default function CommPage() {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [newMsg, setNewMsg] = useState("");
  const messagesEndRef = useRef(null);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Load current user
    const { data: cUser } = await supabase.from('users').select('*').eq('id', user.id).single();
    if (cUser) setCurrentUser({ id: user.id, ...cUser });

    // Load active users
    const { data: uData } = await supabase.from('users').select('*');
    if (uData) setUsers(uData);

    // Load messages
    const { data: mData } = await supabase.from('user_messages').select('*').order('created_at', { ascending: true });
    if (mData) setMessages(mData);
    
    scrollToBottom();
  };

  useEffect(() => {
    loadData();
    // Realtime mapping pour être "parfaitement ordonné"
    const msgsChannel = supabase.channel('realtime:user_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_messages' }, payload => {
        setMessages(prev => [...prev, payload.new]);
        scrollToBottom();
      })
      .subscribe();
      
    return () => { supabase.removeChannel(msgsChannel); };
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, 100);
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !currentUser) return;
    const msg = newMsg;
    setNewMsg(""); // clear immediate
    await supabase.from('user_messages').insert([{ user_id: currentUser.id, content: msg, sender_name: currentUser.first_name || 'Anonyme' }]);
  };

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 300px) 1fr', gap: '24px', height: '100%' }}>
      
      {/* Panneau gauche : Membres */}
      <motion.div variants={itemVariants} className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%', borderRadius: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Users color="var(--a)" />
          <h3 style={{ fontSize: '18px', color: '#fff', fontWeight: 600 }}>Membres Actifs</h3>
        </div>
        
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {users.map(u => (
            <motion.div whileHover={{ scale: 1.02 }} key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--p), var(--a))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                {u.first_name ? u.first_name[0] : (u.email ? u.email[0].toUpperCase() : '?')}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{u.first_name || 'Utilisateur'}</div>
                <div style={{ fontSize: '11px', color: u.role === 'founder' ? 'var(--gold)' : 'var(--p)' }}>{u.role === 'founder' ? '👑 Fondateur' : 'Membre'}</div>
              </div>
              <Activity size={14} color="var(--ok)" />
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Panneau droit : Chat */}
      <motion.div variants={itemVariants} className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRadius: '24px', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h3 style={{ fontSize: '18px', margin: 0, color: '#fff' }}>Salon Principal</h3>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>Discussion générale avec sauvegarde en temps réel</p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <AnimatePresence>
            {messages.map((msg, idx) => {
              const isMe = currentUser && msg.user_id === currentUser.id;
              
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  key={msg.id || idx}
                  style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%', display: 'flex', flexDirection: 'column' }}
                >
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px', textAlign: isMe ? 'right' : 'left', alignSelf: isMe ? 'flex-end' : 'flex-start' }}>
                    {msg.sender_name}
                  </span>
                  <div style={{ 
                    padding: '12px 18px', 
                    borderRadius: '18px', 
                    borderBottomRightRadius: isMe ? '4px' : '18px',
                    borderBottomLeftRadius: !isMe ? '4px' : '18px',
                    background: isMe ? 'var(--p)' : 'rgba(255,255,255,0.05)',
                    border: isMe ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    fontSize: '14.5px',
                    lineHeight: '1.5',
                    boxShadow: isMe ? '0 4px 15px rgba(46,91,255,0.3)' : 'none'
                  }}>
                    {msg.content}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        <div style={{ padding: '20px', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input 
              className="fi" 
              style={{ flex: 1, borderRadius: '20px' }} 
              placeholder="Écrivez un message ici..." 
              value={newMsg} 
              onChange={(e) => setNewMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            />
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn" style={{ width: '50px', height: '50px', borderRadius: '50%', padding: 0 }} onClick={sendMessage}>
              <Send size={18} />
            </motion.button>
          </div>
        </div>
      </motion.div>

    </motion.div>
  );
}

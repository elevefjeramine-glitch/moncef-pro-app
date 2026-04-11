"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Crown, Sparkles, User, RefreshCw, Terminal } from "lucide-react";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function AlphaPage() {
  const router = useRouter();
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '👑 Bienvenue, ALPHA. Interface d\'administration supérieure activée. En attente de vos directives.' }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [isFounder, setIsFounder] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth'); return; }
      const { data } = await supabase.from('users').select('role').eq('id', user.id).single();
      if (data && data.role === 'founder') {
        setIsFounder(true);
      } else {
        router.push('/app'); // Redirect if not founder
      }
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    
    const userMsg = input.trim();
    setInput("");
    
    const newContext = [...messages, { role: 'user', content: userMsg }];
    setMessages(newContext);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          model: 'claude-haiku-4-5-20251001',
          messages: newContext.map(m => ({ role: m.role, content: m.content })),
          system: 'Tu es ALPHA AI, une IA supérieure créée exclusivement pour le fondateur du site. Tu gères la plateforme, analyses les données et exécutes les commandes d\'administration avec précision et loyauté absolue.'
        })
      });
      
      const data = await res.json();
      const aiReply = data.response || "Commande non reconnue.";
      
      setMessages(prev => [...prev, { role: 'assistant', content: aiReply }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: "Désolé, erreur système. Connexion ALPHA compromise." }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([{ role: 'assistant', content: 'Console réinitialisée. Prêt pour les nouvelles commandes ALPHA.' }]);
  };

  if (!isFounder && !loading) return null; // Avoid flashing UI before redirect

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '900px', margin: '0 auto', gap: '20px' }}>
      
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ padding: '24px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: 'linear-gradient(135deg, rgba(255,215,0,0.1), rgba(200,150,0,0.05))', border: '1px solid rgba(255,215,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '16px', background: 'linear-gradient(135deg, #FFD700, #FDB931)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', boxShadow: '0 0 25px rgba(255,215,0,0.4)' }}>
            <Crown size={28} />
          </div>
          <div>
            <h2 style={{ fontSize: '24px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#FFD700', textShadow: '0 0 10px rgba(255,215,0,0.3)' }}>
              ALPHA AI <Sparkles size={18} color="#FFD700" />
            </h2>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FFD700', boxShadow: '0 0 10px #FFD700' }} /> Accès Administrateur Global
            </div>
          </div>
        </div>
        <button onClick={clearChat} style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.2)', padding:'8px 12px', borderRadius: '12px', color: '#FFD700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold' }}>
          <RefreshCw size={14} /> Clear Console
        </button>
      </motion.div>

      <div className="card" style={{ flex: 1, borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid rgba(255,215,0,0.1)' }}>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '30px', display: 'flex', flexDirection: 'column', gap: '24px', background: 'rgba(5, 5, 5, 0.4)' }}>
          <AnimatePresence>
            {messages.map((msg, idx) => {
              const isAi = msg.role === 'assistant';
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  key={idx}
                  style={{ alignSelf: isAi ? 'flex-start' : 'flex-end', maxWidth: '85%', display: 'flex', gap: '12px' }}
                >
                  {isAi && (
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,215,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD700', flexShrink: 0, border: '1px solid rgba(255,215,0,0.3)' }}>
                      <Crown size={20} />
                    </div>
                  )}
                  
                  <div style={{ 
                    padding: '16px 20px', 
                    borderRadius: '20px', 
                    borderTopLeftRadius: isAi ? '4px' : '20px',
                    borderTopRightRadius: !isAi ? '4px' : '20px',
                    background: isAi ? 'rgba(255,215,0,0.05)' : 'linear-gradient(135deg, rgba(255,215,0,0.2), transparent)',
                    border: isAi ? '1px solid rgba(255,215,0,0.15)' : '1px solid rgba(255,215,0,0.4)',
                    color: isAi ? '#EEDD88' : '#fff',
                    fontSize: '15px',
                    lineHeight: '1.6',
                    boxShadow: !isAi ? '0 4px 15px rgba(255,215,0,0.1)' : 'inset 0 0 10px rgba(255,215,0,0.02)'
                  }}>
                    {msg.content}
                  </div>

                  {!isAi && (
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                      <User size={20} />
                    </div>
                  )}
                </motion.div>
              )
            })}
            {loading && messages.length > 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ alignSelf: 'flex-start', display: 'flex', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,215,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD700', border: '1px solid rgba(255,215,0,0.3)' }}>
                  <Crown size={20} />
                </div>
                <div style={{ padding: '16px 20px', borderRadius: '20px', borderTopLeftRadius: '4px', background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.15)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0 }} style={{ width: 6, height: 6, background: '#FFD700', borderRadius: '50%' }} />
                  <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} style={{ width: 6, height: 6, background: '#FFD700', borderRadius: '50%' }} />
                  <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }} style={{ width: 6, height: 6, background: '#FFD700', borderRadius: '50%' }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        <div style={{ padding: '20px 30px', background: 'rgba(0,0,0,0.6)', borderTop: '1px solid rgba(255,215,0,0.2)' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', background: 'rgba(255,215,0,0.03)', border: '1px solid rgba(255,215,0,0.2)', padding: '8px 8px 8px 24px', borderRadius: '24px', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)' }}>
            <Terminal size={18} color="#FFD700" style={{ opacity: 0.7 }} />
            <input 
              style={{ flex: 1, background: 'none', border: 'none', color: '#fff', fontSize: '15px', outline: 'none', fontFamily: 'monospace' }} 
              placeholder="Exécuter une commande ALPHA..." 
              value={input} 
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              disabled={loading}
            />
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} style={{ width: '48px', height: '48px', borderRadius: '18px', padding: 0, background: 'linear-gradient(135deg, #FFD700, #D4AF37)', color: '#000', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(255,215,0,0.3)' }} onClick={sendMessage} disabled={loading}>
              <Send size={20} style={{ marginLeft: '-2px' }} />
            </motion.button>
          </div>
          <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '11px', color: 'rgba(255,215,0,0.5)' }}>
            ⚡ Niveau d'accréditation : ALPHA. Toute action est enregistrée et irreversible.
          </div>
        </div>

      </div >
    </div >
  );
}

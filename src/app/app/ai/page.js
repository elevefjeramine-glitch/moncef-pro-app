"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, Sparkles, User, RefreshCw } from "lucide-react";
import { useLanguage, t } from "@/utils/i18n";

export default function AIPage() {
  const lang = useLanguage();
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Bonjour ! Je suis Moncef IA, votre assistant pédagogique propulsé par Claude. Comment puis-je vous aider aujourd\'hui ?' }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

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
          system: `Tu es Moncef IA, un assistant éducatif intelligent. IMPORTANT: You must reply entirely in the language corresponding to this code: ${lang}.`
        })
      });
      
      if (!res.ok) throw new Error("Erreur lors de la communication avec l'IA");
      
      const data = await res.json();
      const aiReply = data.response || "Désolé, je n'ai pas compris.";
      
      setMessages(prev => [...prev, { role: 'assistant', content: aiReply }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: "Désolé, une erreur technique est survenue. Vérifiez la connexion au proxy IA." }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([{ role: 'assistant', content: 'Discussion réinitialisée. En quoi puis-je vous aider ?' }]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '900px', margin: '0 auto', gap: '20px' }}>
      
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ padding: '24px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: 'linear-gradient(135deg, rgba(46,91,255,0.1), rgba(0,210,182,0.05))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '16px', background: 'var(--a)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', boxShadow: '0 0 20px rgba(0,210,182,0.4)' }}>
            <Bot size={28} />
          </div>
          <div>
            <h2 style={{ fontSize: '24px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              Moncef IA <Sparkles size={18} color="var(--a)" />
            </h2>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ok)' }} /> {t(lang, 'ai_status')}
            </div>
          </div>
        </div>
        <button onClick={clearChat} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <RefreshCw size={14} /> {t(lang, 'new_chat')}
        </button>
      </motion.div>

      <div className="card" style={{ flex: 1, borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '30px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(0,210,182,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--a)', flexShrink: 0 }}>
                      <Bot size={20} />
                    </div>
                  )}
                  
                  <div style={{ 
                    padding: '16px 20px', 
                    borderRadius: '20px', 
                    borderTopLeftRadius: isAi ? '4px' : '20px',
                    borderTopRightRadius: !isAi ? '4px' : '20px',
                    background: isAi ? 'rgba(255,255,255,0.03)' : 'var(--p)',
                    border: isAi ? '1px solid rgba(255,255,255,0.08)' : 'none',
                    color: '#fff',
                    fontSize: '15px',
                    lineHeight: '1.6',
                    boxShadow: !isAi ? '0 4px 15px rgba(46,91,255,0.2)' : 'none'
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
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ alignSelf: 'flex-start', display: 'flex', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(0,210,182,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--a)' }}>
                  <Bot size={20} />
                </div>
                <div style={{ padding: '16px 20px', borderRadius: '20px', borderTopLeftRadius: '4px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} style={{ width: 6, height: 6, background: 'var(--a)', borderRadius: '50%' }} />
                  <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} style={{ width: 6, height: 6, background: 'var(--a)', borderRadius: '50%' }} />
                  <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} style={{ width: 6, height: 6, background: 'var(--a)', borderRadius: '50%' }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        <div style={{ padding: '20px 30px', background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 8px 8px 24px', borderRadius: '24px' }}>
            <input 
              style={{ flex: 1, background: 'none', border: 'none', color: '#fff', fontSize: '15px', outline: 'none' }} 
              placeholder={t(lang, 'ai_placeholder')} 
              value={input} 
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              disabled={loading}
            />
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn" style={{ width: '48px', height: '48px', borderRadius: '18px', padding: 0 }} onClick={sendMessage} disabled={loading}>
              <Send size={20} style={{ marginLeft: lang === 'ar' ? '2px' : '-2px', transform: lang === 'ar' ? 'scaleX(-1)' : 'none' }} />
            </motion.button>
          </div>
          <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
            {t(lang, 'ai_disclaimer')}
          </div>
        </div>

      </div >
    </div >
  );
}

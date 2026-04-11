"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";

export default function CommunicationPage() {
  const [contacts, setContacts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [currentContact, setCurrentContact] = useState(null);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    // Aucune donnée factice (0 exemple). On récupère uniquement les vrais utilisateurs connectés de la DB.
    async function loadRealContacts() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoadingContacts(false);
        return;
      }
      // On va chercher les contacts réels depuis la DB Supabase (Table users)
      // Exclut l'utilisateur courant
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .neq('id', user.id);
        
      if (!error && data) {
        setContacts(data);
      }
      setLoadingContacts(false);
    }
    
    loadRealContacts();
  }, []);

  const loadMessages = async (contact) => {
    setCurrentContact(contact);
    setLoadingMessages(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Charger l'historique REEL des messages entre les deux utilisateurs
    const { data, error } = await supabase
      .from('user_messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${contact.id}),and(sender_id.eq.${contact.id},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data);
    }
    setLoadingMessages(false);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentContact) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const msg = {
      sender_id: user.id,
      receiver_id: currentContact.id,
      content: newMessage.trim(),
    };

    // Insertion directe en temps réel
    await supabase.from('user_messages').insert([msg]);
    
    setNewMessage("");
    // Recharger les messages pour voir le nouveau
    loadMessages(currentContact);
  };

  return (
    <div className="comm-layout" style={{ display: 'grid', gridTemplateColumns: '280px 1fr 300px', height: '100vh', padding: 0 }}>
      {/* Sidebar Contacts */}
      <div className="chat-sidebar">
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(26,60,255,.15)' }}>
          <input type="text" className="fi" placeholder="Rechercher un collègue..." />
        </div>
        <div className="chat-list" id="userList">
          {loadingContacts ? (
             <div className="empty-state"><div className="ei">⏳</div>Chargement des contacts réels...</div>
          ) : contacts.length === 0 ? (
             <div className="empty-state"><div className="ei">💬</div>Aucun contact trouvé dans la base</div>
          ) : (
            contacts.map(c => (
              <div key={c.id} className={`chat-item ${currentContact?.id === c.id ? 'active' : ''}`} onClick={() => loadMessages(c)}>
                <div className="chat-av">{c.first_name ? c.first_name[0] : '?'}</div>
                <div className="chat-info">
                  <div className="chat-name">{c.first_name} {c.last_name}</div>
                  <div className="chat-last">{c.email}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="chat-main">
        {currentContact ? (
          <>
            <div className="chat-hdr">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="chat-av" id="currChatAv">{currentContact.first_name[0]}</div>
                <div id="currChatName" style={{ fontWeight: 700 }}>{currentContact.first_name} {currentContact.last_name}</div>
              </div>
            </div>
            <div className="chat-msgs" id="commMsgs">
              {loadingMessages ? (
                <div className="empty-state">Chargement de l'historique...</div>
              ) : messages.length === 0 ? (
                <div className="empty-state"><div className="ei">💬</div>Aucune discussion pour l'instant. Dites bonjour !</div>
              ) : (
                messages.map(m => {
                  const isSentByMe = m.receiver_id === currentContact.id;
                  return (
                    <div key={m.id} className={`msg ${isSentByMe ? 'user' : 'ai'}`}>
                      <div className="msg-bubble">{m.content}</div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="chat-input-wrap">
              <div className="chat-input-box">
                <textarea className="chat-input" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Écrire un message..." rows="1"></textarea>
                <button className="chat-btn send" onClick={sendMessage}>➜</button>
              </div>
            </div>
          </>
        ) : (
          <div className="chat-msgs" style={{ justifyContent: 'center' }}>
            <div className="empty-state"><div className="ei">💬</div>Sélectionne un contact réel pour discuter</div>
          </div>
        )}
      </div>

      {/* Profil Panel */}
      <div className="prof-panel">
        {currentContact ? (
          <>
            <div className="prof-hdr">
              <div className="prof-av" style={{ background: 'var(--p)', display: 'flex', alignItems:'center', justifyContent: 'center', fontSize: '32px', fontWeight: 'bold' }}>
                {currentContact.first_name[0]}
              </div>
              <div className="prof-name">{currentContact.first_name} {currentContact.last_name}</div>
              <div className="prof-role">👤 Utilisateur Vérifié</div>
            </div>
            <div className="set-sec" style={{ padding: '15px', background: 'rgba(255,255,255,.02)' }}>
              <div style={{ fontSize: '12px', color: 'rgba(240,244,255,.4)', marginBottom: '4px' }}>Email</div>
              <div style={{ fontSize: '14px' }}>{currentContact.email}</div>
            </div>
          </>
        ) : (
           <div className="empty-state">Profil en attente</div>
        )}
      </div>
    </div>
  );
}

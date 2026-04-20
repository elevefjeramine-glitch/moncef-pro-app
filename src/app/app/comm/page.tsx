"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/utils/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Users, Plus, X, Search, MessageCircle, UserPlus, Hash, LogOut, Info, ChevronLeft } from "lucide-react";
import { useLanguage, t } from "@/utils/i18n";

export default function CommPage() {
  const lang = useLanguage();
  const [currentUser, setCurrentUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showNewDmModal, setShowNewDmModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const myIdRef = useRef(null); // Bug #4 fix: stable ref for realtime callback closure

  // ─── Load initial data ────────────────────────────────────
  const loadCurrentUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
    if (data) {
      myIdRef.current = user.id; // Bug #4 fix: store in ref so realtime callbacks see it
      setCurrentUser({ ...data, id: user.id });
      return user.id;
    }
    return null;
  }, []);

  const loadAllUsers = useCallback(async (myId) => {
    const { data } = await supabase.from('users').select('*').neq('id', myId);
    if (data) setAllUsers(data);
  }, []);

  const loadConversations = useCallback(async (myId) => {
    if (!myId) return;
    
    // Load conversations through membership
    const { data: memberships } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', myId);
    
    if (!memberships || memberships.length === 0) { setConversations([]); setLoading(false); return; }
    
    const convIds = memberships.map(m => m.conversation_id);
    
    const { data: convData } = await supabase
      .from('conversations')
      .select('*')
      .in('id', convIds)
      .order('created_at', { ascending: false });
    
    if (!convData) { setConversations([]); setLoading(false); return; }
    
    // For each conversation, load members and last message
    const enriched = await Promise.all(convData.map(async (conv) => {
      const { data: members } = await supabase
        .from('conversation_members')
        .select('user_id, role')
        .eq('conversation_id', conv.id);
      
      const { data: lastMsg } = await supabase
        .from('conversation_messages')
        .select('content, sender_id, created_at')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1);
      
      // For DMs, get the other person's info
      let dmPartner = null;
      if (conv.type === 'dm' && members) {
        const otherMember = members.find(m => m.user_id !== myId);
        if (otherMember) {
          const { data: partner } = await supabase.from('users').select('*').eq('id', otherMember.user_id).single();
          dmPartner = partner;
        }
      }
      
      // For groups, load all member user details
      let memberDetails = [];
      if (members) {
        const memberIds = members.map(m => m.user_id);
        const { data: memberUsers } = await supabase.from('users').select('*').in('id', memberIds);
        memberDetails = (memberUsers || []).map(u => ({
          ...u,
          role: members.find(m => m.user_id === u.id)?.role || 'member'
        }));
      }
      
      return {
        ...conv,
        members: memberDetails,
        memberIds: members ? members.map(m => m.user_id) : [],
        dmPartner,
        lastMessage: lastMsg?.[0] || null
      };
    }));
    
    // Sort by last message date
    enriched.sort((a, b) => {
      const aDate = a.lastMessage?.created_at || a.created_at;
      const bDate = b.lastMessage?.created_at || b.created_at;
      return new Date(bDate) - new Date(aDate);
    });
    
    setConversations(enriched);
    setLoading(false);
  }, []);

  const loadMessages = useCallback(async (convId) => {
    const { data } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    
    if (data) setMessages(data);
    scrollToBottom();
  }, []);

  // ─── Init & Realtime ────────────────────────────────────
  useEffect(() => {
    let myId = null;
    const init = async () => {
      myId = await loadCurrentUser();
      if (myId) {
        await loadAllUsers(myId);
        await loadConversations(myId);
      }
    };
    init();

    // Realtime for new messages — Bug #4 fix: use myIdRef.current instead of closure var
    const msgChannel = supabase.channel('realtime:conv_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_messages' }, (payload) => {
        const newMessage = payload.new;
        setMessages(prev => {
          if (prev.length > 0 && prev[0]?.conversation_id === newMessage.conversation_id) {
            if (prev.find(m => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          }
          return prev;
        });
        // Use ref — always has the correct userId even if init() hasn't resolved yet
        if (myIdRef.current) loadConversations(myIdRef.current);
        scrollToBottom();
      })
      .subscribe();

    return () => { supabase.removeChannel(msgChannel); };
  }, []);

  // ─── When active conversation changes, load messages ─────
  useEffect(() => {
    if (activeConv) {
      loadMessages(activeConv.id);
      inputRef.current?.focus();
    }
  }, [activeConv?.id]);

  const scrollToBottom = () => {
    setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, 120);
  };

  // ─── Send Message ─────────────────────────────────────────
  const sendMessage = async () => {
    if (!newMsg.trim() || !activeConv || !currentUser) return;
    const content = newMsg.trim();
    setNewMsg(""); 

    // Optimistic add
    const optimistic = {
      id: 'temp-' + Date.now(),
      conversation_id: activeConv.id,
      sender_id: currentUser.id,
      content,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimistic]);
    scrollToBottom();

    await supabase.from('conversation_messages').insert([{
      conversation_id: activeConv.id,
      sender_id: currentUser.id,
      content
    }]);

    // Refresh conversations to update last message
    loadConversations(currentUser.id);
  };

  // ─── Create DM ────────────────────────────────────────────
  const createDM = async (targetUser) => {
    if (!currentUser) return;
    
    // Check if DM already exists
    const existing = conversations.find(c => 
      c.type === 'dm' && c.dmPartner?.id === targetUser.id
    );
    if (existing) {
      setActiveConv(existing);
      setShowNewDmModal(false);
      return;
    }
    
    // Create conversation
    const { data: conv, error } = await supabase.from('conversations').insert([{
      type: 'dm',
      created_by: currentUser.id
    }]).select().single();
    
    if (error || !conv) { console.error('Error creating DM:', error); return; }
    
    // Add members
    await supabase.from('conversation_members').insert([
      { conversation_id: conv.id, user_id: currentUser.id, role: 'admin' },
      { conversation_id: conv.id, user_id: targetUser.id, role: 'member' }
    ]);
    
    // Refresh and select
    await loadConversations(currentUser.id);
    
    setActiveConv({
      ...conv,
      dmPartner: targetUser,
      members: [currentUser, targetUser],
      memberIds: [currentUser.id, targetUser.id],
      lastMessage: null
    });
    
    setShowNewDmModal(false);
  };

  // ─── Create Group ─────────────────────────────────────────
  const createGroup = async () => {
    if (!currentUser || !groupName.trim() || selectedUsers.length === 0) return;
    
    const { data: conv, error } = await supabase.from('conversations').insert([{
      type: 'group',
      name: groupName.trim(),
      created_by: currentUser.id
    }]).select().single();
    
    if (error || !conv) { console.error('Error creating group:', error); return; }
    
    // Add creator as admin + selected members
    const memberInserts = [
      { conversation_id: conv.id, user_id: currentUser.id, role: 'admin' },
      ...selectedUsers.map(u => ({ conversation_id: conv.id, user_id: u.id, role: 'member' }))
    ];
    
    await supabase.from('conversation_members').insert(memberInserts);
    
    // Refresh
    await loadConversations(currentUser.id);
    setGroupName("");
    setSelectedUsers([]);
    setShowNewGroupModal(false);
  };

  // ─── Leave Group ──────────────────────────────────────────
  const leaveGroup = async (convId) => {
    if (!currentUser) return;
    await supabase.from('conversation_members').delete()
      .eq('conversation_id', convId)
      .eq('user_id', currentUser.id);
    setActiveConv(null);
    setShowInfoPanel(false);
    loadConversations(currentUser.id);
  };

  // ─── Helpers ──────────────────────────────────────────────
  const getConvName = (conv) => {
    if (conv.type === 'dm') return conv.dmPartner ? `${conv.dmPartner.first_name || ''} ${conv.dmPartner.last_name || ''}`.trim() || conv.dmPartner.email : 'Utilisateur';
    return conv.name || 'Groupe';
  };

  const getConvAvatar = (conv) => {
    if (conv.type === 'dm' && conv.dmPartner) {
      if (conv.dmPartner.avatar_url) return <img src={conv.dmPartner.avatar_url} alt="" />;
      return conv.dmPartner.first_name?.[0] || '?';
    }
    return conv.name?.[0] || '#';
  };

  const getLastMsgPreview = (conv) => {
    if (!conv.lastMessage) return t(lang, 'comm_no_msgs');
    const sender = allUsers.find(u => u.id === conv.lastMessage.sender_id);
    const senderName = conv.lastMessage.sender_id === currentUser?.id 
      ? t(lang, 'comm_you') 
      : (sender?.first_name || '');
    const content = conv.lastMessage.content.length > 35 
      ? conv.lastMessage.content.substring(0, 35) + '...' 
      : conv.lastMessage.content;
    return `${senderName}: ${content}`;
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return t(lang, 'comm_yesterday');
    if (diffDays < 7) return d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'short' });
    return d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: '2-digit', month: '2-digit' });
  };

  const formatMsgTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getDateLabel = (dateStr) => {
    // Bug #7 fix: don't mutate Date objects — create new ones for comparison
    const d = new Date(dateStr);
    const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const now = new Date();
    const nDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.floor((nDay - dDay) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return t(lang, 'comm_today');
    if (diffDays === 1) return t(lang, 'comm_yesterday');
    return new Date(dateStr).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const getSenderName = (senderId) => {
    if (senderId === currentUser?.id) return t(lang, 'comm_you');
    const user = allUsers.find(u => u.id === senderId);
    return user?.first_name || 'Utilisateur';
  };

  const filteredConversations = conversations.filter(c => {
    if (!searchQuery) return true;
    const name = getConvName(c).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  });

  const toggleUserSelection = (user) => {
    setSelectedUsers(prev => {
      const alreadySelected = prev.find(u => u.id === user.id);
      if (alreadySelected) return prev.filter(u => u.id !== user.id);
      return [...prev, user];
    });
  };

  // ─── Render Helpers ───────────────────────────────────────
  const renderMessages = () => {
    if (messages.length === 0) {
      return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
            <MessageCircle size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
            <p>{t(lang, 'comm_no_msgs')}</p>
          </div>
        </div>
      );
    }

    let lastDate = null;
    return messages.map((msg, idx) => {
      const isMe = msg.sender_id === currentUser?.id;
      const msgDate = new Date(msg.created_at).toDateString();
      const showDateSep = msgDate !== lastDate;
      lastDate = msgDate;

      return (
        <div key={msg.id || idx}>
          {showDateSep && (
            <div className="date-separator">
              <span>{getDateLabel(msg.created_at)}</span>
            </div>
          )}
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2 }}
            className={`msg-row ${isMe ? 'sent' : 'received'}`}
          >
            {activeConv?.type === 'group' && (
              <div className="msg-sender">{getSenderName(msg.sender_id)}</div>
            )}
            <div className="msg-bubble">{msg.content}</div>
            <div className="msg-timestamp">{formatMsgTime(msg.created_at)}</div>
          </motion.div>
        </div>
      );
    });
  };

  // ─── MAIN RENDER ──────────────────────────────────────────
  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ display: 'flex', height: 'calc(100vh - var(--hh) - 60px)', gap: 0, borderRadius: 24, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,15,30,0.4)' }}
    >
      
      {/* ═══ LEFT PANEL: Conversations List ═══ */}
      <div style={{ width: 340, borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', background: 'rgba(6,10,20,0.3)' }}>
        
        {/* Header with search + FAB */}
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
              <MessageCircle size={20} color="var(--a)" />
              {t(lang, 'comm_title')}
            </h3>
            <div style={{ position: 'relative' }}>
              <motion.button 
                whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}
                className="fab"
                style={{ width: 38, height: 38 }}
                onClick={() => setShowFabMenu(!showFabMenu)}
              >
                <Plus size={20} style={{ transition: 'transform 0.3s', transform: showFabMenu ? 'rotate(45deg)' : 'none' }} />
              </motion.button>

              <AnimatePresence>
                {showFabMenu && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                    className="fab-menu"
                  >
                    <button className="fab-menu-item" onClick={() => { setShowNewDmModal(true); setShowFabMenu(false); }}>
                      <MessageCircle size={18} color="var(--a)" />
                      {t(lang, 'comm_new_dm')}
                    </button>
                    <button className="fab-menu-item" onClick={() => { setShowNewGroupModal(true); setShowFabMenu(false); }}>
                      <Users size={18} color="#9D00FF" />
                      {t(lang, 'comm_new_group')}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
            <input 
              style={{ width: '100%', height: 40, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '0 14px 0 40px', color: '#fff', fontSize: 13, fontFamily: 'DM Sans, sans-serif', outline: 'none', transition: 'var(--tr)' }}
              placeholder={t(lang, 'comm_search')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Conversations list */}
        <div className="conv-list">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ width: 30, height: 30, border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--a)', borderRadius: '50%', margin: '0 auto 12px' }} />
              {t(lang, 'comm_loading')}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
              <MessageCircle size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
              <p style={{ fontSize: 14, marginBottom: 4 }}>{t(lang, 'comm_no_convs')}</p>
              <p style={{ fontSize: 12 }}>{t(lang, 'comm_no_convs_desc')}</p>
            </div>
          ) : (
            <AnimatePresence>
              {filteredConversations.map((conv, i) => (
                <motion.div 
                  key={conv.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`conv-item ${activeConv?.id === conv.id ? 'active' : ''}`}
                  onClick={() => { setActiveConv(conv); setShowInfoPanel(false); }}
                >
                  <div className={`conv-avatar ${conv.type === 'group' ? 'group' : ''}`}>
                    {getConvAvatar(conv)}
                  </div>
                  <div className="conv-info">
                    <div className="conv-name">
                      {conv.type === 'group' && <Hash size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle', opacity: 0.5 }} />}
                      {getConvName(conv)}
                    </div>
                    <div className="conv-last">{getLastMsgPreview(conv)}</div>
                  </div>
                  <div className="conv-meta">
                    <div className="conv-time">{formatTime(conv.lastMessage?.created_at || conv.created_at)}</div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* ═══ CENTER PANEL: Chat Area ═══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {activeConv ? (
          <div className="chat-area">
            {/* Chat Header */}
            <div className="chat-header">
              <div className={`conv-avatar ${activeConv.type === 'group' ? 'group' : ''}`} style={{ width: 42, height: 42, fontSize: 16 }}>
                {getConvAvatar(activeConv)}
              </div>
              <div className="chat-header-info">
                <div className="chat-header-name">{getConvName(activeConv)}</div>
                <div className="chat-header-status">
                  {activeConv.type === 'group' 
                    ? `${activeConv.members?.length || 0} ${t(lang, 'comm_members').toLowerCase()}`
                    : t(lang, 'comm_online')
                  }
                </div>
              </div>
              <motion.button 
                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                onClick={() => setShowInfoPanel(!showInfoPanel)}
                style={{ background: showInfoPanel ? 'rgba(0,210,182,0.1)' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, width: 40, height: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: showInfoPanel ? 'var(--a)' : 'rgba(255,255,255,0.5)', transition: 'var(--tr)' }}
              >
                <Info size={18} />
              </motion.button>
            </div>

            {/* Messages */}
            <div className="chat-messages-area">
              {renderMessages()}
              <div ref={messagesEndRef} />
            </div>

            {/* Compose */}
            <div className="chat-compose">
              <input
                ref={inputRef} 
                placeholder={t(lang, 'comm_type_msg')}
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              />
              <motion.button 
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                className="send-btn"
                onClick={sendMessage}
                style={{ opacity: newMsg.trim() ? 1 : 0.5 }}
              >
                <Send size={18} style={{ transform: lang === 'ar' ? 'scaleX(-1)' : 'none' }} />
              </motion.button>
            </div>
          </div>
        ) : (
          /* No conversation selected */
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
            <motion.div 
              animate={{ scale: [1, 1.05, 1], rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <MessageCircle size={80} style={{ color: 'rgba(255,255,255,0.08)' }} />
            </motion.div>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16, maxWidth: 300, textAlign: 'center', lineHeight: 1.6 }}>
              {t(lang, 'comm_select')}
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <motion.button 
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                className="btn" style={{ height: 42, fontSize: 13, borderRadius: 14, padding: '0 20px' }}
                onClick={() => setShowNewDmModal(true)}
              >
                <MessageCircle size={16} /> {t(lang, 'comm_new_dm')}
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                style={{ height: 42, fontSize: 13, borderRadius: 14, padding: '0 20px', background: 'rgba(157,0,255,0.15)', border: '1px solid rgba(157,0,255,0.3)', color: '#c77dff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}
                onClick={() => setShowNewGroupModal(true)}
              >
                <Users size={16} /> {t(lang, 'comm_new_group')}
              </motion.button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ RIGHT PANEL: Info Panel ═══ */}
      <AnimatePresence>
        {showInfoPanel && activeConv && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 300, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="info-panel"
          >
            <div className="info-panel-header">
              <div className={`info-panel-avatar ${activeConv.type === 'group' ? '' : ''}`} style={activeConv.type === 'group' ? { background: 'linear-gradient(135deg, #9D00FF, var(--p))' } : {}}>
                {activeConv.type === 'dm' && activeConv.dmPartner?.avatar_url 
                  ? <img src={activeConv.dmPartner.avatar_url} alt="" />
                  : getConvAvatar(activeConv)
                }
              </div>
              <div className="info-panel-name">{getConvName(activeConv)}</div>
              <div className="info-panel-role">
                {activeConv.type === 'dm' 
                  ? (activeConv.dmPartner?.role === 'founder' ? '👑 Fondateur' : '👤 ' + t(lang, 'comm_member'))
                  : `${activeConv.members?.length || 0} ${t(lang, 'comm_members').toLowerCase()}`
                }
              </div>
            </div>

            {/* DM info */}
            {activeConv.type === 'dm' && activeConv.dmPartner && (
              <div className="info-section">
                <div className="info-section-title">Email</div>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', wordBreak: 'break-all' }}>{activeConv.dmPartner.email}</p>
              </div>
            )}

            {/* Group members */}
            {activeConv.type === 'group' && (
              <div className="info-section">
                <div className="info-section-title">{t(lang, 'comm_members')} ({activeConv.members?.length || 0})</div>
                {activeConv.members?.map(member => (
                  <div key={member.id} className="info-member-item">
                    <div className="info-member-av">
                      {member.avatar_url ? <img src={member.avatar_url} alt="" /> : (member.first_name?.[0] || '?')}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{member.first_name || member.email}</div>
                      <div style={{ fontSize: 11, color: member.role === 'admin' ? 'var(--gold)' : 'rgba(255,255,255,0.4)' }}>
                        {member.role === 'admin' ? `👑 ${t(lang, 'comm_admin')}` : t(lang, 'comm_member')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Leave group */}
            {activeConv.type === 'group' && (
              <div className="info-section">
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => leaveGroup(activeConv.id)}
                  style={{ width: '100%', padding: '12px', background: 'rgba(255,69,69,0.08)', border: '1px solid rgba(255,69,69,0.2)', borderRadius: 14, color: 'var(--err)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 600, fontFamily: 'DM Sans, sans-serif' }}
                >
                  <LogOut size={16} /> {t(lang, 'comm_leave_group')}
                </motion.button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ MODAL: New DM ═══ */}
      <AnimatePresence>
        {showNewDmModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="msg-modal-overlay"
            onClick={() => setShowNewDmModal(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="msg-modal"
              onClick={e => e.stopPropagation()}
            >
              <div className="msg-modal-header">
                <h3 style={{ fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10, color: '#fff' }}>
                  <MessageCircle size={20} color="var(--a)" />
                  {t(lang, 'comm_new_dm')}
                </h3>
                <button onClick={() => setShowNewDmModal(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              <div className="msg-modal-body">
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>{t(lang, 'comm_select_user')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {allUsers.map(user => (
                    <motion.div 
                      key={user.id}
                      whileHover={{ scale: 1.01 }}
                      className="user-select-item"
                      onClick={() => createDM(user)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="user-select-av">
                        {user.avatar_url ? <img src={user.avatar_url} alt="" /> : (user.first_name?.[0] || '?')}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{user.first_name || 'Utilisateur'} {user.last_name || ''}</div>
                        <div style={{ fontSize: 12, color: user.role === 'founder' ? 'var(--gold)' : 'rgba(255,255,255,0.4)' }}>
                          {user.role === 'founder' ? '👑 Fondateur' : user.email}
                        </div>
                      </div>
                      <Send size={16} color="var(--a)" style={{ opacity: 0.5 }} />
                    </motion.div>
                  ))}
                  {allUsers.length === 0 && (
                    <div style={{ textAlign: 'center', padding: 30, color: 'rgba(255,255,255,0.3)' }}>
                      Aucun utilisateur trouvé
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ MODAL: New Group ═══ */}
      <AnimatePresence>
        {showNewGroupModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="msg-modal-overlay"
            onClick={() => { setShowNewGroupModal(false); setSelectedUsers([]); setGroupName(""); }}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="msg-modal"
              onClick={e => e.stopPropagation()}
            >
              <div className="msg-modal-header">
                <h3 style={{ fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10, color: '#fff' }}>
                  <Users size={20} color="#9D00FF" />
                  {t(lang, 'comm_create_group')}
                </h3>
                <button onClick={() => { setShowNewGroupModal(false); setSelectedUsers([]); setGroupName(""); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              <div className="msg-modal-body">
                {/* Group name */}
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--a)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 }}>
                    {t(lang, 'comm_group_name')}
                  </label>
                  <input 
                    className="fi"
                    placeholder={t(lang, 'comm_group_name_ph')}
                    value={groupName}
                    onChange={e => setGroupName(e.target.value)}
                    style={{ height: 44 }}
                  />
                </div>

                {/* Selected users pills */}
                {selectedUsers.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {selectedUsers.map(u => (
                      <motion.div 
                        key={u.id}
                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,210,182,0.1)', border: '1px solid rgba(0,210,182,0.2)', borderRadius: 20, padding: '4px 10px 4px 4px' }}
                      >
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, var(--p), var(--a))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                          {u.first_name?.[0] || '?'}
                        </div>
                        <span style={{ fontSize: 12, color: '#fff' }}>{u.first_name || u.email}</span>
                        <X size={12} style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }} onClick={() => toggleUserSelection(u)} />
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* User list */}
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--a)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 }}>
                  {t(lang, 'comm_add_members')}
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 250, overflowY: 'auto' }}>
                  {allUsers.map(user => {
                    const isSelected = selectedUsers.find(u => u.id === user.id);
                    return (
                      <div 
                        key={user.id}
                        className={`user-select-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleUserSelection(user)}
                      >
                        <div className="user-select-av">
                          {user.avatar_url ? <img src={user.avatar_url} alt="" /> : (user.first_name?.[0] || '?')}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{user.first_name || 'Utilisateur'}</div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{user.email}</div>
                        </div>
                        <div style={{ width: 22, height: 22, borderRadius: 6, border: isSelected ? '2px solid var(--a)' : '2px solid rgba(255,255,255,0.15)', background: isSelected ? 'var(--a)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'var(--tr)' }}>
                          {isSelected && <span style={{ color: '#000', fontSize: 13, fontWeight: 700 }}>✓</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="msg-modal-footer">
                <button onClick={() => { setShowNewGroupModal(false); setSelectedUsers([]); setGroupName(""); }} style={{ padding: '10px 20px', background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: 12, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
                  {t(lang, 'comm_cancel')}
                </button>
                <motion.button 
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="btn" 
                  style={{ padding: '10px 24px', borderRadius: 12, minHeight: 'auto', opacity: (groupName.trim() && selectedUsers.length > 0) ? 1 : 0.5 }}
                  onClick={createGroup}
                  disabled={!groupName.trim() || selectedUsers.length === 0}
                >
                  <Users size={16} /> {t(lang, 'comm_create')}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}

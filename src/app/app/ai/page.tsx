"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, Sparkles, User, RefreshCw, ImagePlus, CalendarPlus, X, Check, BookOpen, BarChart3, CalendarDays, Square } from "lucide-react";
import { useLanguage, t } from "@/utils/i18n";
import { supabase } from "@/utils/supabase/client";
import { useUserStore } from "@/store/useUserStore";
import DOMPurify from "isomorphic-dompurify";
import { marked } from "marked";

export default function AIPage() {
  const lang = useLanguage();
  const [messages, setMessages] = useState<any[]>([
    { role: 'assistant', content: '👋 Bonjour ! Je suis **Moncef IA**, votre assistant pédagogique tout-en-un.\n\nVoici ce que je peux faire :\n📚 **Devoirs** — Ajouter, modifier la progression, changer les dates, marquer comme terminé\n🗓️ **Emploi du temps** — Ajouter, supprimer ou déplacer des cours par simple description\n📅 **Événements** — Créer des rappels et événements dans votre calendrier\n📸 **Image EDT** — Analysez une photo de votre emploi du temps\n\nComment puis-je vous aider ?' }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachedImages, setAttachedImages] = useState<any[]>([]);
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [homeworkData, setHomeworkData] = useState<any>(null);
  const [homeworkUpdateData, setHomeworkUpdateData] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [existingHomework, setExistingHomework] = useState<any[]>([]);
  const [eventData, setEventData] = useState<any>(null);
  const [existingSchedule, setExistingSchedule] = useState<any[]>([]);
  const [scheduleAddData, setScheduleAddData] = useState<any>(null);
  const [scheduleDeleteData, setScheduleDeleteData] = useState<any>(null);
  const [scheduleUpdateData, setScheduleUpdateData] = useState<any>(null);
  const messagesEndRef = useRef<any>(null);
  const fileInputRef = useRef<any>(null);
  // Streaming : état + contrôleur d'annulation + scroll intelligent
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollContainerRef = useRef<any>(null);
  const nearBottomRef = useRef(true);

  // Build localized day names from i18n keys d0..d6
  const DAYS_FR = ['d0','d1','d2','d3','d4','d5','d6'].map(k => t(lang, k));

  // Load existing schedule so AI can reference slots by ID
  const loadExistingSchedule = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('schedule').select('id, week, day_index, subj, time_slot').order('day_index').order('time_slot');
    if (data) setExistingSchedule(data);
  };

  // Load existing homework so AI knows what to update
  const loadExistingHomework = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('homework').select('id, subject, task, due_date, progression, status, priority').order('created_at', { ascending: false });
    if (data) setExistingHomework(data);
  };

  // Defect #7 fix: realtime subscriptions for homework and schedule tables
  useEffect(() => {
    let hwChannel: any = null;
    let schedChannel: any = null;
    let cancelled = false;

    const initRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      // Initial load
      loadExistingHomework();
      loadExistingSchedule();

      // Realtime subscription for homework changes
      hwChannel = supabase.channel(`ai_homework_${user.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'homework',
          filter: `user_id=eq.${user.id}`
        }, () => {
          loadExistingHomework();
        })
        .subscribe();

      // Realtime subscription for schedule changes
      schedChannel = supabase.channel(`ai_schedule_${user.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'schedule',
          filter: `user_id=eq.${user.id}`
        }, () => {
          loadExistingSchedule();
        })
        .subscribe();
    };

    initRealtime();

    return () => {
      cancelled = true;
      if (hwChannel) supabase.removeChannel(hwChannel);
      if (schedChannel) supabase.removeChannel(schedChannel);
    };
  }, []);

  // Ne force le scroll que si l'utilisateur était déjà en bas :
  // pendant un stream il peut relire le haut sans être ramené de force.
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const scrollToBottom = () => {
    if (nearBottomRef.current) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Annule un stream en cours si on quitte la page
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target?.files ?? []);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev: ProgressEvent<FileReader>) => {
        // `result` est `string | ArrayBuffer` : on ne manipule que le cas base64 string,
        // sinon `base64.split` plantait silencieusement sur un ArrayBuffer.
        const raw = ev.target?.result;
        const base64 = typeof raw === 'string' ? raw : '';
        if (!base64.includes(',')) return;
        setAttachedImages(prev => [...prev, { 
          base64Data: base64.split(',')[1], 
          mediaType: file.type, 
          preview: base64,
          name: file.name 
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeImage = (idx: any) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== idx));
  };

  // Unified schedule operation (insert / delete / update)
  const scheduleOp = async (entries: any, action: any, successMsg: any, clearFn: any) => {
    setImporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${t(lang,'ai_not_logged_in')}` }]); return; }
      const res = await fetch('/api/schedule-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries, action, authToken: session.access_token })
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, { role: 'assistant', content: successMsg(data) }]);
        clearFn();
        loadExistingSchedule();
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `❌ Erreur : ${data.error}` }]);
      }
    } catch { setMessages(prev => [...prev, { role: 'assistant', content: t(lang,'ai_error_tech') }]); }
    finally { setImporting(false); }
  };

  const importSchedule = async (entries: any) => {
    await scheduleOp(
      entries, 'insert',
      (d: any) => `✅ ${d.inserted} cours ajouté(s) ! Consultez votre Emploi du Temps. 🎉`,
      () => setScheduleData(null)
    );
  };

  const importHomework = async (entries: any, isUpdate: boolean = false) => {
    setImporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessages(prev => [...prev, { role: 'assistant', content: "❌ Erreur : vous devez être connecté pour ajouter des devoirs." }]);
        return;
      }

      const res = await fetch("/api/homework-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries, authToken: session.access_token })
      });

      const data = await res.json();
      if (data.success) {
        if (isUpdate) {
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `✅ ${data.updated} devoir(s) mis à jour avec succès ! 📊` 
          }]);
          setHomeworkUpdateData(null);
        } else {
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `✅ ${data.inserted} devoir(s) ajouté(s) avec succès ! Rendez-vous dans la section "Accueil" pour les consulter. 📚` 
          }]);
          setHomeworkData(null);
        }
        loadExistingHomework(); // Refresh the homework list
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `❌ Erreur : ${data.error}` }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: "❌ Erreur technique lors de la mise à jour des devoirs." }]);
    } finally {
      setImporting(false);
    }
  };

  // Extrait les balises JSON structurées (<SCHEDULE_JSON>, <HOMEWORK_JSON>, …)
  // de la réponse IA et retourne le texte nettoyé pour l'affichage.
  const applyStructuredTags = (reply: string): string => {
    let text = reply;
    const take = (re: RegExp, apply: (v: any) => void) => {
      const m = text.match(re);
      if (m) {
        try {
          apply(JSON.parse((m[1] ?? '').trim()));
          text = text.replace(re, '').trim();
        } catch (e) {
          console.error('structured tag parse error', e);
        }
      }
    };
    take(/<SCHEDULE_JSON>([\s\S]*?)<\/SCHEDULE_JSON>/, setScheduleData);
    take(/<HOMEWORK_JSON>([\s\S]*?)<\/HOMEWORK_JSON>/, setHomeworkData);
    take(/<HOMEWORK_UPDATE_JSON>([\s\S]*?)<\/HOMEWORK_UPDATE_JSON>/, setHomeworkUpdateData);
    take(/<EVENT_JSON>([\s\S]*?)<\/EVENT_JSON>/, setEventData);
    take(/<SCHEDULE_ADD_JSON>([\s\S]*?)<\/SCHEDULE_ADD_JSON>/, setScheduleAddData);
    take(/<SCHEDULE_DELETE_JSON>([\s\S]*?)<\/SCHEDULE_DELETE_JSON>/, setScheduleDeleteData);
    take(/<SCHEDULE_UPDATE_JSON>([\s\S]*?)<\/SCHEDULE_UPDATE_JSON>/, setScheduleUpdateData);
    return text;
  };

  const stopStream = () => {
    abortRef.current?.abort();
  };

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if ((!text && attachedImages.length === 0) || loading || streaming) return;
    
    const userMsg = text;
    setInput("");
    
    // Build content array for OpenAI vision API (Pollinations uses OpenAI)
    const contentParts: any[] = [];
    const imagesCopy = [...attachedImages];
    
    // Add text
    if (userMsg) {
      contentParts.push({ type: "text", text: userMsg });
    } else if (imagesCopy.length > 0) {
      contentParts.push({ type: "text", text: "Voici mon emploi du temps en image. Analyse-le et propose-moi de l'importer dans mon calendrier." });
    }

    // Add images
    imagesCopy.forEach(img => {
      contentParts.push({
        type: "image_url",
        image_url: {
          url: `data:${img.mediaType};base64,${img.base64Data}`
        }
      });
    });

    // For display in UI
    const displayContent = userMsg || "📸 Image(s) envoyée(s)";
    const newMessages = [...messages, { role: 'user', content: displayContent, images: imagesCopy.map(i => i.preview) }];
    setMessages(newMessages);
    setAttachedImages([]);
    setLoading(true);

    const hasImages = imagesCopy.length > 0;

    try {
      // Build messages for the API
      const apiMessages = newMessages
        .filter(m => m.role !== 'system')
        .map(m => {
          // For the last user message with images, send the full content array
          if (m === newMessages[newMessages.length - 1] && hasImages) {
            return { role: m.role, content: contentParts };
          }
          // For other messages, send plain text
          return { role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) };
        });

      const scheduleStr = existingSchedule.length > 0
        ? `\nEMPLOI DU TEMPS EXISTANT (avec IDs pour modification/suppression):\n${existingSchedule.map(s => `- ID: ${s.id} | Sem.${s.week} | ${DAYS_FR[s.day_index]}: ${s.subj} (${s.time_slot || 'heure ?'})`).join('\n')}`
        : '\nEmploi du temps vide pour le moment.';

      const schedulePrompt = `
Tu peux GÉRER l'emploi du temps (EDT) de l'utilisateur.
${scheduleStr}

day_index: 0=Lundi, 1=Mardi, 2=Mercredi, 3=Jeudi, 4=Vendredi, 5=Samedi, 6=Dimanche

1. AJOUTER un cours (texte) → émets à la FIN :
<SCHEDULE_ADD_JSON>
[{"week":"A","day_index":0,"subj":"Mathématiques","time_slot":"08:00 - 10:00"}]
</SCHEDULE_ADD_JSON>

2. SUPPRIMER un ou plusieurs cours → utilise les IDs ci-dessus :
<SCHEDULE_DELETE_JSON>
[{"id":"uuid-ici"}]
</SCHEDULE_DELETE_JSON>

3. MODIFIER un cours (renommer, changer horaire, déplacer) → utilise l'ID :
<SCHEDULE_UPDATE_JSON>
[{"id":"uuid-ici","subj":"Nouveau nom","time_slot":"10:00 - 12:00","day_index":1,"week":"B"}]
</SCHEDULE_UPDATE_JSON>

${hasImages ? `4. Si l'image contient un EDT, analyse-la et émets :
<SCHEDULE_JSON>
[{"week":"A","day_index":0,"subj":"Mathématiques","time_slot":"08:00 - 10:00"}]
</SCHEDULE_JSON>` : ''}

Exemples :
- "Ajoute maths le lundi de 8h à 10h semaine A" → SCHEDULE_ADD_JSON
- "Supprime le cours de SVT du mercredi" → cherche l'ID et émets SCHEDULE_DELETE_JSON
- "Déplace l'anglais du mardi au jeudi" → SCHEDULE_UPDATE_JSON avec day_index: 3
- "Renomme EPS en Sport" → SCHEDULE_UPDATE_JSON avec le nouvel subj
`;


      const hwListStr = existingHomework.length > 0
        ? `\nDEVOIRS EXISTANTS (avec leurs IDs pour modification):\n${existingHomework.map(h => `- ID: ${h.id} | ${h.subject}: "${h.task}" | progression: ${h.progression}% | status: ${h.status} | date rendu: ${h.due_date || 'non définie'}`).join('\n')}`
        : '\nAucun devoir existant pour le moment.';

      const homeworkPrompt = `
Tu peux AJOUTER et MODIFIER les devoirs de l'utilisateur.
${hwListStr}

1. AJOUTER un devoir : quand l'utilisateur veut un nouveau devoir, collecte matière + description (obligatoires), puis émets :
<HOMEWORK_JSON>
[{"subject":"Mathématiques","task":"Ex 1-5 p42","teacher":"M. Dupont","due_date":"2026-04-20","priority":"normal"}]
</HOMEWORK_JSON>

2. MODIFIER un devoir existant (progression, date, statut) : utilise l'ID de la liste ci-dessus et émets :
<HOMEWORK_UPDATE_JSON>
[{"id":"uuid-du-devoir","progression":75}]
</HOMEWORK_UPDATE_JSON>

Exemples de demandes de modification :
- "Mon devoir de maths est à 50%" → cherche l'ID du devoir de maths et émets HOMEWORK_UPDATE_JSON avec progression: 50
- "J'ai terminé mes exercices de physique" → émets HOMEWORK_UPDATE_JSON avec status: "done"
- "Change la date de rendu de l'histoire au 25 avril" → émets HOMEWORK_UPDATE_JSON avec due_date: "2026-04-25"
`;

      const todayStr = new Date().toISOString().split('T')[0];
      const eventPrompt = `
Tu peux aussi AJOUTER DES ÉVÉNEMENTS au calendrier de l'utilisateur.
Quand l'utilisateur mentionne un événement à venir (contrôle, sortie scolaire, réunion, match, rappel, etc.), émets à la FIN de ta réponse :
<EVENT_JSON>
[{"title":"Contrôle de maths","event_date":"2026-04-25","event_time":"09:00","description":"Chapitres 3 et 4","category":"exam"}]
</EVENT_JSON>

Catégories disponibles : "exam" (contrôle/interro), "homework" (devoir à rendre), "meeting" (réunion), "trip" (sortie), "sport" (événement sportif), "reminder" (rappel), "general" (autre)
La date doit être au format YYYY-MM-DD. La date d'aujourd'hui est ${todayStr}. Utilise-la pour interpréter "demain", "lundi prochain", "vendredi", etc.
Exemples :
- "J'ai un contrôle de physique lundi" → category: "exam"
- "Sortie au musée vendredi" → category: "trip"
- "Réunion parents-profs le 2 mai" → category: "meeting"
`;

      const { data: { session } } = await supabase.auth.getSession();
      
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ""}`
        },
        body: JSON.stringify({
          model: 'claude-3-7-sonnet-20250219',
          messages: apiMessages,
          system: `Tu es Moncef IA, un assistant éducatif intelligent et bienveillant créé par Amine FJER. Tu fais partie de la plateforme "Moncef IA" qui a été entièrement conçue et développée par Amine FJER. Si on te demande qui t'a créé, qui a créé ce site, qui est le fondateur, ou qui est derrière ce projet, tu dois TOUJOURS répondre que c'est Amine FJER. IMPORTANT: You must reply entirely in the language corresponding to this code: ${lang}. La date d'aujourd'hui est le ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}. ${schedulePrompt} ${homeworkPrompt} ${eventPrompt}`,
          stream: true
        }),
        signal: controller.signal
      });

      const contentType = res.headers.get('content-type') || '';

      if (!res.ok || !contentType.includes('text/event-stream')) {
        // Erreur JSON (401/402/500…) ou réponse non-stream : comportement historique.
        let data: any = {};
        try { data = await res.json(); } catch { /* corps illisible */ }
        if (!res.ok) {
          setMessages(prev => [...prev, { role: 'assistant', content: data.response || data.error || "Désolé, une erreur est survenue." }]);
          setLoading(false);
          return;
        }
        if (data.newTokens !== undefined) {
          useUserStore.getState().setCredits(data.newTokens);
        }
        const finalText = applyStructuredTags(data.response || "Désolé, je n'ai pas compris.");
        setMessages(prev => [...prev, { role: 'assistant', content: finalText, cost: data.cost || 0 }]);
        setLoading(false);
        return;
      }

      // === STREAMING SSE : le texte arrive token par token ===
      setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);
      setLoading(false);
      setStreaming(true);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      let streamInfo: any = {};
      let aborted = false;

      const pushSnapshot = (snapshot: string) => {
        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === 'assistant') {
            next[next.length - 1] = { ...last, content: snapshot, streaming: true };
          }
          return next;
        });
      };

      try {
        if (!reader) throw new Error('Flux de lecture indisponible');
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() ?? '';
          for (const ev of events) {
            const line = ev.trim();
            if (!line.startsWith('data:')) continue;
            let payload: any;
            try { payload = JSON.parse(line.slice(5).trim()); } catch { continue; }
            if (typeof payload.token === 'string' && payload.token) {
              fullText += payload.token;
              pushSnapshot(fullText);
            } else if (payload.done) {
              streamInfo = payload;
            } else if (payload.error) {
              streamInfo = { error: payload.error, details: payload.details };
            }
          }
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          aborted = true; // Stop demandé : on garde le texte partiel.
        } else {
          throw e;
        }
      } finally {
        try { await reader?.cancel(); } catch { /* déjà fermé */ }
      }

      setStreaming(false);
      abortRef.current = null;

      if (streamInfo.newTokens !== undefined) {
        useUserStore.getState().setCredits(streamInfo.newTokens);
      }

      let aiReply = fullText.trim();
      if (!aiReply) {
        aiReply = streamInfo.error || "Désolé, je n'ai pas compris.";
      }
      aiReply = applyStructuredTags(aiReply);

      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === 'assistant') {
          next[next.length - 1] = {
            ...last,
            content: aiReply,
            streaming: false,
            stopped: aborted,
            cost: aborted ? 0 : (streamInfo.cost || 0),
          };
        }
        return next;
      });
    } catch (err: any) {
      console.error(err);
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        // Si un stream était en cours, on remplace son placeholder plutôt
        // que d'empiler un second message d'erreur.
        if (last && last.role === 'assistant' && last.streaming) {
          next[next.length - 1] = { ...last, content: "Désolé, une erreur technique est survenue.", streaming: false };
          return next;
        }
        return [...prev, { role: 'assistant', content: "Désolé, une erreur technique est survenue." }];
      });
    } finally {
      setLoading(false);
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setStreaming(false);
    setMessages([{ role: 'assistant', content: t(lang, 'ai_chat_reset_msg') }]);
    setScheduleData(null);
    setScheduleAddData(null);
    setScheduleDeleteData(null);
    setScheduleUpdateData(null);
    setHomeworkData(null);
    setHomeworkUpdateData(null);
    setEventData(null);
    setAttachedImages([]);
  };



  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '900px', margin: '0 auto', gap: '20px' }}>
      
      {/* Header compact (quick win audit 2026-10-04) : barre fine pour laisser
          un max d'espace vertical au chat */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ padding: '10px 18px', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'var(--a)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', boxShadow: '0 0 16px rgba(0,210,182,0.35)', flexShrink: 0 }}>
            <Bot size={20} />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Assistant IA <Sparkles size={14} color="var(--a)" />
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ok)' }} /> {t(lang, 'ai_status')}
            </div>
          </div>
        </div>
        <button onClick={clearChat} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <RefreshCw size={14} /> {t(lang, 'new_chat')}
        </button>
      </motion.div>

      <div className="card" style={{ flex: 1, borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        <div ref={scrollContainerRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '30px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Display attached images */}
                    {msg.images && msg.images.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {msg.images.map((img: any, imgIdx: any) => (
                          <img key={imgIdx} src={img} alt="attached" style={{ maxWidth: '200px', maxHeight: '150px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', objectFit: 'cover' }} />
                        ))}
                      </div>
                    )}
                    <div className="ai-markdown" style={{ 
                      padding: '16px 20px', 
                      borderRadius: '20px', 
                      borderTopLeftRadius: isAi ? '4px' : '20px',
                      borderTopRightRadius: !isAi ? '4px' : '20px',
                      background: isAi ? 'rgba(255,255,255,0.03)' : 'var(--p)',
                      border: isAi ? '1px solid rgba(255,255,255,0.08)' : 'none',
                      color: '#fff',
                      fontSize: '15px',
                      lineHeight: '1.6',
                      boxShadow: !isAi ? '0 4px 15px rgba(46,91,255,0.2)' : 'none',
                      whiteSpace: 'normal',
                      wordBreak: 'break-word'
                    }}
                    dangerouslySetInnerHTML={{ __html: isAi ? DOMPurify.sanitize(marked.parse(msg.content || '') as string) : msg.content }}
                  />
                    {isAi && msg.streaming && (
                      <motion.span
                        animate={{ opacity: [1, 0.15, 1] }}
                        transition={{ repeat: Infinity, duration: 0.9 }}
                        style={{ width: 8, height: 16, background: 'var(--a)', borderRadius: 2, marginTop: 6 }}
                      />
                    )}
                    {isAi && !msg.streaming && (msg.cost > 0 || msg.stopped) && (
                      <div style={{ display: 'flex', gap: 8, fontSize: '11px', color: 'rgba(255,255,255,0.35)', paddingLeft: 4 }}>
                        {msg.cost > 0 && <span>−{msg.cost} crédits</span>}
                        {msg.stopped && <span>⏹ Réponse arrêtée</span>}
                      </div>
                    )}
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

        {/* Schedule Import Card */}
        {scheduleData && scheduleData.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            style={{ margin: '0 30px 20px', padding: '20px', background: 'linear-gradient(135deg, rgba(0,210,182,0.1), rgba(46,91,255,0.1))', border: '1px solid rgba(0,210,182,0.3)', borderRadius: '16px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <CalendarPlus size={20} color="var(--a)" />
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{t(lang,'ai_sch_import_q')}</span>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginLeft: 'auto' }}>{scheduleData.length} {t(lang,'ai_sch_detected')}</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', marginBottom: '16px' }}>
              {scheduleData.map((entry: any, idx: any) => (
                <div key={idx} style={{ display: 'flex', gap: '12px', padding: '8px 12px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', fontSize: '13px', color: '#fff' }}>
                  <span style={{ color: 'var(--a)', fontWeight: 600, minWidth: '80px' }}>{DAYS_FR[entry.day_index]}</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)', minWidth: '110px' }}>{entry.time_slot}</span>
                  <span style={{ fontWeight: 600 }}>{entry.subj}</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: 'auto', fontSize: '11px' }}>Sem. {entry.week}</span>
                </div>
              ))}
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <motion.button 
                whileHover={{ scale: 1.03 }} 
                whileTap={{ scale: 0.97 }}
                onClick={() => importSchedule(scheduleData)}
                disabled={importing}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: 'var(--a)', color: '#000', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px' }}
              >
                <Check size={18} /> {importing ? t(lang,'ai_importing') : t(lang,'ai_sch_confirm')}
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.03 }} 
                whileTap={{ scale: 0.97 }}
                onClick={() => setScheduleData(null)}
                style={{ padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}
              >
                <X size={16} /> Annuler
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Homework Import Card */}
        {homeworkData && homeworkData.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            style={{ margin: '0 30px 20px', padding: '20px', background: 'linear-gradient(135deg, rgba(46,91,255,0.1), rgba(255,165,2,0.08))', border: '1px solid rgba(46,91,255,0.3)', borderRadius: '16px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <BookOpen size={20} color="var(--p)" />
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{t(lang,'ai_hw_add_q')}</span>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginLeft: 'auto' }}>{homeworkData.length} {t(lang,'ai_hw_detected')}</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', marginBottom: '16px' }}>
              {homeworkData.map((entry: any, idx: any) => (
                <div key={idx} style={{ display: 'flex', gap: '12px', padding: '10px 14px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', fontSize: '13px', color: '#fff', alignItems: 'center' }}>
                  <span style={{ 
                    color: entry.priority === 'urgent' ? '#ff4757' : entry.priority === 'low' ? '#2ed573' : '#ffa502', 
                    fontWeight: 700, minWidth: '90px', fontSize: '12px', textTransform: 'uppercase' 
                  }}>
                    {entry.priority === 'urgent' ? '🔴' : entry.priority === 'low' ? '🟢' : '🟡'} {entry.subject}
                  </span>
                  <span style={{ flex: 1 }}>{entry.task}</span>
                  {entry.teacher && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>👤 {entry.teacher}</span>}
                  {entry.due_date && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>📅 {entry.due_date}</span>}
                </div>
              ))}
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <motion.button 
                whileHover={{ scale: 1.03 }} 
                whileTap={{ scale: 0.97 }}
                onClick={() => importHomework(homeworkData)}
                disabled={importing}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: 'var(--p)', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px' }}
              >
                <Check size={18} /> {importing ? 'Ajout en cours...' : 'Confirmer l\'ajout'}
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.03 }} 
                whileTap={{ scale: 0.97 }}
                onClick={() => setHomeworkData(null)}
                style={{ padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}
              >
                <X size={16} /> Annuler
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Homework Update Card */}
        {homeworkUpdateData && homeworkUpdateData.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            style={{ margin: '0 30px 20px', padding: '20px', background: 'linear-gradient(135deg, rgba(0,210,182,0.08), rgba(46,91,255,0.08))', border: '1px solid rgba(0,210,182,0.3)', borderRadius: '16px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <BarChart3 size={20} color="var(--a)" />
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{t(lang,'ai_hw_update_q')}</span>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginLeft: 'auto' }}>{homeworkUpdateData.length} {t(lang,'ai_modifications')}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', overflowY: 'auto', marginBottom: '16px' }}>
              {homeworkUpdateData.map((entry: any, idx: any) => (
                <div key={idx} style={{ display: 'flex', gap: '12px', padding: '10px 14px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', fontSize: '13px', color: '#fff', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--a)', fontWeight: 700, fontSize: '12px' }}>
                    {existingHomework.find(h => h.id === entry.id)?.subject || 'Devoir'}
                  </span>
                  {entry.progression !== undefined && <span style={{ color: 'rgba(255,255,255,0.6)' }}>📊 Progression → {entry.progression}%</span>}
                  {entry.due_date !== undefined && <span style={{ color: 'rgba(255,255,255,0.6)' }}>📅 Date → {entry.due_date || 'supprimée'}</span>}
                  {entry.status !== undefined && <span style={{ color: 'rgba(255,255,255,0.6)' }}>🔄 Statut → {entry.status}</span>}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <motion.button 
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => importHomework(homeworkUpdateData, true)}
                disabled={importing}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: 'var(--a)', color: '#000', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px' }}
              >
                <Check size={18} /> {importing ? t(lang,'ai_hw_updating') : t(lang,'ai_hw_confirm_update')}
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => setHomeworkUpdateData(null)}
                style={{ padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}
              >
                <X size={16} /> Annuler
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Schedule ADD Card */}
        {scheduleAddData && scheduleAddData.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            style={{ margin: '0 30px 20px', padding: '20px', background: 'linear-gradient(135deg, rgba(46,91,255,0.1), rgba(0,210,182,0.08))', border: '1px solid rgba(0,210,182,0.35)', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <CalendarPlus size={20} color="var(--a)" />
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{t(lang,'ai_sch_add_q')}</span>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginLeft: 'auto' }}>{scheduleAddData.length} {t(lang,'ai_courses')}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '140px', overflowY: 'auto', marginBottom: '14px' }}>
              {scheduleAddData.map((s: any, i: any) => (
                <div key={i} style={{ display: 'flex', gap: '10px', padding: '8px 12px', background: 'rgba(0,0,0,0.25)', borderRadius: '10px', fontSize: '13px', color: '#fff', alignItems: 'center' }}>
                  <span style={{ color: 'var(--a)', fontWeight: 700, minWidth: 60 }}>Sem. {s.week}</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)', minWidth: 70 }}>{DAYS_FR[s.day_index]}</span>
                  <span style={{ fontWeight: 600 }}>{s.subj}</span>
                  {s.time_slot && <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>🕐 {s.time_slot}</span>}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} disabled={importing}
                onClick={() => scheduleOp(scheduleAddData, 'insert', (d: any) => `✅ ${d.inserted} cours ajouté(s) à l'EDT !`, () => setScheduleAddData(null))}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: 'var(--a)', color: '#000', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px' }}>
                <Check size={18} /> {importing ? t(lang,'ai_sch_adding') : t(lang,'btn_confirm')}
              </motion.button>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setScheduleAddData(null)}
                style={{ padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <X size={16} /> Annuler
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Schedule DELETE Card */}
        {scheduleDeleteData && scheduleDeleteData.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            style={{ margin: '0 30px 20px', padding: '20px', background: 'linear-gradient(135deg, rgba(255,71,87,0.1), rgba(255,71,87,0.05))', border: '1px solid rgba(255,71,87,0.35)', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <span style={{ fontSize: '20px' }}>🗑️</span>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{t(lang,'ai_sch_delete_q')}</span>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginLeft: 'auto' }}>{scheduleDeleteData.length} {t(lang,'ai_courses')}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '140px', overflowY: 'auto', marginBottom: '14px' }}>
              {scheduleDeleteData.map((s: any, i: any) => {
                const slot = existingSchedule.find(e => e.id === s.id);
                return (
                  <div key={i} style={{ padding: '8px 12px', background: 'rgba(255,71,87,0.08)', borderRadius: '10px', fontSize: '13px', color: '#fff', border: '1px solid rgba(255,71,87,0.2)' }}>
                    {slot ? `${DAYS_FR[slot.day_index]} — ${slot.subj} (${slot.time_slot || '?'}) Sem.${slot.week}` : `ID: ${s.id}`}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} disabled={importing}
                onClick={() => scheduleOp(scheduleDeleteData, 'delete', (d: any) => `✅ ${d.deleted} cours supprimé(s) de l'EDT !`, () => setScheduleDeleteData(null))}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#ff4757', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px' }}>
                <Check size={18} /> {importing ? t(lang,'ai_sch_deleting') : t(lang,'ai_sch_confirm_delete')}
              </motion.button>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setScheduleDeleteData(null)}
                style={{ padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <X size={16} /> Annuler
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Schedule UPDATE Card */}
        {scheduleUpdateData && scheduleUpdateData.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            style={{ margin: '0 30px 20px', padding: '20px', background: 'linear-gradient(135deg, rgba(255,165,2,0.1), rgba(255,165,2,0.05))', border: '1px solid rgba(255,165,2,0.35)', borderRadius: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <span style={{ fontSize: '20px' }}>✏️</span>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{t(lang,'ai_sch_update_q')}</span>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginLeft: 'auto' }}>{scheduleUpdateData.length} {t(lang,'ai_modifications')}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '140px', overflowY: 'auto', marginBottom: '14px' }}>
              {scheduleUpdateData.map((s: any, i: any) => {
                const slot = existingSchedule.find(e => e.id === s.id);
                return (
                  <div key={i} style={{ padding: '8px 12px', background: 'rgba(255,165,2,0.06)', borderRadius: '10px', fontSize: '13px', color: '#fff', border: '1px solid rgba(255,165,2,0.2)' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>{slot ? `${slot.subj}` : 'Cours'} →</span>{' '}
                    {s.subj && <span style={{ color: '#ffa502' }}>📝 {s.subj} </span>}
                    {s.time_slot && <span style={{ color: '#ffa502' }}>🕐 {s.time_slot} </span>}
                    {s.day_index !== undefined && <span style={{ color: '#ffa502' }}>📅 {DAYS_FR[s.day_index]} </span>}
                    {s.week && <span style={{ color: '#ffa502' }}>Sem.{s.week}</span>}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} disabled={importing}
                onClick={() => scheduleOp(scheduleUpdateData, 'update', (d: any) => `✅ ${d.updated} cours modifié(s) dans l'EDT !`, () => setScheduleUpdateData(null))}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#ffa502', color: '#000', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px' }}>
                <Check size={18} /> {importing ? t(lang,'ai_sch_updating') : t(lang,'ai_sch_confirm_update')}
              </motion.button>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setScheduleUpdateData(null)}
                style={{ padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <X size={16} /> Annuler
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Event Import Card */}
        {eventData && eventData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            style={{ margin: '0 30px 20px', padding: '20px', background: 'linear-gradient(135deg, rgba(46,91,255,0.1), rgba(167,139,250,0.08))', border: '1px solid rgba(167,139,250,0.35)', borderRadius: '16px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <CalendarDays size={20} color="#a78bfa" />
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{t(lang,'ai_event_add_q')}</span>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginLeft: 'auto' }}>{eventData.length} {t(lang,'ai_events')}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', overflowY: 'auto', marginBottom: '16px' }}>
              {eventData.map((ev: any, idx: any) => {
                const catIcons: Record<string, string> = { exam: '📝', homework: '📚', meeting: '🤝', trip: '🚌', sport: '⚽', reminder: '🔔', general: '📌' };
                return (
                  <div key={idx} style={{ display: 'flex', gap: '12px', padding: '10px 14px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px', fontSize: '13px', color: '#fff', alignItems: 'center' }}>
                    <span style={{ fontSize: '18px' }}>{catIcons[ev.category as string] || '📌'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{ev.title}</div>
                      {ev.description && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{ev.description}</div>}
                    </div>
                    <span style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 600, whiteSpace: 'nowrap' }}>📅 {ev.event_date}{ev.event_time ? ` à ${ev.event_time}` : ''}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={async () => {
                  setImporting(true);
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) { setImporting(false); return; }
                  const res = await fetch('/api/events-import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entries: eventData, authToken: session.access_token }) });
                  const data = await res.json();
                  if (data.success) setMessages(prev => [...prev, { role: 'assistant', content: `✅ ${data.inserted} événement(s) ajouté(s) au calendrier ! 🗓️` }]);
                  else if (data.setupRequired) setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ **Configuration manquante** : ${data.error}` }]);
                  else setMessages(prev => [...prev, { role: 'assistant', content: `❌ Erreur : ${data.error}` }]);
                  setEventData(null);
                  setImporting(false);
                }}
                disabled={importing}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#a78bfa', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px' }}
              >
                <Check size={18} /> {importing ? t(lang,'ai_hw_adding') : t(lang,'ai_hw_confirm_add')}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => setEventData(null)}
                style={{ padding: '12px 20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}
              >
                <X size={16} /> Annuler
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Image Preview Bar */}
        {attachedImages.length > 0 && (
          <div style={{ padding: '12px 30px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {attachedImages.map((img, idx) => (
              <div key={idx} style={{ position: 'relative' }}>
                <img src={img.preview} alt={img.name} style={{ width: '70px', height: '70px', borderRadius: '10px', objectFit: 'cover', border: '2px solid rgba(0,210,182,0.4)' }} />
                <button 
                  onClick={() => removeImage(idx)} 
                  style={{ position: 'absolute', top: -6, right: -6, width: '20px', height: '20px', borderRadius: '50%', background: 'var(--err)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', padding: 0 }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Chips de suggestions (quick win audit 2026-10-04) : zéro page blanche —
            visibles tant que la conversation n'a pas vraiment commencé */}
        {messages.length <= 1 && !loading && !streaming && (
          <div style={{ padding: '0 30px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              "Explique-moi les équations du premier degré",
              "Fais-moi un quiz de 5 questions en physique-chimie",
              "Résume-moi mon chapitre d'histoire-géo",
              "Aide-moi à planifier mes révisions de la semaine",
            ].map((chip) => (
              <button
                key={chip}
                onClick={() => sendMessage(chip)}
                style={{ background: 'rgba(0,210,182,0.07)', border: '1px solid rgba(0,210,182,0.25)', color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 500, padding: '8px 14px', borderRadius: 20, cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,210,182,0.15)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,210,182,0.07)'; }}
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        <div style={{ padding: '20px 30px', background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 8px 8px 16px', borderRadius: '24px' }}>
            {/* Image upload button */}
            <input 
              ref={fileInputRef} 
              type="file" 
              accept="image/*" 
              multiple 
              style={{ display: 'none' }} 
              onChange={handleImageUpload} 
            />
            <motion.button 
              whileHover={{ scale: 1.1 }} 
              whileTap={{ scale: 0.9 }}
              onClick={() => fileInputRef.current?.click()}
              style={{ background: 'none', border: 'none', color: attachedImages.length > 0 ? 'var(--a)' : 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center' }}
              title="Joindre une image (ex: capture d'écran de votre emploi du temps)"
            >
              <ImagePlus size={22} />
            </motion.button>

            <input 
              style={{ flex: 1, background: 'none', border: 'none', color: '#fff', fontSize: '15px', outline: 'none' }} 
              placeholder={attachedImages.length > 0 ? "Ajoutez un message ou envoyez directement..." : t(lang, 'ai_placeholder')} 
              value={input} 
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              disabled={loading || streaming}
            />
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="btn" style={{ width: '48px', height: '48px', borderRadius: '18px', padding: 0 }} onClick={() => (streaming ? stopStream() : sendMessage())} disabled={loading} title={streaming ? "Arrêter la réponse" : undefined}>
              {streaming ? <Square size={20} /> : <Send size={20} style={{ marginLeft: lang === 'ar' ? '2px' : '-2px', transform: lang === 'ar' ? 'scaleX(-1)' : 'none' }} />}
            </motion.button>
          </div>
          <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
            {t(lang, 'ai_disclaimer')} • 📸 Joignez une capture de votre EDT pour l'importer automatiquement
          </div>
        </div>

      </div >
    </div >
  );
}

// ✅ FIX #7 #11 #13 — Logique du chat extraite en hook dédié
import { useState, useCallback } from "react";
import { supabase } from "@/utils/supabase/client";
import { useUserStore } from "@/store/useUserStore";
import { useLanguage } from "@/utils/i18n";

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[];
}

export interface ParsedAIActions {
  scheduleData: any[] | null;
  scheduleAddData: any[] | null;
  scheduleDeleteData: any[] | null;
  scheduleUpdateData: any[] | null;
  homeworkData: any[] | null;
  homeworkUpdateData: any[] | null;
  eventData: any[] | null;
}

// ✅ FIX #13 — Parsing centralisé et robuste (case-insensitive)
function parseAIResponse(raw: string): { cleanReply: string; actions: ParsedAIActions } {
  let reply = raw;
  const actions: ParsedAIActions = {
    scheduleData: null, scheduleAddData: null,
    scheduleDeleteData: null, scheduleUpdateData: null,
    homeworkData: null, homeworkUpdateData: null, eventData: null,
  };

  const extract = (tag: string): any[] | null => {
    // ✅ FIX #13 — Regex case-insensitive pour robustesse
    const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const m = reply.match(re);
    if (!m) return null;
    try {
      const parsed = JSON.parse((m[1] ?? "").trim());
      reply = reply.replace(re, '').trim();
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e: any) {
      console.warn(`[useAIChat] Failed to parse <${tag}>:`, e);
      return null;
    }
  };

  actions.scheduleData      = extract('SCHEDULE_JSON');
  actions.scheduleAddData   = extract('SCHEDULE_ADD_JSON');
  actions.scheduleDeleteData= extract('SCHEDULE_DELETE_JSON');
  actions.scheduleUpdateData= extract('SCHEDULE_UPDATE_JSON');
  actions.homeworkData      = extract('HOMEWORK_JSON');
  actions.homeworkUpdateData= extract('HOMEWORK_UPDATE_JSON');
  actions.eventData         = extract('EVENT_JSON');

  return { cleanReply: reply, actions };
}

export function useAIChat(
  existingSchedule: any[],
  existingHomework: any[],
  refreshData: () => void
) {
  const lang = useLanguage();
  const DAYS = ['d0','d1','d2','d3','d4','d5','d6'].map(k => {
    const map: Record<string,string> = { d0:'Lun', d1:'Mar', d2:'Mer', d3:'Jeu', d4:'Ven', d5:'Sam', d6:'Dim' };
    return map[k] || k;
  });

  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: '👋 Bonjour ! Je suis **Moncef IA**, votre assistant pédagogique tout-en-un.\n\nVoici ce que je peux faire :\n📚 **Devoirs** — Ajouter, modifier la progression, changer les dates, marquer comme terminé\n🗓️ **Emploi du temps** — Ajouter, supprimer ou déplacer des cours par simple description\n📅 **Événements** — Créer des rappels et événements dans votre calendrier\n📸 **Image EDT** — Analysez une photo de votre emploi du temps\n\nComment puis-je vous aider ?'
  }]);
  const [loading, setLoading] = useState(false);
  const [actions, setActions] = useState<ParsedAIActions>({
    scheduleData: null, scheduleAddData: null, scheduleDeleteData: null,
    scheduleUpdateData: null, homeworkData: null, homeworkUpdateData: null, eventData: null,
  });

  // ✅ FIX #6 — Prompt EDT limité (UUIDs tronqués à 8 chars, max 30 entrées)
  const buildSystemPrompt = useCallback((hasImages: boolean) => {
    const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const todayStr = new Date().toISOString().split('T')[0];

    const scheduleStr = existingSchedule.length > 0
      ? `\nEDT EXISTANT (IDs tronqués):\n${existingSchedule.map(s =>
          `- ID:${s.id.slice(0,8)} Sem.${s.week} ${DAYS[s.day_index]}: ${s.subj} (${s.time_slot || '?'})`
        ).join('\n')}`
      : '\nEDT vide.';

    const hwStr = existingHomework.length > 0
      ? `\nDEVOIRS EXISTANTS:\n${existingHomework.map(h =>
          `- ID:${h.id.slice(0,8)} ${h.subject}: "${h.task}" prog:${h.progression}% date:${h.due_date || '?'}`
        ).join('\n')}`
      : '\nAucun devoir.';

    return `Tu es Moncef IA, assistant éducatif créé par Amine FJER. Réponds en ${lang === 'fr' ? 'français' : lang === 'ar' ? 'arabe' : lang === 'es' ? 'espagnol' : lang === 'zh' ? 'chinois' : 'anglais'}. Date: ${today}.
${scheduleStr}
day_index: 0=Lun 1=Mar 2=Mer 3=Jeu 4=Ven 5=Sam 6=Dim. Pour utiliser un ID complet, cherche dans la liste par correspondance (matière+jour).

1. AJOUTER cours: <SCHEDULE_ADD_JSON>[{"week":"A","day_index":0,"subj":"Maths","time_slot":"08:00 - 10:00"}]</SCHEDULE_ADD_JSON>
2. SUPPRIMER cours: <SCHEDULE_DELETE_JSON>[{"id":"ID_COMPLET_UUID"}]</SCHEDULE_DELETE_JSON>
3. MODIFIER cours: <SCHEDULE_UPDATE_JSON>[{"id":"ID_COMPLET_UUID","subj":"Nouveau","time_slot":"10:00","day_index":1}]</SCHEDULE_UPDATE_JSON>
${hasImages ? '4. IMAGE EDT: <SCHEDULE_JSON>[...]</SCHEDULE_JSON>' : ''}

${hwStr}
AJOUTER devoir: <HOMEWORK_JSON>[{"subject":"Maths","task":"Ex 1-5","due_date":"${todayStr}","priority":"normal"}]</HOMEWORK_JSON>
MODIFIER devoir: <HOMEWORK_UPDATE_JSON>[{"id":"ID_COMPLET_UUID","progression":75}]</HOMEWORK_UPDATE_JSON>
ÉVÉNEMENT: <EVENT_JSON>[{"title":"Contrôle","event_date":"${todayStr}","event_time":"09:00","category":"exam"}]</EVENT_JSON>
Catégories: exam homework meeting trip sport reminder general`;
  }, [existingSchedule, existingHomework, lang]);

  // ✅ FIX #7 — useCallback sur sendMessage
  const sendMessage = useCallback(async (input: string, attachedImages: any[]) => {
    if ((!input.trim() && attachedImages.length === 0) || loading) return;

    const userMsg = input.trim();
    const hasImages = attachedImages.length > 0;

    const contentParts: any[] = [];
    if (userMsg) contentParts.push({ type: 'text', text: userMsg });
    else if (hasImages) contentParts.push({ type: 'text', text: "Analyse cet emploi du temps et propose de l'importer." });
    attachedImages.forEach(img => contentParts.push({
      type: 'image_url',
      image_url: { url: `data:${img.mediaType};base64,${img.base64Data}` }
    }));

    const displayContent = userMsg || '📸 Image(s) envoyée(s)';
    const newMessages: Message[] = [...messages, {
      role: 'user', content: displayContent,
      images: attachedImages.map(i => i.preview)
    }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const apiMessages = newMessages.filter(m => m.role !== 'system').map((m, i) => ({
        role: m.role,
        content: (i === newMessages.length - 1 && hasImages) ? contentParts : m.content
      }));

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({
          messages: apiMessages,
          system: buildSystemPrompt(hasImages)
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.error || 'Une erreur est survenue.' }]);
        return;
      }

      if (data.newTokens !== undefined) {
        useUserStore.getState().setCredits(data.newTokens);
      }

      const { cleanReply, actions: parsed } = parseAIResponse(data.response || '');
      setMessages(prev => [...prev, { role: 'assistant', content: cleanReply }]);
      setActions(parsed);

    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Erreur technique. Veuillez réessayer.' }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, buildSystemPrompt]);

  // ✅ FIX #7 — useCallback sur les handlers d'import
  const doScheduleOp = useCallback(async (
    entries: any[], opAction: string,
    successMsg: (d: any) => string, clearFn: () => void
  ) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/schedule-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries, action: opAction, authToken: session.access_token })
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, { role: 'assistant', content: successMsg(data) }]);
        clearFn();
        refreshData();
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `❌ Erreur : ${data.error}` }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Erreur technique.' }]);
    }
  }, [refreshData]);

  const doHomeworkOp = useCallback(async (entries: any[], isUpdate = false) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/homework-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries, authToken: session.access_token })
      });
      const data = await res.json();
      if (data.success) {
        const msg = isUpdate
          ? `✅ ${data.updated} devoir(s) mis à jour ! 📊`
          : `✅ ${data.inserted} devoir(s) ajouté(s) ! 📚`;
        setMessages(prev => [...prev, { role: 'assistant', content: msg }]);
        refreshData();
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `❌ Erreur : ${data.error}` }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Erreur technique.' }]);
    }
  }, [refreshData]);

  const doEventOp = useCallback(async (entries: any[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/events-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries, authToken: session.access_token })
      });
      const data = await res.json();
      if (data.success) setMessages(prev => [...prev, { role: 'assistant', content: `✅ ${data.inserted} événement(s) ajouté(s) ! 🗓️` }]);
      else setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${data.error}` }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Erreur technique.' }]);
    }
  }, []);

  const clearChat = useCallback(() => {
    setMessages([{ role: 'assistant', content: '💬 Nouvelle conversation démarrée.' }]);
    setActions({ scheduleData: null, scheduleAddData: null, scheduleDeleteData: null,
      scheduleUpdateData: null, homeworkData: null, homeworkUpdateData: null, eventData: null });
  }, []);

  const clearAction = useCallback((key: keyof ParsedAIActions) => {
    setActions(prev => ({ ...prev, [key]: null }));
  }, []);

  return { messages, loading, actions, sendMessage, doScheduleOp, doHomeworkOp, doEventOp, clearChat, clearAction };
}

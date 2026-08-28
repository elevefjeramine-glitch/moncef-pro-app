// ✅ FIX #7 #8 — Hook dédié pour les données EDT et devoirs avec TanStack Query
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/utils/supabase/client";
import { useUserStore } from "@/store/useUserStore";

export function useAIData() {
  const { user } = useUserStore();
  const queryClient = useQueryClient();

  // ✅ FIX #6 — Limite à 30 entrées, sélection minimale pour réduire le prompt
  const { data: existingSchedule = [] } = useQuery({
    queryKey: ['ai-schedule', user?.id],
    queryFn: async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) return [];
      const { data } = await supabase
        .from('schedule')
        .select('id, week, day_index, subj, time_slot')
        .order('day_index')
        .order('time_slot')
        .limit(30); // ✅ FIX #6 — Max 30 entrées
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const { data: existingHomework = [] } = useQuery({
    queryKey: ['ai-homework', user?.id],
    queryFn: async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) return [];
      const { data } = await supabase
        .from('homework')
        .select('id, subject, task, due_date, progression, status, priority')
        .order('created_at', { ascending: false })
        .limit(30); // ✅ FIX #6 — Max 30 entrées
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  // ✅ FIX #8 — Invalidation via TanStack Query (pas de rechargement manuel)
  const refreshData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['ai-schedule', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['ai-homework', user?.id] });
    queryClient.invalidateQueries({ queryKey: ['homeworks', user?.id] });
  }, [queryClient, user?.id]);

  return { existingSchedule, existingHomework, refreshData };
}

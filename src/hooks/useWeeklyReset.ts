import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, format } from "date-fns";

export const useWeeklyReset = (userId: string | undefined) => {
  useEffect(() => {
    if (!userId) return;

    const checkAndResetWeek = async () => {
      const today = new Date();
      const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
      const currentWeekStartStr = format(currentWeekStart, 'yyyy-MM-dd');

      // Check last reset date in localStorage
      const lastResetKey = `weekly_reset_${userId}`;
      const lastReset = localStorage.getItem(lastResetKey);

      if (lastReset === currentWeekStartStr) {
        // Already reset for this week
        return;
      }

      console.log('Checking weekly reset for user:', userId);

      // Check if current week exists
      const { data: currentWeek } = await supabase
        .from('semanas')
        .select('id')
        .eq('user_id', userId)
        .eq('fecha_inicio', currentWeekStartStr)
        .maybeSingle();

      if (!currentWeek) {
        // New week started, reset all envelope weekly spending
        const { error: resetError } = await supabase
          .from('sobres')
          .update({ 
            gastado_semana: 0,
            restante_semana: supabase.rpc ? undefined : 0 // Will be calculated separately
          })
          .eq('user_id', userId);

        if (resetError) {
          console.error('Error resetting envelopes:', resetError);
          return;
        }

        // Update restante_semana to match semanal_calculado
        const { data: sobres } = await supabase
          .from('sobres')
          .select('id, semanal_calculado')
          .eq('user_id', userId);

        if (sobres) {
          for (const sobre of sobres) {
            await supabase
              .from('sobres')
              .update({ restante_semana: sobre.semanal_calculado })
              .eq('id', sobre.id);
          }
        }

        console.log('Weekly envelope reset completed');
      }

      // Mark this week as reset
      localStorage.setItem(lastResetKey, currentWeekStartStr);
    };

    checkAndResetWeek();
  }, [userId]);
};
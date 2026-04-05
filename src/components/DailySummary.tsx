import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";

interface DailySummaryProps {
  userId: string;
  selectedDate: Date;
  refreshTrigger?: number;
}

interface DailyData {
  amanecimos: number;
  totalDia: number;
  anochecemos: number;
}

export const DailySummary = ({ userId, selectedDate, refreshTrigger }: DailySummaryProps) => {
  const [data, setData] = useState<DailyData>({ amanecimos: 0, totalDia: 0, anochecemos: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => { loadDailyData(); }, 100);
    return () => clearTimeout(timer);
  }, [userId, selectedDate, refreshTrigger]);

  const loadDailyData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const todayStr = format(selectedDate, 'yyyy-MM-dd');
      const yesterdayStr = format(subDays(selectedDate, 1), 'yyyy-MM-dd');

      const { data: allPreviousMovements } = await supabase
        .from('movimientos').select('monto, tipo, fecha').eq('user_id', userId)
        .lte('fecha', yesterdayStr).order('fecha', { ascending: true });

      const { data: semanas } = await supabase
        .from('semanas').select('saldo_inicial, fecha_inicio').eq('user_id', userId)
        .order('fecha_inicio', { ascending: true }).limit(1);

      let saldoBase = semanas?.[0]?.saldo_inicial || 0;
      let saldoAcumulado = Number(saldoBase);
      if (allPreviousMovements) {
        allPreviousMovements.forEach(mov => {
          saldoAcumulado += mov.tipo === 'ingreso' ? Number(mov.monto) : -Number(mov.monto);
        });
      }
      const amanecimos = saldoAcumulado;

      const { data: todayMovements } = await supabase
        .from('movimientos').select('monto, tipo').eq('user_id', userId).eq('fecha', todayStr);

      let totalGastosHoy = 0;
      let totalIngresosHoy = 0;
      if (todayMovements) {
        todayMovements.forEach(mov => {
          if (mov.tipo === 'gasto') totalGastosHoy += Number(mov.monto);
          else totalIngresosHoy += Number(mov.monto);
        });
      }

      setData({
        amanecimos,
        totalDia: totalGastosHoy,
        anochecemos: amanecimos + totalIngresosHoy - totalGastosHoy
      });
    } catch (error) {
      console.error('Error cargando resumen diario:', error);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) {
    return (
      <div className="rounded-2xl bg-card border-0 shadow-sm overflow-hidden animate-pulse h-20" />
    );
  }

  return (
    <div className="rounded-2xl bg-card border-0 shadow-sm overflow-hidden">
      <div className="grid grid-cols-3 divide-x divide-border/50">
        <div className="p-4 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1 font-medium">Amanecimos</p>
          <p className="text-xl font-light tabular-nums">${fmt(data.amanecimos)}</p>
        </div>
        <div className="p-4 text-center">
          <p className="text-[10px] text-destructive uppercase tracking-widest mb-1 font-medium">Gastos</p>
          <p className="text-xl font-light tabular-nums text-destructive">-${fmt(data.totalDia)}</p>
        </div>
        <div className="p-4 text-center">
          <p className={`text-[10px] uppercase tracking-widest mb-1 font-medium ${data.anochecemos >= data.amanecimos ? 'text-success' : 'text-destructive'}`}>Anochecemos</p>
          <p className={`text-xl font-light tabular-nums ${data.anochecemos >= data.amanecimos ? 'text-success' : 'text-destructive'}`}>${fmt(data.anochecemos)}</p>
        </div>
      </div>
    </div>
  );
};

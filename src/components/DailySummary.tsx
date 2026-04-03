import { Card } from "@/components/ui/card";
import { Sunrise, Sun, Sunset } from "lucide-react";
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

  const formatMoney = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="p-5 h-24 bg-card rounded-2xl border-0 shadow-sm animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Amanecimos con */}
      <Card className="p-5 rounded-2xl border-0 shadow-sm bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium tracking-wide uppercase">
              Amanecimos con
            </p>
            <p className="text-3xl font-light text-foreground tabular-nums">
              ${formatMoney(data.amanecimos)}
            </p>
          </div>
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Sunrise className="h-5 w-5 text-primary" />
          </div>
        </div>
      </Card>

      {/* Gastos del día */}
      <Card className="p-5 rounded-2xl border-0 shadow-sm bg-gradient-to-br from-destructive/5 to-destructive/10 dark:from-destructive/10 dark:to-destructive/5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium tracking-wide uppercase">
              Gastos del día
            </p>
            <p className="text-3xl font-light text-destructive tabular-nums">
              -${formatMoney(data.totalDia)}
            </p>
          </div>
          <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
            <Sun className="h-5 w-5 text-destructive" />
          </div>
        </div>
      </Card>

      {/* Anochecemos con */}
      <Card className={`p-5 rounded-2xl border-0 shadow-sm bg-gradient-to-br ${
        data.anochecemos >= data.amanecimos 
          ? "from-success/5 to-success/10 dark:from-success/10 dark:to-success/5"
          : "from-destructive/5 to-destructive/10 dark:from-destructive/10 dark:to-destructive/5"
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium tracking-wide uppercase">
              Anochecemos con
            </p>
            <p className={`text-3xl font-light tabular-nums ${
              data.anochecemos >= data.amanecimos ? "text-success" : "text-destructive"
            }`}>
              ${formatMoney(data.anochecemos)}
            </p>
          </div>
          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
            data.anochecemos >= data.amanecimos ? "bg-success/10" : "bg-destructive/10"
          }`}>
            <Sunset className={`h-5 w-5 ${
              data.anochecemos >= data.amanecimos ? "text-success" : "text-destructive"
            }`} />
          </div>
        </div>
      </Card>
    </div>
  );
};

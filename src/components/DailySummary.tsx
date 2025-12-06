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
    // Pequeño delay para asegurar que los datos estén disponibles después de una inserción
    const timer = setTimeout(() => {
      loadDailyData();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [userId, selectedDate, refreshTrigger]);

  const loadDailyData = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      // Use Mexico timezone for date formatting
      const mexicoFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      
      const todayStr = format(selectedDate, 'yyyy-MM-dd');
      const yesterdayStr = format(subDays(selectedDate, 1), 'yyyy-MM-dd');

      // Obtener el "Anochecemos con" del día anterior (que es nuestro "Amanecimos con")
      // Primero buscamos todos los movimientos hasta ayer para calcular el saldo
      const { data: allPreviousMovements } = await supabase
        .from('movimientos')
        .select('monto, tipo, fecha')
        .eq('user_id', userId)
        .lte('fecha', yesterdayStr)
        .order('fecha', { ascending: true });

      // Buscar si hay un saldo inicial definido en la semana más antigua
      const { data: semanas } = await supabase
        .from('semanas')
        .select('saldo_inicial, fecha_inicio')
        .eq('user_id', userId)
        .order('fecha_inicio', { ascending: true })
        .limit(1);

      let saldoBase = semanas?.[0]?.saldo_inicial || 0;

      // Calcular el saldo acumulado hasta ayer
      let saldoAcumulado = Number(saldoBase);
      if (allPreviousMovements) {
        allPreviousMovements.forEach(mov => {
          if (mov.tipo === 'ingreso') {
            saldoAcumulado += Number(mov.monto);
          } else {
            saldoAcumulado -= Number(mov.monto);
          }
        });
      }

      // Este saldo acumulado es nuestro "Amanecimos con" de hoy
      const amanecimos = saldoAcumulado;

      // Obtener los gastos de hoy
      const { data: todayMovements } = await supabase
        .from('movimientos')
        .select('monto, tipo')
        .eq('user_id', userId)
        .eq('fecha', todayStr);

      let totalGastosHoy = 0;
      let totalIngresosHoy = 0;

      if (todayMovements) {
        todayMovements.forEach(mov => {
          if (mov.tipo === 'gasto') {
            totalGastosHoy += Number(mov.monto);
          } else {
            totalIngresosHoy += Number(mov.monto);
          }
        });
      }

      // Total del día = gastos - ingresos (mostrar flujo neto negativo)
      const totalDia = totalGastosHoy;
      
      // Anochecemos = Amanecimos + ingresos - gastos
      const anochecemos = amanecimos + totalIngresosHoy - totalGastosHoy;

      setData({
        amanecimos,
        totalDia,
        anochecemos
      });
    } catch (error) {
      console.error('Error cargando resumen diario:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
        {[1, 2, 3].map(i => (
          <Card key={i} className="p-4 h-20 bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Amanecimos con */}
      <Card className="p-4 shadow-md bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-950/30 border-amber-200 dark:border-amber-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-amber-700 dark:text-amber-300 mb-1 font-medium">
              Amanecimos con
            </p>
            <p className="text-xl font-bold text-amber-900 dark:text-amber-100 tabular-nums">
              ${data.amanecimos.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-2 bg-amber-200/50 dark:bg-amber-800/50 rounded-full">
            <Sunrise className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
        </div>
      </Card>

      {/* Gastos del día */}
      <Card className="p-4 shadow-md bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-950/30 border-red-200 dark:border-red-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-red-700 dark:text-red-300 mb-1 font-medium">
              Gastos del día
            </p>
            <p className="text-xl font-bold text-red-900 dark:text-red-100 tabular-nums">
              -${data.totalDia.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-2 bg-red-200/50 dark:bg-red-800/50 rounded-full">
            <Sun className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
        </div>
      </Card>

      {/* Anochecemos con */}
      <Card className={`p-4 shadow-md bg-gradient-to-br ${
        data.anochecemos >= data.amanecimos 
          ? "from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-950/30 border-emerald-200 dark:border-emerald-800"
          : "from-orange-100 to-orange-50 dark:from-orange-900/30 dark:to-orange-950/30 border-orange-200 dark:border-orange-800"
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-xs mb-1 font-medium ${
              data.anochecemos >= data.amanecimos 
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-orange-700 dark:text-orange-300"
            }`}>
              Anochecemos con
            </p>
            <p className={`text-xl font-bold tabular-nums ${
              data.anochecemos >= data.amanecimos 
                ? "text-emerald-900 dark:text-emerald-100"
                : "text-orange-900 dark:text-orange-100"
            }`}>
              ${data.anochecemos.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className={`p-2 rounded-full ${
            data.anochecemos >= data.amanecimos 
              ? "bg-emerald-200/50 dark:bg-emerald-800/50"
              : "bg-orange-200/50 dark:bg-orange-800/50"
          }`}>
            <Sunset className={`h-5 w-5 ${
              data.anochecemos >= data.amanecimos 
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-orange-600 dark:text-orange-400"
            }`} />
          </div>
        </div>
      </Card>
    </div>
  );
};

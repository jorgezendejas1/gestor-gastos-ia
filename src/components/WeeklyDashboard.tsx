import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { es } from "date-fns/locale";
import { Download, AlertTriangle, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface WeeklyDashboardProps {
  userId: string;
}

interface WeekData {
  saldo_inicial: number;
  saldo_final: number;
  ingresos_totales: number;
  gastos_totales: number;
  fecha_inicio: string;
  fecha_fin: string;
}

interface EnvelopeData {
  nombre: string;
  gastado_semana: number;
  semanal_calculado: number;
  mensual: number;
  gastado_mensual: number;
  percentage: number;
  percentageMensual: number;
  isOverBudget: boolean;
  isMonthlyExhausted: boolean;
}

export const WeeklyDashboard = ({ userId }: WeeklyDashboardProps) => {
  const [weekData, setWeekData] = useState<WeekData | null>(null);
  const [envelopeData, setEnvelopeData] = useState<EnvelopeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadDashboardData(); }, [userId]);

  const loadDashboardData = async () => {
    try {
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

      const { data: semana } = await supabase.from('semanas').select('*')
        .eq('user_id', userId).eq('fecha_inicio', format(weekStart, 'yyyy-MM-dd')).maybeSingle();

      if (semana) {
        setWeekData(semana);
        await supabase.from('movimientos').select('*').eq('semana_id', semana.id).eq('tipo', 'gasto');
      }

      const { data: sobres } = await supabase.from('sobres').select('*').eq('user_id', userId).order('nombre');

      if (sobres) {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const { data: monthlyMovimientos } = await supabase.from('movimientos').select('*')
          .eq('user_id', userId).eq('tipo', 'gasto')
          .gte('fecha', format(monthStart, 'yyyy-MM-dd')).lte('fecha', format(monthEnd, 'yyyy-MM-dd'));

        const monthlySpendingByEnvelope: Record<string, number> = {};
        if (monthlyMovimientos) {
          monthlyMovimientos.forEach((mov) => {
            const cat = mov.categoria || 'OTRAS';
            monthlySpendingByEnvelope[cat] = (monthlySpendingByEnvelope[cat] || 0) + Number(mov.monto);
          });
        }

        setEnvelopeData(sobres.map((sobre) => {
          const gastado = Number(sobre.gastado_semana || 0);
          const presupuesto = Number(sobre.semanal_calculado);
          const mensual = Number(sobre.mensual);
          const gastadoMensual = monthlySpendingByEnvelope[sobre.nombre] || 0;
          return {
            nombre: sobre.nombre, gastado_semana: gastado, semanal_calculado: presupuesto,
            mensual, gastado_mensual: gastadoMensual,
            percentage: presupuesto > 0 ? (gastado / presupuesto) * 100 : 0,
            percentageMensual: mensual > 0 ? (gastadoMensual / mensual) * 100 : 0,
            isOverBudget: gastado > presupuesto, isMonthlyExhausted: gastadoMensual >= mensual,
          };
        }));
      }
      setLoading(false);
    } catch { setLoading(false); }
  };

  const exportToCSV = () => {
    if (!weekData) return;
    const rows = [
      ['Reporte Semanal'], ['Semana:', `${weekData.fecha_inicio} al ${weekData.fecha_fin}`], [],
      ['Resumen'], ['Saldo Inicial', weekData.saldo_inicial.toFixed(2)],
      ['Ingresos', weekData.ingresos_totales.toFixed(2)], ['Gastos', weekData.gastos_totales.toFixed(2)],
      ['Saldo Final', weekData.saldo_final.toFixed(2)], [], ['Gastos por Sobre'],
      ['Sobre', 'Gastado', 'Presupuesto', 'Porcentaje', 'Estado'],
      ...envelopeData.map(env => [env.nombre, env.gastado_semana.toFixed(2), env.semanal_calculado.toFixed(2), `${env.percentage.toFixed(1)}%`, env.isOverBudget ? 'Excedido' : 'OK']),
    ];
    const csv = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = window.URL.createObjectURL(blob);
    a.download = `reporte-semanal-${weekData.fecha_inicio}.csv`;
    a.click();
  };

  const exportToPDF = () => {
    if (!weekData) return;
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text('Reporte Semanal', 14, 20);
    doc.setFontSize(12); doc.text(`Semana: ${weekData.fecha_inicio} al ${weekData.fecha_fin}`, 14, 28);
    doc.setFontSize(14); doc.text('Resumen', 14, 40);
    autoTable(doc, {
      startY: 45, head: [['Concepto', 'Monto']],
      body: [['Saldo Inicial', `$${weekData.saldo_inicial.toFixed(2)}`], ['Ingresos', `$${weekData.ingresos_totales.toFixed(2)}`], ['Gastos', `$${weekData.gastos_totales.toFixed(2)}`], ['Saldo Final', `$${weekData.saldo_final.toFixed(2)}`]],
    });
    const finalY2 = (doc as any).lastAutoTable.finalY || 70;
    doc.setFontSize(14); doc.text('Gastos por Sobre', 14, finalY2 + 10);
    autoTable(doc, {
      startY: finalY2 + 15, head: [['Sobre', 'Gastado', 'Presupuesto', '%', 'Estado']],
      body: envelopeData.map(env => [env.nombre, `$${env.gastado_semana.toFixed(2)}`, `$${env.semanal_calculado.toFixed(2)}`, `${env.percentage.toFixed(1)}%`, env.isOverBudget ? 'Excedido' : 'OK']),
    });
    doc.save(`reporte-semanal-${weekData.fecha_inicio}.pdf`);
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-card border-0 shadow-sm p-6">
        <p className="text-muted-foreground text-center font-light">Cargando dashboard...</p>
      </div>
    );
  }

  if (!weekData) {
    return (
      <div className="rounded-2xl bg-card border-0 shadow-sm p-6">
        <p className="text-muted-foreground text-center font-light">No hay datos para esta semana</p>
      </div>
    );
  }

  const overBudgetEnvelopes = envelopeData.filter(env => env.isOverBudget && !env.isMonthlyExhausted);
  const monthlyExhaustedEnvelopes = envelopeData.filter(env => env.isMonthlyExhausted);

  const kpiItems = [
    { label: "Saldo Inicial", value: weekData.saldo_inicial, color: "text-foreground" },
    { label: "Ingresos", value: weekData.ingresos_totales, color: "text-success" },
    { label: "Gastos", value: weekData.gastos_totales, color: "text-destructive" },
    { label: "Saldo Final", value: weekData.saldo_final, color: weekData.saldo_final >= 0 ? "text-success" : "text-destructive" },
  ];

  return (
    <div className="space-y-5">
      {/* Alerts */}
      {monthlyExhaustedEnvelopes.length > 0 && (
        <Alert variant="destructive" className="rounded-2xl border-0 bg-destructive/10">
          <AlertTriangle className="h-5 w-5" />
          <AlertDescription>
            <strong>Presupuesto mensual agotado:</strong>
            <ul className="mt-1 space-y-0.5">
              {monthlyExhaustedEnvelopes.map(env => (
                <li key={env.nombre} className="text-sm font-light">
                  {env.nombre}: ${env.gastado_mensual.toFixed(2)} / ${env.mensual.toFixed(2)}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {overBudgetEnvelopes.length > 0 && (
        <Alert className="rounded-2xl border-0 bg-destructive/5">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <AlertDescription>
            <strong>Sobres excedidos esta semana:</strong>
            <ul className="mt-1 space-y-0.5">
              {overBudgetEnvelopes.map(env => (
                <li key={env.nombre} className="text-sm font-light">
                  {env.nombre}: ${env.gastado_semana.toFixed(2)} / ${env.semanal_calculado.toFixed(2)}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Single card with 4 KPI sections */}
      <div className="rounded-2xl bg-card border-0 shadow-sm overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-border/50">
          {kpiItems.map((kpi) => (
            <div key={kpi.label} className="p-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">{kpi.label}</p>
              <p className={`text-2xl font-light tabular-nums ${kpi.color}`}>${kpi.value.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Export */}
      <div className="flex gap-3">
        <Button onClick={exportToCSV} variant="outline" className="rounded-xl text-sm font-medium">
          <Download className="h-4 w-4 mr-2" />
          CSV
        </Button>
        <Button onClick={exportToPDF} variant="outline" className="rounded-xl text-sm font-medium">
          <Download className="h-4 w-4 mr-2" />
          PDF
        </Button>
      </div>
    </div>
  );
};

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { es } from "date-fns/locale";
import { Download, AlertTriangle, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
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

  useEffect(() => {
    loadDashboardData();
  }, [userId]);

  const loadDashboardData = async () => {
    try {
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

      // Fetch current week data
      const { data: semana } = await supabase
        .from('semanas')
        .select('*')
        .eq('user_id', userId)
        .eq('fecha_inicio', format(weekStart, 'yyyy-MM-dd'))
        .maybeSingle();

      if (semana) {
        setWeekData(semana);

        // Fetch transactions for this week
        const { data: movimientos } = await supabase
          .from('movimientos')
          .select('*')
          .eq('semana_id', semana.id)
          .eq('tipo', 'gasto');

      }

      // Fetch envelope data with monthly spending calculation
      const { data: sobres } = await supabase
        .from('sobres')
        .select('*')
        .eq('user_id', userId)
        .order('nombre');

      if (sobres) {
        // Get current month's start and end dates
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        // Fetch all transactions for current month to calculate monthly spending per envelope
        const { data: monthlyMovimientos } = await supabase
          .from('movimientos')
          .select('*')
          .eq('user_id', userId)
          .eq('tipo', 'gasto')
          .gte('fecha', format(monthStart, 'yyyy-MM-dd'))
          .lte('fecha', format(monthEnd, 'yyyy-MM-dd'));

        // Calculate monthly spending per envelope
        const monthlySpendingByEnvelope: Record<string, number> = {};
        if (monthlyMovimientos) {
          monthlyMovimientos.forEach((mov) => {
            const categoria = mov.categoria || 'OTRAS';
            monthlySpendingByEnvelope[categoria] = (monthlySpendingByEnvelope[categoria] || 0) + Number(mov.monto);
          });
        }

        const envelopes: EnvelopeData[] = sobres.map((sobre) => {
          const gastado = Number(sobre.gastado_semana || 0);
          const presupuesto = Number(sobre.semanal_calculado);
          const mensual = Number(sobre.mensual);
          const gastadoMensual = monthlySpendingByEnvelope[sobre.nombre] || 0;
          const percentage = presupuesto > 0 ? (gastado / presupuesto) * 100 : 0;
          const percentageMensual = mensual > 0 ? (gastadoMensual / mensual) * 100 : 0;

          return {
            nombre: sobre.nombre,
            gastado_semana: gastado,
            semanal_calculado: presupuesto,
            mensual,
            gastado_mensual: gastadoMensual,
            percentage,
            percentageMensual,
            isOverBudget: gastado > presupuesto,
            isMonthlyExhausted: gastadoMensual >= mensual,
          };
        });

        setEnvelopeData(envelopes);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!weekData) return;

    const rows = [
      ['Reporte Semanal'],
      ['Semana:', `${weekData.fecha_inicio} al ${weekData.fecha_fin}`],
      [],
      ['Resumen'],
      ['Saldo Inicial', weekData.saldo_inicial.toFixed(2)],
      ['Ingresos', weekData.ingresos_totales.toFixed(2)],
      ['Gastos', weekData.gastos_totales.toFixed(2)],
      ['Saldo Final', weekData.saldo_final.toFixed(2)],
      [],
      ['Gastos por Sobre'],
      ['Sobre', 'Gastado', 'Presupuesto', 'Porcentaje', 'Estado'],
      ...envelopeData.map(env => [
        env.nombre,
        env.gastado_semana.toFixed(2),
        env.semanal_calculado.toFixed(2),
        `${env.percentage.toFixed(1)}%`,
        env.isOverBudget ? 'Excedido' : 'OK'
      ]),
    ];

    const csv = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-semanal-${weekData.fecha_inicio}.csv`;
    a.click();
  };

  const exportToPDF = () => {
    if (!weekData) return;

    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text('Reporte Semanal', 14, 20);
    doc.setFontSize(12);
    doc.text(`Semana: ${weekData.fecha_inicio} al ${weekData.fecha_fin}`, 14, 28);

    // Summary
    doc.setFontSize(14);
    doc.text('Resumen', 14, 40);
    autoTable(doc, {
      startY: 45,
      head: [['Concepto', 'Monto']],
      body: [
        ['Saldo Inicial', `$${weekData.saldo_inicial.toFixed(2)}`],
        ['Ingresos', `$${weekData.ingresos_totales.toFixed(2)}`],
        ['Gastos', `$${weekData.gastos_totales.toFixed(2)}`],
        ['Saldo Final', `$${weekData.saldo_final.toFixed(2)}`],
      ],
    });

    // Envelope breakdown
    const finalY2 = (doc as any).lastAutoTable.finalY || 70;
    doc.setFontSize(14);
    doc.text('Gastos por Sobre', 14, finalY2 + 10);
    autoTable(doc, {
      startY: finalY2 + 15,
      head: [['Sobre', 'Gastado', 'Presupuesto', '%', 'Estado']],
      body: envelopeData.map(env => [
        env.nombre,
        `$${env.gastado_semana.toFixed(2)}`,
        `$${env.semanal_calculado.toFixed(2)}`,
        `${env.percentage.toFixed(1)}%`,
        env.isOverBudget ? 'Excedido' : 'OK'
      ]),
    });

    doc.save(`reporte-semanal-${weekData.fecha_inicio}.pdf`);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">Cargando dashboard...</p>
        </CardContent>
      </Card>
    );
  }

  if (!weekData) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">No hay datos para esta semana</p>
        </CardContent>
      </Card>
    );
  }

  const overBudgetEnvelopes = envelopeData.filter(env => env.isOverBudget && !env.isMonthlyExhausted);
  const monthlyExhaustedEnvelopes = envelopeData.filter(env => env.isMonthlyExhausted);

  return (
    <div className="space-y-6">
      {/* Monthly Exhausted Alerts - Higher Priority */}
      {monthlyExhaustedEnvelopes.length > 0 && (
        <Alert variant="destructive" className="border-2 border-destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>🚨 ¡PRESUPUESTO MENSUAL AGOTADO!</strong> Los siguientes sobres han consumido TODO su presupuesto del mes:
            <ul className="mt-2 list-disc list-inside">
              {monthlyExhaustedEnvelopes.map(env => (
                <li key={env.nombre}>
                  <strong>{env.nombre}</strong>: ${env.gastado_mensual.toFixed(2)} / ${env.mensual.toFixed(2)} mensual ({env.percentageMensual.toFixed(1)}%)
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Weekly Over Budget Alerts */}
      {overBudgetEnvelopes.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>¡Alerta semanal!</strong> Los siguientes sobres han excedido su presupuesto semanal:
            <ul className="mt-2 list-disc list-inside">
              {overBudgetEnvelopes.map(env => (
                <li key={env.nombre}>
                  {env.nombre}: ${env.gastado_semana.toFixed(2)} / ${env.semanal_calculado.toFixed(2)} ({env.percentage.toFixed(1)}%)
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Inicial</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${weekData.saldo_inicial.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${weekData.ingresos_totales.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">${weekData.gastos_totales.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Final</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${weekData.saldo_final >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${weekData.saldo_final.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Exportar Reporte</CardTitle>
          <CardDescription>Descarga el reporte semanal en diferentes formatos</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button onClick={exportToCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
          <Button onClick={exportToPDF} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

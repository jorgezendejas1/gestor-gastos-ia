import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Download, TrendingUp, TrendingDown, DollarSign, Calendar, AlertCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, eachWeekOfInterval, eachMonthOfInterval } from "date-fns";
import { es } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface AdvancedAnalyticsProps {
  userId: string;
}

interface KPIData {
  avgDailySpending: number;
  mostExpensiveWeek: { week: string; amount: number };
  cheapestWeek: { week: string; amount: number };
  dominantCategory: { name: string; amount: number; percentage: number };
  incomeSpentPercentage: number;
  totalIncome: number;
  totalExpenses: number;
}

const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#84cc16', '#06b6d4'];

export const AdvancedAnalytics = ({ userId }: AdvancedAnalyticsProps) => {
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [categoryTrends, setCategoryTrends] = useState<any[]>([]);
  const [weeklyComparison, setWeeklyComparison] = useState<any[]>([]);
  const [budgetVsActual, setBudgetVsActual] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
    loadAnalytics();
  }, [userId, period]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDate: Date;
      let endDate: Date;

      switch (period) {
        case 'weekly':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90); // Last 3 months
          endDate = now;
          break;
        case 'monthly':
          startDate = startOfYear(now);
          endDate = endOfYear(now);
          break;
        case 'yearly':
          startDate = new Date(now.getFullYear() - 2, 0, 1);
          endDate = endOfYear(now);
          break;
      }

      // Fetch all transactions in period
      const { data: movimientos, error: movError } = await supabase
        .from('movimientos')
        .select('*')
        .eq('user_id', userId)
        .gte('fecha', format(startDate, 'yyyy-MM-dd'))
        .lte('fecha', format(endDate, 'yyyy-MM-dd'))
        .order('fecha', { ascending: true });

      if (movError) throw movError;

      // Fetch all weeks in period
      const { data: semanas, error: semError } = await supabase
        .from('semanas')
        .select('*')
        .eq('user_id', userId)
        .gte('fecha_inicio', format(startDate, 'yyyy-MM-dd'))
        .lte('fecha_fin', format(endDate, 'yyyy-MM-dd'))
        .order('fecha_inicio', { ascending: true });

      if (semError) throw semError;

      // Fetch envelopes for budget comparison
      const { data: sobres, error: sobresError } = await supabase
        .from('sobres')
        .select('*')
        .eq('user_id', userId);

      if (sobresError) throw sobresError;

      if (!movimientos || !semanas) {
        setLoading(false);
        return;
      }

      // Calculate KPIs
      calculateKPIs(movimientos, semanas);

      // Calculate category trends
      calculateCategoryTrends(movimientos);

      // Calculate weekly comparison
      calculateWeeklyComparison(semanas);

      // Calculate budget vs actual
      calculateBudgetVsActual(sobres || [], movimientos);

      // Generate alerts
      generateAlerts(sobres || [], semanas);

    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error('Error al cargar análisis');
    } finally {
      setLoading(false);
    }
  };

  const calculateKPIs = (movimientos: any[], semanas: any[]) => {
    const expenses = movimientos.filter(m => m.tipo === 'gasto');
    const income = movimientos.filter(m => m.tipo === 'ingreso');

    const totalExpenses = expenses.reduce((sum, m) => sum + Number(m.monto), 0);
    const totalIncome = income.reduce((sum, m) => sum + Number(m.monto), 0);

    // Average daily spending
    const days = movimientos.length > 0 ? 
      Math.max(1, Math.ceil((new Date(movimientos[movimientos.length - 1].fecha).getTime() - new Date(movimientos[0].fecha).getTime()) / (1000 * 60 * 60 * 24))) : 1;
    const avgDailySpending = totalExpenses / days;

    // Most expensive and cheapest week
    const weekExpenses = semanas.map(s => ({
      week: format(new Date(s.fecha_inicio), 'dd MMM yyyy', { locale: es }),
      amount: Number(s.gastos_totales || 0)
    }));

    const mostExpensiveWeek = weekExpenses.reduce((max, w) => w.amount > max.amount ? w : max, weekExpenses[0] || { week: '-', amount: 0 });
    const cheapestWeek = weekExpenses.reduce((min, w) => w.amount < min.amount && w.amount > 0 ? w : min, weekExpenses[0] || { week: '-', amount: 0 });

    // Dominant category
    const categoryTotals: Record<string, number> = {};
    expenses.forEach(m => {
      const cat = m.categoria || 'Sin categoría';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(m.monto);
    });

    const dominantCat = Object.entries(categoryTotals).reduce((max, [name, amount]) => 
      amount > max.amount ? { name, amount } : max, 
      { name: 'N/A', amount: 0 }
    );

    const dominantCategory = {
      name: dominantCat.name,
      amount: dominantCat.amount,
      percentage: totalExpenses > 0 ? (dominantCat.amount / totalExpenses) * 100 : 0
    };

    // Income spent percentage
    const incomeSpentPercentage = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0;

    setKpis({
      avgDailySpending,
      mostExpensiveWeek,
      cheapestWeek,
      dominantCategory,
      incomeSpentPercentage,
      totalIncome,
      totalExpenses
    });
  };

  const calculateCategoryTrends = (movimientos: any[]) => {
    const expenses = movimientos.filter(m => m.tipo === 'gasto');
    const categoryByMonth: Record<string, Record<string, number>> = {};

    expenses.forEach(m => {
      const month = format(new Date(m.fecha), 'MMM yyyy', { locale: es });
      const cat = m.categoria || 'Sin categoría';
      
      if (!categoryByMonth[month]) categoryByMonth[month] = {};
      categoryByMonth[month][cat] = (categoryByMonth[month][cat] || 0) + Number(m.monto);
    });

    const allCategories = [...new Set(expenses.map(m => m.categoria || 'Sin categoría'))];
    const trends = Object.entries(categoryByMonth).map(([month, cats]) => ({
      month,
      ...cats
    }));

    setCategoryTrends(trends);
  };

  const calculateWeeklyComparison = (semanas: any[]) => {
    const comparison = semanas.map(s => ({
      week: format(new Date(s.fecha_inicio), 'dd MMM', { locale: es }),
      ingresos: Number(s.ingresos_totales || 0),
      gastos: Number(s.gastos_totales || 0),
      saldo: Number(s.saldo_final || 0)
    }));

    setWeeklyComparison(comparison);
  };

  const calculateBudgetVsActual = (sobres: any[], movimientos: any[]) => {
    const expenses = movimientos.filter(m => m.tipo === 'gasto');
    
    const comparison = sobres.map(sobre => {
      const spent = Number(sobre.gastado_semana || 0);
      const budget = Number(sobre.semanal_calculado);
      
      return {
        nombre: sobre.nombre,
        presupuesto: budget,
        gastado: spent,
        diferencia: budget - spent
      };
    });

    setBudgetVsActual(comparison);
  };

  const generateAlerts = (sobres: any[], semanas: any[]) => {
    const newAlerts: string[] = [];

    // Check envelopes over budget
    sobres.forEach(sobre => {
      const spent = Number(sobre.gastado_semana || 0);
      const budget = Number(sobre.semanal_calculado);
      
      if (spent > budget) {
        const excess = spent - budget;
        newAlerts.push(`⚠️ Sobre "${sobre.nombre}" excedido por $${excess.toFixed(2)}`);
      } else if (spent > budget * 0.9) {
        newAlerts.push(`⚡ Sobre "${sobre.nombre}" al ${((spent/budget) * 100).toFixed(0)}% del presupuesto`);
      }
    });

    // Check if current week spending is higher than average
    if (semanas.length > 0) {
      const avgWeeklySpending = semanas.reduce((sum, s) => sum + Number(s.gastos_totales || 0), 0) / semanas.length;
      const currentWeek = semanas[semanas.length - 1];
      const currentSpending = Number(currentWeek.gastos_totales || 0);

      if (currentSpending > avgWeeklySpending * 1.2) {
        newAlerts.push(`📊 Gasto esta semana es 20% mayor al promedio`);
      }
    }

    setAlerts(newAlerts);
  };

  const exportToExcel = () => {
    // Generate CSV (Excel-compatible)
    let csv = 'Reporte de Análisis Avanzado\n\n';
    
    csv += 'KPIs Clave\n';
    csv += `Gasto Diario Promedio,$${kpis?.avgDailySpending.toFixed(2)}\n`;
    csv += `Semana Más Cara,${kpis?.mostExpensiveWeek.week},$${kpis?.mostExpensiveWeek.amount.toFixed(2)}\n`;
    csv += `Semana Más Barata,${kpis?.cheapestWeek.week},$${kpis?.cheapestWeek.amount.toFixed(2)}\n`;
    csv += `Categoría Dominante,${kpis?.dominantCategory.name},${kpis?.dominantCategory.percentage.toFixed(1)}%\n`;
    csv += `% Ingresos Gastados,${kpis?.incomeSpentPercentage.toFixed(1)}%\n\n`;

    csv += 'Presupuesto vs Real\n';
    csv += 'Sobre,Presupuesto,Gastado,Diferencia\n';
    budgetVsActual.forEach(item => {
      csv += `${item.nombre},$${item.presupuesto.toFixed(2)},$${item.gastado.toFixed(2)},$${item.diferencia.toFixed(2)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analisis_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    
    toast.success('Reporte Excel exportado');
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Análisis Avanzado y KPIs', 14, 20);
    doc.setFontSize(10);
    doc.text(`Período: ${period === 'weekly' ? 'Semanal' : period === 'monthly' ? 'Mensual' : 'Anual'}`, 14, 28);
    doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`, 14, 34);

    // KPIs section
    autoTable(doc, {
      startY: 40,
      head: [['KPI', 'Valor']],
      body: [
        ['Gasto Diario Promedio', `$${kpis?.avgDailySpending.toFixed(2)}`],
        ['Semana Más Cara', `${kpis?.mostExpensiveWeek.week} - $${kpis?.mostExpensiveWeek.amount.toFixed(2)}`],
        ['Semana Más Barata', `${kpis?.cheapestWeek.week} - $${kpis?.cheapestWeek.amount.toFixed(2)}`],
        ['Categoría Dominante', `${kpis?.dominantCategory.name} (${kpis?.dominantCategory.percentage.toFixed(1)}%)`],
        ['% Ingresos Gastados', `${kpis?.incomeSpentPercentage.toFixed(1)}%`],
        ['Total Ingresos', `$${kpis?.totalIncome.toFixed(2)}`],
        ['Total Gastos', `$${kpis?.totalExpenses.toFixed(2)}`],
      ],
    });

    // Budget vs Actual section
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [['Sobre', 'Presupuesto', 'Gastado', 'Diferencia']],
      body: budgetVsActual.slice(0, 15).map(item => [
        item.nombre,
        `$${item.presupuesto.toFixed(2)}`,
        `$${item.gastado.toFixed(2)}`,
        `$${item.diferencia.toFixed(2)}`,
      ]),
    });

    doc.save(`analisis_avanzado_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('Reporte PDF exportado');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">Cargando análisis...</div>
        </CardContent>
      </Card>
    );
  }

  if (!kpis) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">No hay datos suficientes para análisis</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with period selector and export buttons */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Análisis Avanzado y KPIs</CardTitle>
              <CardDescription>Análisis profundo de tus finanzas con tendencias e indicadores clave</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportToExcel}>
                <Download className="h-4 w-4 mr-2" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={exportToPDF}>
                <Download className="h-4 w-4 mr-2" />
                PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as any)}>
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="weekly">Semanal</TabsTrigger>
              <TabsTrigger value="monthly">Mensual</TabsTrigger>
              <TabsTrigger value="yearly">Anual</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <AlertCircle className="h-5 w-5" />
              Alertas Inteligentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {alerts.map((alert, idx) => (
                <li key={idx} className="text-sm text-orange-700 dark:text-orange-300">{alert}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gasto Diario Promedio</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${kpis.avgDailySpending.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Semana Más Cara</CardTitle>
            <TrendingUp className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${kpis.mostExpensiveWeek.amount.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{kpis.mostExpensiveWeek.week}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Semana Más Barata</CardTitle>
            <TrendingDown className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${kpis.cheapestWeek.amount.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{kpis.cheapestWeek.week}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">% Ingresos Gastados</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.incomeSpentPercentage.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              ${kpis.totalExpenses.toFixed(2)} de ${kpis.totalIncome.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dominant Category */}
      <Card>
        <CardHeader>
          <CardTitle>Categoría Dominante del Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">{kpis.dominantCategory.name}</div>
          <p className="text-muted-foreground">
            ${kpis.dominantCategory.amount.toFixed(2)} ({kpis.dominantCategory.percentage.toFixed(1)}% del total)
          </p>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Weekly Comparison Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Comparativa Semanal</CardTitle>
            <CardDescription>Ingresos vs Gastos por semana</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyComparison}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip formatter={(value: any) => `$${Number(value).toFixed(2)}`} />
                <Legend />
                <Bar dataKey="ingresos" fill="#10b981" name="Ingresos" />
                <Bar dataKey="gastos" fill="#ef4444" name="Gastos" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Budget vs Actual */}
        <Card>
          <CardHeader>
            <CardTitle>Presupuesto vs Real</CardTitle>
            <CardDescription>Top sobres por diferencia</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={budgetVsActual.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nombre" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip formatter={(value: any) => `$${Number(value).toFixed(2)}`} />
                <Legend />
                <Bar dataKey="presupuesto" fill="#3b82f6" name="Presupuesto" />
                <Bar dataKey="gastado" fill="#ec4899" name="Gastado" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Category Trends */}
      {categoryTrends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tendencias por Categoría</CardTitle>
            <CardDescription>Evolución del gasto por categoría a lo largo del tiempo</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={categoryTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: any) => `$${Number(value).toFixed(2)}`} />
                <Legend />
                {Object.keys(categoryTrends[0] || {})
                  .filter(key => key !== 'month')
                  .slice(0, 5)
                  .map((cat, idx) => (
                    <Line
                      key={cat}
                      type="monotone"
                      dataKey={cat}
                      stroke={COLORS[idx % COLORS.length]}
                      name={cat}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, AlertTriangle, Target, Wallet, PiggyBank, BarChart3, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, format, differenceInDays, subDays } from "date-fns";

interface Props {
  userId: string;
}

interface KPIs {
  avgDailySpending: number;
  topCategory: { name: string; amount: number; percentage: number } | null;
  highestSpendingWeek: { label: string; amount: number } | null;
  incomeSpentPercentage: number;
}

interface Alert {
  type: "warning" | "danger";
  message: string;
  icon: React.ReactNode;
}

const getCancunDate = (): Date => {
  const now = new Date();
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cancun", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
};

const FinancialIntelligence = ({ userId }: Props) => {
  const [kpis, setKpis] = useState<KPIs>({ avgDailySpending: 0, topCategory: null, highestSpendingWeek: null, incomeSpentPercentage: 0 });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [projection, setProjection] = useState<{ projected: number; surplus: boolean; amount: number } | null>(null);
  const [topCategories, setTopCategories] = useState<{ name: string; amount: number; percentage: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const today = getCancunDate();
      const monthStart = startOfMonth(today);
      const monthEnd = endOfMonth(today);

      // Get all movements for the month
      const { data: monthMov } = await supabase
        .from("movimientos")
        .select("*")
        .eq("user_id", userId)
        .gte("fecha", format(monthStart, "yyyy-MM-dd"))
        .lte("fecha", format(monthEnd, "yyyy-MM-dd"));

      // Get last 30 days movements
      const thirtyAgo = format(subDays(today, 30), "yyyy-MM-dd");
      const { data: last30 } = await supabase
        .from("movimientos")
        .select("*")
        .eq("user_id", userId)
        .gte("fecha", thirtyAgo)
        .eq("tipo", "gasto");

      // Get envelopes
      const { data: sobres } = await supabase
        .from("sobres")
        .select("*")
        .eq("user_id", userId);

      // Get weeks of this month
      const { data: semanas } = await supabase
        .from("semanas")
        .select("*")
        .eq("user_id", userId)
        .gte("fecha_inicio", format(monthStart, "yyyy-MM-dd"))
        .lte("fecha_fin", format(monthEnd, "yyyy-MM-dd"));

      const expenses = (monthMov || []).filter(m => m.tipo === "gasto");
      const incomes = (monthMov || []).filter(m => m.tipo === "ingreso");
      const totalExpenses = expenses.reduce((s, m) => s + Number(m.monto), 0);
      const totalIncome = incomes.reduce((s, m) => s + Number(m.monto), 0);

      // KPI 1: Avg daily spending (last 30 days)
      const last30Total = (last30 || []).reduce((s, m) => s + Number(m.monto), 0);
      const daysWithData = Math.max(1, Math.min(30, differenceInDays(today, new Date(thirtyAgo + "T12:00:00")) || 1));
      const avgDaily = last30Total / daysWithData;

      // KPI 2: Top category
      const catMap: Record<string, number> = {};
      expenses.forEach(m => {
        const cat = m.categoria || "Sin categoría";
        catMap[cat] = (catMap[cat] || 0) + Number(m.monto);
      });
      const sortedCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
      const topCat = sortedCats[0] ? { name: sortedCats[0][0], amount: sortedCats[0][1], percentage: totalExpenses > 0 ? (sortedCats[0][1] / totalExpenses) * 100 : 0 } : null;

      // KPI 3: Highest spending week
      let highestWeek: { label: string; amount: number } | null = null;
      if (semanas && semanas.length > 0) {
        const sorted = [...semanas].sort((a, b) => Number(b.gastos_totales || 0) - Number(a.gastos_totales || 0));
        highestWeek = { label: `${format(new Date(sorted[0].fecha_inicio + "T12:00:00"), "dd/MM")} - ${format(new Date(sorted[0].fecha_fin + "T12:00:00"), "dd/MM")}`, amount: Number(sorted[0].gastos_totales || 0) };
      }

      // KPI 4: % income spent
      const pct = totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0;

      setKpis({ avgDailySpending: avgDaily, topCategory: topCat, highestSpendingWeek: highestWeek, incomeSpentPercentage: pct });

      // Top 5 categories
      const top5 = sortedCats.slice(0, 5).map(([name, amount]) => ({
        name, amount, percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
      }));
      setTopCategories(top5);

      // Alerts
      const newAlerts: Alert[] = [];
      if (sobres) {
        sobres.forEach(s => {
          const pctUsed = s.semanal_calculado > 0 ? (Number(s.gastado_semana || 0) / s.semanal_calculado) * 100 : 0;
          if (pctUsed >= 80 && pctUsed < 100) {
            newAlerts.push({ type: "warning", message: `${s.nombre} lleva ${pctUsed.toFixed(0)}% del presupuesto semanal`, icon: <AlertTriangle className="h-4 w-4" /> });
          }
          if (Number(s.gastado_semana || 0) > s.mensual) {
            newAlerts.push({ type: "danger", message: `${s.nombre} superó el presupuesto mensual`, icon: <AlertTriangle className="h-4 w-4" /> });
          }
        });
      }
      if (totalExpenses > totalIncome && totalIncome > 0) {
        newAlerts.push({ type: "danger", message: `Gastos ($${totalExpenses.toFixed(0)}) superan ingresos ($${totalIncome.toFixed(0)}) este mes`, icon: <TrendingDown className="h-4 w-4" /> });
      }
      setAlerts(newAlerts);

      // Projection
      const last7 = format(subDays(today, 7), "yyyy-MM-dd");
      const { data: recent7 } = await supabase
        .from("movimientos")
        .select("monto")
        .eq("user_id", userId)
        .eq("tipo", "gasto")
        .gte("fecha", last7);
      const avg7 = (recent7 || []).reduce((s, m) => s + Number(m.monto), 0) / 7;
      const daysLeft = differenceInDays(monthEnd, today);
      const projectedExpenses = totalExpenses + avg7 * daysLeft;
      const diff = totalIncome - projectedExpenses;
      setProjection({ projected: projectedExpenses, surplus: diff >= 0, amount: Math.abs(diff) });
    } catch (e) {
      console.error("Error loading financial intelligence:", e);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <BarChart3 className="h-8 w-8 text-primary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPIs Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-2xl border-0 shadow-sm bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Gasto diario promedio</span>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Wallet className="h-4 w-4 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-light tabular-nums">${kpis.avgDailySpending.toFixed(0)}</p>
            <p className="text-[11px] text-muted-foreground">Últimos 30 días</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Mayor categoría</span>
              <div className="h-8 w-8 rounded-full bg-[hsl(var(--apple-red))]/10 flex items-center justify-center">
                <Target className="h-4 w-4 text-[hsl(var(--apple-red))]" />
              </div>
            </div>
            <p className="text-lg font-semibold truncate">{kpis.topCategory?.name || "—"}</p>
            <p className="text-[11px] text-muted-foreground">{kpis.topCategory ? `${kpis.topCategory.percentage.toFixed(0)}% del total` : "Sin datos"}</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Semana más cara</span>
              <div className="h-8 w-8 rounded-full bg-[hsl(var(--apple-orange))]/10 flex items-center justify-center">
                <CalendarDays className="h-4 w-4 text-[hsl(var(--apple-orange))]" />
              </div>
            </div>
            <p className="text-2xl font-light tabular-nums">${kpis.highestSpendingWeek?.amount.toFixed(0) || "0"}</p>
            <p className="text-[11px] text-muted-foreground">{kpis.highestSpendingWeek?.label || "Sin datos"}</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 shadow-sm bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Ingreso gastado</span>
              <div className="h-8 w-8 rounded-full bg-[hsl(var(--apple-green))]/10 flex items-center justify-center">
                <PiggyBank className="h-4 w-4 text-[hsl(var(--apple-green))]" />
              </div>
            </div>
            <p className="text-2xl font-light tabular-nums">{kpis.incomeSpentPercentage.toFixed(0)}%</p>
            <p className="text-[11px] text-muted-foreground">Este mes</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="rounded-2xl border-0 shadow-sm bg-card">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[hsl(var(--apple-orange))]" />
              Alertas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-2">
              {alerts.map((alert, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${alert.type === "danger" ? "bg-[hsl(var(--apple-red))]/10" : "bg-[hsl(var(--apple-orange))]/10"}`}>
                  <span className={alert.type === "danger" ? "text-[hsl(var(--apple-red))]" : "text-[hsl(var(--apple-orange))]"}>
                    {alert.icon}
                  </span>
                  <span className="text-sm">{alert.message}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Projection */}
      {projection && (
        <Card className="rounded-2xl border-0 shadow-sm bg-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              {projection.surplus ? (
                <div className="h-10 w-10 rounded-full bg-[hsl(var(--apple-green))]/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-[hsl(var(--apple-green))]" />
                </div>
              ) : (
                <div className="h-10 w-10 rounded-full bg-[hsl(var(--apple-red))]/10 flex items-center justify-center">
                  <TrendingDown className="h-5 w-5 text-[hsl(var(--apple-red))]" />
                </div>
              )}
              <div>
                <p className="text-sm font-semibold">Proyección del mes</p>
                <p className="text-xs text-muted-foreground">Basado en tu gasto de los últimos 7 días</p>
              </div>
            </div>
            <p className={`text-xl font-light ${projection.surplus ? "text-[hsl(var(--apple-green))]" : "text-[hsl(var(--apple-red))]"}`}>
              A este ritmo, cerrarás el mes con ${projection.amount.toFixed(0)} de {projection.surplus ? "superávit" : "déficit"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Top 5 Categories */}
      {topCategories.length > 0 && (
        <Card className="rounded-2xl border-0 shadow-sm bg-card">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Top categorías del mes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-3">
              {topCategories.map((cat, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{cat.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-light tabular-nums">${cat.amount.toFixed(0)}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{cat.percentage.toFixed(0)}%</Badge>
                    </div>
                  </div>
                  <Progress value={cat.percentage} className="h-1.5" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export { FinancialIntelligence };

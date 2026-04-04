import { useState, useEffect, useCallback } from "react";
import { TransactionInput } from "@/components/TransactionInput";
import { TransactionList } from "@/components/TransactionList";
import { DailySummary } from "@/components/DailySummary";
import { EnvelopesList } from "@/components/EnvelopesList";
import { WeeklyDashboard } from "@/components/WeeklyDashboard";
import { TransactionFilters, FilterState } from "@/components/TransactionFilters";
import { WeekNavigator } from "@/components/WeekNavigator";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Auth } from "@/components/Auth";
import { UserManagement } from "@/components/UserManagement";
import { PermissionGuard } from "@/components/PermissionGuard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, LogOut, Users, CreditCard, Sparkles } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { es } from "date-fns/locale";
import { mapTransactionToEnvelope } from "@/utils/envelopeMapping";
import { useUserRole } from "@/hooks/useUserRole";
import { useWeeklyReset } from "@/hooks/useWeeklyReset";

interface Transaction {
  id: string;
  fecha: string;
  descripcion: string;
  monto: number;
  tipo: "ingreso" | "gasto";
  categoria: string | null;
  metodo_pago: "tarjeta" | "efectivo" | "otro";
  semana_id: string | null;
  fuente_texto: string | null;
}

const getCancunDate = (): Date => {
  const now = new Date();
  const cancunDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Cancun',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
  const [year, month, day] = cancunDateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
};

const Index = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [currentWeekDate, setCurrentWeekDate] = useState<Date>(getCancunDate());
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [filters, setFilters] = useState<FilterState>({
    weekId: null,
    categoria: null,
    metodoPago: null,
    searchTerm: "",
  });
  
  const { role, isAdmin, canEdit } = useUserRole(user?.id);
  useWeeklyReset(user?.id);

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      loadTransactions();
      const movimientosChannel = supabase
        .channel('movimientos-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'movimientos' }, () => {
          loadTransactions();
          triggerRefresh();
        })
        .subscribe();
      const semanasChannel = supabase
        .channel('semanas-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'semanas' }, () => { triggerRefresh(); })
        .subscribe();
      const sobresChannel = supabase
        .channel('sobres-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sobres' }, () => { triggerRefresh(); })
        .subscribe();
      return () => {
        supabase.removeChannel(movimientosChannel);
        supabase.removeChannel(semanasChannel);
        supabase.removeChannel(sobresChannel);
      };
    }
  }, [user, triggerRefresh]);

  const loadTransactions = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('movimientos')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(100);
    if (error) {
      console.error('Error loading transactions:', error);
      toast.error('Error al cargar movimientos');
      return;
    }
    setTransactions((data || []) as Transaction[]);
  };

  const applyFilters = useCallback(() => {
    let filtered = [...transactions];
    if (filters.weekId) filtered = filtered.filter((t) => t.semana_id === filters.weekId);
    if (filters.categoria) filtered = filtered.filter((t) => t.categoria === filters.categoria);
    if (filters.metodoPago) filtered = filtered.filter((t) => t.metodo_pago === filters.metodoPago);
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter((t) => t.descripcion.toLowerCase().includes(term));
    }
    setFilteredTransactions(filtered);
  }, [transactions, filters]);

  useEffect(() => { applyFilters(); }, [applyFilters]);

  const handleTransactionsParsed = async (parsedData: any) => {
    if (!user) { toast.error('Debes iniciar sesión'); return; }
    try {
      const { transactions: parsedTransactions, saldoInicial, cerramosCon } = parsedData;
      const today = getCancunDate();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

      let { data: semana, error: semanaError } = await supabase
        .from('semanas').select('*').eq('user_id', user.id)
        .eq('fecha_inicio', format(weekStart, 'yyyy-MM-dd')).single();

      if (semanaError && semanaError.code !== 'PGRST116') throw semanaError;

      const initialBalance = saldoInicial !== null ? saldoInicial : (semana?.saldo_inicial || 0);

      if (!semana) {
        const { data: newSemana, error: createError } = await supabase
          .from('semanas').insert({
            user_id: user.id, fecha_inicio: format(weekStart, 'yyyy-MM-dd'),
            fecha_fin: format(weekEnd, 'yyyy-MM-dd'), saldo_inicial: initialBalance,
            ingresos_totales: 0, gastos_totales: 0, saldo_final: 0,
          }).select().single();
        if (createError) throw createError;
        semana = newSemana;
      } else if (saldoInicial !== null && semana.saldo_inicial !== saldoInicial) {
        await supabase.from('semanas').update({ saldo_inicial: initialBalance }).eq('id', semana.id);
      }

      const { data: existingSobres } = await supabase.from('sobres').select('nombre').eq('user_id', user.id);
      const existingNames = new Set(existingSobres?.map(s => s.nombre.toUpperCase()) || []);
      const newCategories = new Set<string>();
      parsedTransactions.forEach((t: any) => {
        if (t.categoria && t.type !== 'income') {
          const catUpper = t.categoria.toUpperCase();
          if (!existingNames.has(catUpper) && catUpper !== 'INGRESOS') newCategories.add(catUpper);
        }
      });

      if (newCategories.size > 0) {
        const newSobres = Array.from(newCategories).map(nombre => ({
          user_id: user.id, nombre, mensual: 500,
          semanal_calculado: Math.round((500 / 4.345) * 100) / 100,
          gastado_semana: 0, restante_semana: Math.round((500 / 4.345) * 100) / 100,
        }));
        await supabase.from('sobres').insert(newSobres);
        toast.info(`${newCategories.size} sobre(s) nuevo(s) creado(s)`);
      }

      const movimientos = parsedTransactions.map((t: any) => ({
        user_id: user.id, fecha: t.date.split('T')[0], descripcion: t.description,
        monto: t.amount, tipo: t.type === 'income' ? 'ingreso' : 'gasto',
        categoria: t.categoria?.toUpperCase() || null, metodo_pago: t.paymentMethod,
        semana_id: semana?.id, fuente_texto: null,
      }));

      const { error: insertError } = await supabase.from('movimientos').insert(movimientos);
      if (insertError) throw insertError;

      await updateEnvelopeSpending(parsedTransactions, semana.id);
      await updateWeekTotals(semana.id, cerramosCon);
      await loadTransactions();
      triggerRefresh();
      toast.success(`${movimientos.length} movimiento(s) guardado(s)`);
    } catch (error) {
      console.error('Error saving transactions:', error);
      toast.error('Error al guardar movimientos');
    }
  };

  const updateEnvelopeSpending = async (parsedTransactions: any[], semanaId: string) => {
    if (!user) return;
    const { data: sobres } = await supabase.from('sobres').select('*').eq('user_id', user.id);
    if (!sobres || sobres.length === 0) return;

    const ahorroEnvelopes = sobres.filter(s => s.tipo === 'ahorro');
    const { data: gastos } = await supabase.from('movimientos').select('*').eq('semana_id', semanaId).eq('tipo', 'gasto');
    const { data: ingresos } = await supabase.from('movimientos').select('*').eq('semana_id', semanaId).eq('tipo', 'ingreso');

    const envelopeSpending: Record<string, number> = {};
    sobres.forEach(sobre => { envelopeSpending[sobre.nombre] = 0; });

    if (gastos) {
      gastos.forEach((mov: any) => {
        const envelopeName = mapTransactionToEnvelope(mov.descripcion, mov.categoria);
        if (envelopeName && envelopeSpending[envelopeName] !== undefined) {
          envelopeSpending[envelopeName] += Number(mov.monto);
        }
      });
    }

    const ahorroEnvelopeNames = new Set(ahorroEnvelopes.map(s => s.nombre.toUpperCase()));
    if (ingresos) {
      ingresos.forEach((mov: any) => {
        const categoria = mov.categoria?.toUpperCase();
        if (categoria && ahorroEnvelopeNames.has(categoria)) {
          const envelope = ahorroEnvelopes.find(s => s.nombre.toUpperCase() === categoria);
          if (envelope && envelopeSpending[envelope.nombre] !== undefined) {
            envelopeSpending[envelope.nombre] += Number(mov.monto);
          }
        }
      });
    }

    for (const sobre of sobres) {
      const gastadoOAhorrado = envelopeSpending[sobre.nombre] || 0;
      const restante = sobre.semanal_calculado - gastadoOAhorrado;
      await supabase.from('sobres').update({ gastado_semana: gastadoOAhorrado, restante_semana: restante }).eq('id', sobre.id);
    }
  };

  const updateWeekTotals = async (semanaId: string, cerramosCon?: number | null) => {
    const { data: semana } = await supabase.from('semanas').select('saldo_inicial').eq('id', semanaId).single();
    const { data: movimientos } = await supabase.from('movimientos').select('monto, tipo').eq('semana_id', semanaId);
    if (!movimientos) return;

    const ingresos = movimientos.filter(m => m.tipo === 'ingreso').reduce((sum, m) => sum + Number(m.monto), 0);
    const gastos = movimientos.filter(m => m.tipo === 'gasto').reduce((sum, m) => sum + Number(m.monto), 0);
    const saldoInicial = Number(semana?.saldo_inicial || 0);
    const saldoCalculado = saldoInicial + ingresos - gastos;

    await supabase.from('semanas').update({
      ingresos_totales: ingresos, gastos_totales: gastos, saldo_final: saldoCalculado,
    }).eq('id', semanaId);

    if (cerramosCon !== null && cerramosCon !== undefined) {
      const diferencia = Math.abs(saldoCalculado - cerramosCon);
      if (diferencia > 0.01) {
        toast.error(`⚠️ Inconsistencia: "Cerramos con: ${cerramosCon}" vs cálculo: ${saldoCalculado.toFixed(2)}. Dif: ${diferencia.toFixed(2)}`, { duration: 8000 });
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setTransactions([]);
    toast.success('Sesión cerrada');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Wallet className="h-10 w-10 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground text-sm font-light">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Auth />;

  const userInitial = (user.email || 'U')[0].toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto px-4 py-6">
        {/* Apple-style minimal header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            Gestor de Gastos
          </h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
              {userInitial}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Week Navigator */}
        <div className="mb-4">
          <WeekNavigator currentDate={currentWeekDate} onDateChange={setCurrentWeekDate} />
        </div>

        {/* Daily Summary */}
        <div className="mb-6">
          <DailySummary userId={user.id} selectedDate={currentWeekDate} refreshTrigger={refreshTrigger} />
        </div>

        {/* iOS Segmented Control Tabs */}
        <Tabs defaultValue="transactions" className="space-y-6">
          <TabsList className="ios-segmented-control grid w-full grid-cols-3 h-auto p-1">
            <TabsTrigger value="transactions" className="flex items-center gap-2 py-2.5">
              <Wallet className="h-4 w-4" />
              <span className="text-sm">Movimientos</span>
            </TabsTrigger>
            <TabsTrigger value="budget" className="flex items-center gap-2 py-2.5">
              <CreditCard className="h-4 w-4" />
              <span className="text-sm">Presupuesto</span>
            </TabsTrigger>
            <TabsTrigger value="family" className="flex items-center gap-2 py-2.5">
              <Users className="h-4 w-4" />
              <span className="text-sm">Familia</span>
              {role && (
                <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 h-4 border-muted-foreground/30">
                  {role === 'admin' ? 'Admin' : role === 'editor' ? 'Editor' : 'Visor'}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="space-y-5">
            <PermissionGuard requireEdit userId={user.id} showAlert={true}>
              <TransactionInput onTransactionsParsed={handleTransactionsParsed} />
            </PermissionGuard>
            <TransactionFilters userId={user.id} onFilterChange={setFilters} />
            <TransactionList
              transactions={filteredTransactions.map(t => ({
                id: t.id, date: t.fecha, amount: Number(t.monto),
                type: t.tipo === 'ingreso' ? 'income' as const : 'expense' as const,
                description: t.descripcion,
                paymentMethod: t.metodo_pago === 'tarjeta' ? 'card' as const : t.metodo_pago === 'efectivo' ? 'cash' as const : 'other' as const,
                categoria: t.categoria || undefined,
              }))}
              onUpdate={() => { loadTransactions(); triggerRefresh(); }}
              readOnly={!canEdit}
            />
          </TabsContent>

          <TabsContent value="budget" className="space-y-5">
            <WeeklyDashboard userId={user.id} key={refreshTrigger} />
            <EnvelopesList userId={user.id} canEdit={canEdit} key={`envelopes-${refreshTrigger}`} />
          </TabsContent>

          <TabsContent value="family" className="space-y-5">
            <Card className="rounded-2xl border-0 shadow-sm bg-card">
              <CardHeader className="p-5">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                  <Users className="h-5 w-5 text-primary" />
                  Usuarios Conectados
                </CardTitle>
                <CardDescription className="text-sm font-light">
                  Miembros de tu grupo familiar con acceso a la app
                </CardDescription>
              </CardHeader>
            </Card>
            <PermissionGuard requireAdmin userId={user.id} showAlert={true}>
              <UserManagement />
            </PermissionGuard>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;

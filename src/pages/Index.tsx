import { useState, useEffect, useCallback } from "react";
import { TransactionInput } from "@/components/TransactionInput";
import { TransactionList } from "@/components/TransactionList";
import { WeeklySummary } from "@/components/WeeklySummary";
import { EnvelopesList } from "@/components/EnvelopesList";
import { WeeklyDashboard } from "@/components/WeeklyDashboard";
import { AdvancedAnalytics } from "@/components/AdvancedAnalytics";
import { TransactionFilters, FilterState } from "@/components/TransactionFilters";
import { WeekNavigator } from "@/components/WeekNavigator";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Auth } from "@/components/Auth";
import { UserManagement } from "@/components/UserManagement";
import { ActiveUsers } from "@/components/ActiveUsers";
import { PermissionGuard } from "@/components/PermissionGuard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { es } from "date-fns/locale";
import { mapTransactionToEnvelope } from "@/utils/envelopeMapping";
import { useUserRole } from "@/hooks/useUserRole";

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

const Index = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [currentWeekDate, setCurrentWeekDate] = useState<Date>(new Date());
  const [filters, setFilters] = useState<FilterState>({
    weekId: null,
    categoria: null,
    metodoPago: null,
    searchTerm: "",
  });
  
  const { role, isAdmin, canEdit } = useUserRole(user?.id);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      loadTransactions();
      
      // Real-time subscriptions for all tables
      const movimientosChannel = supabase
        .channel('movimientos-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'movimientos'
          },
          () => {
            loadTransactions();
            toast.info('Datos actualizados en tiempo real');
          }
        )
        .subscribe();

      const semanasChannel = supabase
        .channel('semanas-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'semanas'
          },
          () => {
            toast.info('Semanas actualizadas');
          }
        )
        .subscribe();

      const sobresChannel = supabase
        .channel('sobres-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'sobres'
          },
          () => {
            toast.info('Sobres actualizados');
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(movimientosChannel);
        supabase.removeChannel(semanasChannel);
        supabase.removeChannel(sobresChannel);
      };
    }
  }, [user]);

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

    if (filters.weekId) {
      filtered = filtered.filter((t) => t.semana_id === filters.weekId);
    }

    if (filters.categoria) {
      filtered = filtered.filter((t) => t.categoria === filters.categoria);
    }

    if (filters.metodoPago) {
      filtered = filtered.filter((t) => t.metodo_pago === filters.metodoPago);
    }

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter((t) =>
        t.descripcion.toLowerCase().includes(term)
      );
    }

    setFilteredTransactions(filtered);
  }, [transactions, filters]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleTransactionsParsed = async (parsedData: any) => {
    if (!user) {
      toast.error('Debes iniciar sesión para guardar movimientos');
      return;
    }

    try {
      const { transactions: parsedTransactions, saldoInicial, cerramosCon } = parsedData;

      // Get or create current week
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

      let { data: semana, error: semanaError } = await supabase
        .from('semanas')
        .select('*')
        .eq('user_id', user.id)
        .eq('fecha_inicio', format(weekStart, 'yyyy-MM-dd'))
        .single();

      if (semanaError && semanaError.code !== 'PGRST116') {
        throw semanaError;
      }

      // Determine initial balance
      const initialBalance = saldoInicial !== null ? saldoInicial : (semana?.saldo_inicial || 0);

      if (!semana) {
        const { data: newSemana, error: createError } = await supabase
          .from('semanas')
          .insert({
            user_id: user.id,
            fecha_inicio: format(weekStart, 'yyyy-MM-dd'),
            fecha_fin: format(weekEnd, 'yyyy-MM-dd'),
            saldo_inicial: initialBalance,
            ingresos_totales: 0,
            gastos_totales: 0,
            saldo_final: 0,
          })
          .select()
          .single();

        if (createError) throw createError;
        semana = newSemana;
      } else if (saldoInicial !== null && semana.saldo_inicial !== saldoInicial) {
        // Update saldo_inicial if "Amanecimos con" was detected
        await supabase
          .from('semanas')
          .update({ saldo_inicial: initialBalance })
          .eq('id', semana.id);
      }

      // Insert transactions
      const movimientos = parsedTransactions.map((t: any) => ({
        user_id: user.id,
        fecha: t.date.split('T')[0],
        descripcion: t.description,
        monto: t.amount,
        tipo: t.type === 'income' ? 'ingreso' : 'gasto',
        categoria: t.categoria || null,
        metodo_pago: t.paymentMethod,
        semana_id: semana?.id,
        fuente_texto: null,
      }));

      const { error: insertError } = await supabase
        .from('movimientos')
        .insert(movimientos);

      if (insertError) throw insertError;

      // Update envelopes for expenses
      await updateEnvelopeSpending(parsedTransactions, semana.id);

      // Update week totals and check for inconsistencies
      await updateWeekTotals(semana.id, cerramosCon);
      
      toast.success(`${movimientos.length} movimiento(s) guardado(s)`);
    } catch (error) {
      console.error('Error saving transactions:', error);
      toast.error('Error al guardar movimientos');
    }
  };

  const updateEnvelopeSpending = async (parsedTransactions: any[], semanaId: string) => {
    if (!user) return;

    // Get all envelopes for the user
    const { data: sobres } = await supabase
      .from('sobres')
      .select('*')
      .eq('user_id', user.id);

    if (!sobres || sobres.length === 0) return;

    // Calculate spending per envelope this week
    const { data: movimientos } = await supabase
      .from('movimientos')
      .select('*')
      .eq('semana_id', semanaId)
      .eq('tipo', 'gasto');

    if (!movimientos) return;

    // Reset all envelopes for this week
    const envelopeSpending: Record<string, number> = {};
    sobres.forEach(sobre => {
      envelopeSpending[sobre.nombre] = 0;
    });

    // Calculate spending per envelope
    movimientos.forEach((mov: any) => {
      const envelopeName = mapTransactionToEnvelope(mov.descripcion, mov.categoria);
      if (envelopeName && envelopeSpending[envelopeName] !== undefined) {
        envelopeSpending[envelopeName] += Number(mov.monto);
      }
    });

    // Update each envelope
    for (const sobre of sobres) {
      const gastado = envelopeSpending[sobre.nombre] || 0;
      const restante = sobre.semanal_calculado - gastado;

      await supabase
        .from('sobres')
        .update({
          gastado_semana: gastado,
          restante_semana: restante,
        })
        .eq('id', sobre.id);
    }
  };

  const updateWeekTotals = async (semanaId: string, cerramosCon?: number | null) => {
    const { data: semana } = await supabase
      .from('semanas')
      .select('saldo_inicial')
      .eq('id', semanaId)
      .single();

    const { data: movimientos } = await supabase
      .from('movimientos')
      .select('monto, tipo')
      .eq('semana_id', semanaId);

    if (!movimientos) return;

    const ingresos = movimientos
      .filter(m => m.tipo === 'ingreso')
      .reduce((sum, m) => sum + Number(m.monto), 0);

    const gastos = movimientos
      .filter(m => m.tipo === 'gasto')
      .reduce((sum, m) => sum + Number(m.monto), 0);

    const saldoInicial = Number(semana?.saldo_inicial || 0);
    const saldoCalculado = saldoInicial + ingresos - gastos;

    await supabase
      .from('semanas')
      .update({
        ingresos_totales: ingresos,
        gastos_totales: gastos,
        saldo_final: saldoCalculado,
      })
      .eq('id', semanaId);

    // Check for inconsistency
    if (cerramosCon !== null && cerramosCon !== undefined) {
      const diferencia = Math.abs(saldoCalculado - cerramosCon);
      if (diferencia > 0.01) { // Allow for small rounding errors
        toast.error(
          `⚠️ Inconsistencia detectada: "Cerramos con: ${cerramosCon}" pero el cálculo da ${saldoCalculado.toFixed(2)}. Diferencia: ${diferencia.toFixed(2)}`,
          { duration: 8000 }
        );
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setTransactions([]);
    toast.success('Sesión cerrada');
  };

  const totalIncome = transactions
    .filter((t) => t.tipo === "ingreso")
    .reduce((sum, t) => sum + Number(t.monto), 0);

  const totalExpense = transactions
    .filter((t) => t.tipo === "gasto")
    .reduce((sum, t) => sum + Number(t.monto), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Wallet className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-2xl">
                <Wallet className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  Gestor de Gastos
                </h1>
                <p className="text-sm text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Salir
              </Button>
            </div>
          </div>
        </div>

        {/* Week Navigator */}
        <div className="mb-6">
          <WeekNavigator 
            currentDate={currentWeekDate} 
            onDateChange={setCurrentWeekDate}
          />
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="analytics">Análisis</TabsTrigger>
            <TabsTrigger value="transactions">Movimientos</TabsTrigger>
            <TabsTrigger value="users">
              Usuarios
              {role && (
                <Badge variant="outline" className="ml-2 text-xs">
                  {role === 'admin' ? 'Admin' : role === 'editor' ? 'Editor' : 'Visor'}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            {/* Weekly Dashboard */}
            <WeeklyDashboard userId={user.id} />

            {/* Envelopes */}
            <EnvelopesList userId={user.id} canEdit={canEdit} />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <AdvancedAnalytics userId={user.id} />
          </TabsContent>

          <TabsContent value="transactions" className="space-y-6">
            {/* Transaction Input */}
            <PermissionGuard requireEdit userId={user.id} showAlert={true}>
              <TransactionInput onTransactionsParsed={handleTransactionsParsed} />
            </PermissionGuard>

            {/* Filters */}
            <TransactionFilters userId={user.id} onFilterChange={setFilters} />

            {/* Transaction List */}
            <TransactionList
              transactions={filteredTransactions.map(t => ({
                id: t.id,
                date: t.fecha,
                amount: Number(t.monto),
                type: t.tipo === 'ingreso' ? 'income' as const : 'expense' as const,
                description: t.descripcion,
                paymentMethod: t.metodo_pago === 'tarjeta' ? 'card' as const : 
                              t.metodo_pago === 'efectivo' ? 'cash' as const : 
                              'other' as const,
                categoria: t.categoria || undefined,
              }))} 
              onUpdate={loadTransactions}
              readOnly={!canEdit}
            />
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            {/* Active Users - visible to all */}
            <ActiveUsers />

            {/* User Management - admin only */}
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

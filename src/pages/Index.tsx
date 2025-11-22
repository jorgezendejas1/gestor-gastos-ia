import { useState, useEffect } from "react";
import { TransactionInput } from "@/components/TransactionInput";
import { TransactionList } from "@/components/TransactionList";
import { WeeklySummary } from "@/components/WeeklySummary";
import { Auth } from "@/components/Auth";
import { Wallet, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { es } from "date-fns/locale";

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
      
      // Real-time subscription
      const channel = supabase
        .channel('movimientos-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'movimientos'
          },
          () => loadTransactions()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const loadTransactions = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('movimientos')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error loading transactions:', error);
      toast.error('Error al cargar movimientos');
      return;
    }

    setTransactions((data || []) as Transaction[]);
  };

  const handleTransactionsParsed = async (parsedTransactions: any[]) => {
    if (!user) {
      toast.error('Debes iniciar sesión para guardar movimientos');
      return;
    }

    try {
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

      if (!semana) {
        const { data: newSemana, error: createError } = await supabase
          .from('semanas')
          .insert({
            user_id: user.id,
            fecha_inicio: format(weekStart, 'yyyy-MM-dd'),
            fecha_fin: format(weekEnd, 'yyyy-MM-dd'),
            saldo_inicial: 0,
            ingresos_totales: 0,
            gastos_totales: 0,
            saldo_final: 0,
          })
          .select()
          .single();

        if (createError) throw createError;
        semana = newSemana;
      }

      // Insert transactions
      const movimientos = parsedTransactions.map(t => ({
        user_id: user.id,
        fecha: t.date.split('T')[0],
        descripcion: t.description,
        monto: t.amount,
        tipo: t.type === 'income' ? 'ingreso' : 'gasto',
        categoria: null,
        metodo_pago: t.paymentMethod,
        semana_id: semana?.id,
        fuente_texto: null,
      }));

      const { error: insertError } = await supabase
        .from('movimientos')
        .insert(movimientos);

      if (insertError) throw insertError;

      // Update week totals
      await updateWeekTotals(semana.id);
      
      toast.success(`${movimientos.length} movimiento(s) guardado(s)`);
    } catch (error) {
      console.error('Error saving transactions:', error);
      toast.error('Error al guardar movimientos');
    }
  };

  const updateWeekTotals = async (semanaId: string) => {
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

    await supabase
      .from('semanas')
      .update({
        ingresos_totales: ingresos,
        gastos_totales: gastos,
        saldo_final: ingresos - gastos,
      })
      .eq('id', semanaId);
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
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Salir
            </Button>
          </div>
        </div>

        {/* Weekly Summary */}
        <div className="mb-6">
          <WeeklySummary totalIncome={totalIncome} totalExpense={totalExpense} />
        </div>

        {/* Transaction Input */}
        <div className="mb-6">
          <TransactionInput onTransactionsParsed={handleTransactionsParsed} />
        </div>

        {/* Transaction List */}
        <TransactionList 
          transactions={transactions.map(t => ({
            id: t.id,
            date: t.fecha,
            amount: Number(t.monto),
            type: t.tipo === 'ingreso' ? 'income' as const : 'expense' as const,
            description: t.descripcion,
            paymentMethod: t.metodo_pago === 'tarjeta' ? 'card' as const : 
                          t.metodo_pago === 'efectivo' ? 'cash' as const : 
                          'other' as const,
          }))} 
        />
      </div>
    </div>
  );
};

export default Index;

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useMemo, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TransactionEditDialog } from "./TransactionEditDialog";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  paymentMethod: "card" | "cash" | "other";
  categoria?: string;
}

interface TransactionListProps {
  transactions: Transaction[];
  onUpdate?: () => void;
  readOnly?: boolean;
}

export const TransactionList = ({ transactions, onUpdate, readOnly = false }: TransactionListProps) => {
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [displayCount, setDisplayCount] = useState(20);
  const [envelopes, setEnvelopes] = useState<string[]>([]);

  useEffect(() => {
    loadEnvelopes();
  }, []);

  const loadEnvelopes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: sobres } = await supabase
      .from('sobres')
      .select('nombre')
      .eq('user_id', user.id)
      .order('nombre');

    if (sobres) {
      setEnvelopes(sobres.map(s => s.nombre));
    }
  };

  const displayedTransactions = useMemo(() => {
    return transactions.slice(0, displayCount);
  }, [transactions, displayCount]);

  const hasMore = transactions.length > displayCount;

  const handleDelete = async (id: string) => {
    // Get transaction details before deleting
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('movimientos')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error("Error al eliminar la transacción");
      return;
    }

    // Update envelope spending if it was an expense with a category
    if (transaction.type === "expense" && transaction.categoria) {
      const { data: sobre } = await supabase
        .from('sobres')
        .select('*')
        .eq('user_id', user.id)
        .eq('nombre', transaction.categoria)
        .maybeSingle();

      if (sobre) {
        const newGastado = Math.max(0, Number(sobre.gastado_semana) - transaction.amount);
        await supabase
          .from('sobres')
          .update({ 
            gastado_semana: newGastado,
            restante_semana: Number(sobre.semanal_calculado) - newGastado
          })
          .eq('id', sobre.id);
      }
    }

    toast.success("Transacción eliminada");
    onUpdate?.();
  };

  const handleStartEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
  };

  const handleCloseEdit = () => {
    setEditingTransaction(null);
  };

  const handleSaveEdit = () => {
    loadEnvelopes(); // Reload envelopes in case a new one was created
    onUpdate?.();
  };

  if (transactions.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            No hay transacciones registradas
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Movimientos</span>
          <Badge variant="secondary">{transactions.length} total</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-3">
            {displayedTransactions.map((transaction) => (
              <Card key={transaction.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(transaction.date), "dd/MM/yyyy", { locale: es })}
                      </span>
                      <span className="text-sm px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                        {transaction.paymentMethod === "card" ? "Tarjeta" : transaction.paymentMethod === "cash" ? "Efectivo" : "Otro"}
                      </span>
                    </div>
                    
                    <p className="font-medium">{transaction.description}</p>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {transaction.categoria || "Sin categoría"}
                      </span>
                      {!readOnly && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => handleStartEdit(transaction)}
                          className="h-6 px-2"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right space-y-2">
                    <p className={`text-lg font-semibold ${
                      transaction.type === "income" ? "text-green-600" : "text-red-600"
                    }`}>
                      {transaction.type === "income" ? "+" : "-"}${Math.abs(transaction.amount).toFixed(2)}
                    </p>
                    
                    {!readOnly && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(transaction.id)}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
        
        {hasMore && (
          <div className="mt-4 text-center">
            <Button 
              variant="outline" 
              onClick={() => setDisplayCount(prev => prev + 20)}
              className="w-full"
            >
              Cargar más ({transactions.length - displayCount} restantes)
            </Button>
          </div>
        )}
      </CardContent>

      <TransactionEditDialog
        transaction={editingTransaction}
        open={!!editingTransaction}
        onClose={handleCloseEdit}
        onSave={handleSaveEdit}
        envelopes={envelopes}
      />
    </Card>
  );
};

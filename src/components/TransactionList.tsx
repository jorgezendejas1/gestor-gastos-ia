import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TransactionEditDialog } from "./TransactionEditDialog";

interface Transaction {
  id: string; date: string; description: string; amount: number;
  type: "income" | "expense"; paymentMethod: "card" | "cash" | "other"; categoria?: string;
}

interface TransactionListProps {
  transactions: Transaction[]; onUpdate?: () => void; readOnly?: boolean;
}

export const TransactionList = ({ transactions, onUpdate, readOnly = false }: TransactionListProps) => {
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [displayCount, setDisplayCount] = useState(20);
  const [envelopes, setEnvelopes] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadEnvelopes(); }, []);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && transactions.length > displayCount) {
        setDisplayCount(prev => Math.min(prev + 20, transactions.length));
      }
    }, { threshold: 0.1 });
    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
    return () => { if (observerRef.current) observerRef.current.disconnect(); };
  }, [transactions.length, displayCount]);

  const loadEnvelopes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: sobres } = await supabase.from('sobres').select('nombre').eq('user_id', user.id).order('nombre');
    if (sobres) setEnvelopes(sobres.map(s => s.nombre));
  };

  const displayedTransactions = useMemo(() => transactions.slice(0, displayCount), [transactions, displayCount]);

  const handleDelete = async (id: string) => {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('movimientos').delete().eq('id', id);
    if (error) { toast.error("Error al eliminar"); return; }
    if (transaction.type === "expense" && transaction.categoria) {
      const { data: sobre } = await supabase.from('sobres').select('*')
        .eq('user_id', user.id).eq('nombre', transaction.categoria).maybeSingle();
      if (sobre) {
        const newGastado = Math.max(0, Number(sobre.gastado_semana) - transaction.amount);
        await supabase.from('sobres').update({ gastado_semana: newGastado, restante_semana: Number(sobre.semanal_calculado) - newGastado }).eq('id', sobre.id);
      }
    }
    toast.success("Eliminado"); onUpdate?.();
  };

  if (transactions.length === 0) {
    return (
      <Card className="rounded-2xl border-0 shadow-sm p-8">
        <p className="text-center text-muted-foreground font-light">No hay transacciones registradas</p>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl border-0 shadow-sm overflow-hidden">
      <div className="p-5 pb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Movimientos</h3>
        <Badge variant="secondary" className="rounded-md text-xs font-medium">{transactions.length}</Badge>
      </div>
      <ScrollArea className="h-[600px]" ref={scrollRef}>
        <div className="divide-y divide-border">
          {displayedTransactions.map((transaction) => (
            <div key={transaction.id} className="px-5 py-3.5 flex items-start justify-between gap-4 hover:bg-secondary/30 transition-colors">
              <div className="flex-1 space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-light">
                    {format(new Date(transaction.date + 'T12:00:00'), "dd MMM", { locale: es })}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground font-light">
                    {transaction.paymentMethod === "card" ? "Tarjeta" : transaction.paymentMethod === "cash" ? "Efectivo" : "Otro"}
                  </span>
                </div>
                <p className="text-sm font-medium truncate">{transaction.description}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-light">
                    {transaction.categoria || "Sin categoría"}
                  </span>
                  {!readOnly && (
                    <Button size="sm" variant="ghost" onClick={() => setEditingTransaction(transaction)} className="h-5 px-1.5 rounded-md">
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="text-right space-y-1.5 shrink-0">
                <p className={`text-sm font-semibold tabular-nums ${transaction.type === "income" ? "text-success" : "text-destructive"}`}>
                  {transaction.type === "income" ? "+" : "-"}${Math.abs(transaction.amount).toFixed(2)}
                </p>
                {!readOnly && (
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(transaction.id)} className="h-7 w-7 p-0 rounded-md">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {displayCount < transactions.length && (
            <div ref={loadMoreRef} className="py-4 text-center">
              <span className="text-xs text-muted-foreground font-light">
                Cargando más... ({transactions.length - displayCount} restantes)
              </span>
            </div>
          )}
        </div>
      </ScrollArea>

      <TransactionEditDialog
        transaction={editingTransaction} open={!!editingTransaction}
        onClose={() => setEditingTransaction(null)} onSave={() => { loadEnvelopes(); onUpdate?.(); }}
        envelopes={envelopes}
      />
    </Card>
  );
};

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit2, Check, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

const CATEGORIES = [
  "Alimentación & Hogar",
  "Transporte",
  "Salud",
  "Entretenimiento",
  "Servicios",
  "Educación",
  "Ropa & Accesorios",
  "Ingresos",
  "Otros"
];

export const TransactionList = ({ transactions, onUpdate, readOnly = false }: TransactionListProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategoria, setEditCategoria] = useState("");
  const [displayCount, setDisplayCount] = useState(20);

  const displayedTransactions = useMemo(() => {
    return transactions.slice(0, displayCount);
  }, [transactions, displayCount]);

  const hasMore = transactions.length > displayCount;

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('movimientos')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error("Error al eliminar la transacción");
      return;
    }

    toast.success("Transacción eliminada");
    onUpdate?.();
  };

  const handleStartEdit = (transaction: Transaction) => {
    setEditingId(transaction.id);
    setEditCategoria(transaction.categoria || "");
  };

  const handleSaveEdit = async (id: string, originalCategoria: string | undefined, description: string) => {
    const { error } = await supabase
      .from('movimientos')
      .update({ categoria: editCategoria })
      .eq('id', id);

    if (error) {
      toast.error("Error al actualizar la categoría");
      return;
    }

    // Learn from the correction if category changed
    if (editCategoria !== originalCategoria) {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { error: learningError } = await supabase
          .from('categoria_mappings')
          .insert({
            user_id: user.id,
            descripcion_pattern: description.toLowerCase(),
            categoria: editCategoria
          });

        if (!learningError) {
          toast.success("Categoría actualizada y aprendida");
        } else {
          toast.success("Categoría actualizada");
        }
      } else {
        toast.success("Categoría actualizada");
      }
    } else {
      toast.success("Categoría actualizada");
    }

    setEditingId(null);
    onUpdate?.();
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditCategoria("");
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
                    
                    {editingId === transaction.id ? (
                      <div className="flex items-center gap-2 mt-2">
                        <Select value={editCategoria} onValueChange={setEditCategoria}>
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Seleccionar categoría" />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="ghost" onClick={() => handleSaveEdit(transaction.id, transaction.categoria, transaction.description)}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
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
                    )}
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
    </Card>
  );
};

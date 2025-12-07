import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, Calendar, CreditCard, Tag, Edit2, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  paymentMethod: "card" | "cash" | "other";
  categoria?: string;
}

interface EnvelopeInfo {
  nombre: string;
  gastado_semana: number;
  semanal_calculado: number;
  mensual: number;
  tipo: string;
}

interface TransactionReviewModalProps {
  open: boolean;
  transactions: ParsedTransaction[];
  saldoInicial: number | null;
  cerramosCon: number | null;
  onConfirm: () => void;
  onCancel: () => void;
  onTransactionsChange?: (transactions: ParsedTransaction[]) => void;
}

const INCOME_CATEGORIES = [
  "SUELDO",
  "BONOS", 
  "VENTAS",
  "REEMBOLSOS",
  "INTERESES",
  "REGALOS",
  "OTROS INGRESOS"
];

export const TransactionReviewModal = ({
  open,
  transactions,
  saldoInicial,
  cerramosCon,
  onConfirm,
  onCancel,
  onTransactionsChange,
}: TransactionReviewModalProps) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [envelopes, setEnvelopes] = useState<EnvelopeInfo[]>([]);
  const [localTransactions, setLocalTransactions] = useState<ParsedTransaction[]>(transactions);

  useEffect(() => {
    setLocalTransactions(transactions);
    loadEnvelopes();
  }, [transactions]);

  const loadEnvelopes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: sobres } = await supabase
      .from('sobres')
      .select('nombre, gastado_semana, semanal_calculado, mensual, tipo')
      .eq('user_id', user.id)
      .order('nombre');

    if (sobres) {
      setEnvelopes(sobres as EnvelopeInfo[]);
    }
  };

  const getEnvelopeInfo = (categoria: string | undefined): EnvelopeInfo | null => {
    if (!categoria) return null;
    return envelopes.find(e => e.nombre === categoria) || null;
  };

  const updateTransaction = (index: number, updates: Partial<ParsedTransaction>) => {
    const newTransactions = [...localTransactions];
    newTransactions[index] = { ...newTransactions[index], ...updates };
    setLocalTransactions(newTransactions);
    onTransactionsChange?.(newTransactions);
  };

  const handleConfirm = () => {
    onTransactionsChange?.(localTransactions);
    onConfirm();
  };

  const totalIngresos = localTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalGastos = localTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const paymentMethodLabels: Record<string, string> = {
    card: "Tarjeta",
    cash: "Efectivo",
    other: "Otro",
    tarjeta: "Tarjeta",
    efectivo: "Efectivo",
    otro: "Otro",
  };

  // Helper to safely format date
  const formatDate = (dateStr: string) => {
    try {
      // Handle YYYY-MM-DD format
      const [year, month, day] = dateStr.split('-').map(Number);
      if (year && month && day) {
        return new Date(year, month - 1, day).toLocaleDateString("es-MX");
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const getCategoriesForType = (type: "income" | "expense") => {
    if (type === "income") {
      // Para ingresos: categorías de ingreso + sobres de ahorro
      const ahorroEnvelopes = envelopes.filter(e => e.tipo === 'ahorro').map(e => e.nombre);
      return [...INCOME_CATEGORIES, ...ahorroEnvelopes];
    }
    // Para gastos: solo sobres de gasto
    return envelopes.filter(e => e.tipo === 'gasto').map(e => e.nombre);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Revisar movimientos detectados</DialogTitle>
          <DialogDescription>
            Se encontraron {localTransactions.length} movimiento(s). Revisa los
            detalles antes de guardar. Haz clic en el lápiz para editar.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh] pr-4">
          <div className="space-y-4">
            {saldoInicial !== null && (
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm font-medium">
                  💰 Saldo inicial detectado:{" "}
                  <span className="text-primary font-bold">
                    ${saldoInicial.toFixed(2)}
                  </span>
                </p>
              </div>
            )}

            {cerramosCon !== null && (
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm font-medium">
                  🔒 Saldo final declarado:{" "}
                  <span className="text-primary font-bold">
                    ${cerramosCon.toFixed(2)}
                  </span>
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-500/10 p-3 rounded-lg border border-green-500/20">
                <p className="text-xs text-muted-foreground mb-1">
                  Total Ingresos
                </p>
                <p className="text-lg font-bold text-green-600">
                  ${totalIngresos.toFixed(2)}
                </p>
              </div>
              <div className="bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                <p className="text-xs text-muted-foreground mb-1">
                  Total Gastos
                </p>
                <p className="text-lg font-bold text-red-600">
                  ${totalGastos.toFixed(2)}
                </p>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              {localTransactions.map((transaction, idx) => {
                const envelopeInfo = getEnvelopeInfo(transaction.categoria);
                const isEditing = editingIndex === idx;

                return (
                  <div
                    key={idx}
                    className="border border-border rounded-lg p-3 hover:bg-muted/30 transition-colors"
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Fecha</Label>
                            <Input
                              type="date"
                              value={transaction.date}
                              onChange={(e) => updateTransaction(idx, { date: e.target.value })}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Monto</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={transaction.amount}
                              onChange={(e) => updateTransaction(idx, { amount: parseFloat(e.target.value) || 0 })}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Descripción</Label>
                          <Input
                            value={transaction.description}
                            onChange={(e) => updateTransaction(idx, { description: e.target.value })}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs">Tipo</Label>
                            <Select 
                              value={transaction.type} 
                              onValueChange={(v) => updateTransaction(idx, { 
                                type: v as "income" | "expense",
                                categoria: v === "income" ? "OTROS INGRESOS" : "OTRAS"
                              })}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="expense">Gasto</SelectItem>
                                <SelectItem value="income">Ingreso</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Método</Label>
                            <Select 
                              value={transaction.paymentMethod} 
                              onValueChange={(v) => updateTransaction(idx, { paymentMethod: v as "card" | "cash" | "other" })}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="card">Tarjeta</SelectItem>
                                <SelectItem value="cash">Efectivo</SelectItem>
                                <SelectItem value="other">Otro</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Categoría</Label>
                            <Select 
                              value={transaction.categoria || ""} 
                              onValueChange={(v) => updateTransaction(idx, { categoria: v })}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Seleccionar" />
                              </SelectTrigger>
                              <SelectContent>
                                {getCategoriesForType(transaction.type).map((cat) => (
                                  <SelectItem key={cat} value={cat}>
                                    {cat}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          onClick={() => setEditingIndex(null)}
                          className="w-full"
                        >
                          Listo
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            {transaction.type === "income" ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                            <span className="font-medium text-sm">
                              {transaction.description}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingIndex(idx)}
                              className="h-6 w-6 p-0 ml-1"
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </div>

                          <div className="flex flex-wrap gap-2 text-xs">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {formatDate(transaction.date)}
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <CreditCard className="h-3 w-3" />
                              {paymentMethodLabels[transaction.paymentMethod]}
                            </div>
                            {transaction.categoria && (
                              <div className="flex items-center gap-1">
                                <Tag className="h-3 w-3 text-primary" />
                                <Badge variant="secondary" className="text-xs">
                                  {transaction.categoria}
                                </Badge>
                              </div>
                            )}
                          </div>

                          {/* Información del sobre para gastos y ahorros */}
                          {envelopeInfo && (
                            <div className={`flex items-center gap-3 text-xs p-2 rounded mt-1 ${
                              envelopeInfo.tipo === 'ahorro' ? 'bg-green-500/10' : 'bg-muted/50'
                            }`}>
                              <Wallet className={`h-3 w-3 ${envelopeInfo.tipo === 'ahorro' ? 'text-green-600' : 'text-primary'}`} />
                              <span>
                                <span className="text-muted-foreground">
                                  {envelopeInfo.tipo === 'ahorro' ? 'Ahorrado:' : 'Gastado:'}
                                </span>{" "}
                                <span className="font-medium">${envelopeInfo.gastado_semana.toFixed(2)}</span>
                              </span>
                              <span>
                                <span className="text-muted-foreground">Semanal:</span>{" "}
                                <span className="font-medium">${envelopeInfo.semanal_calculado.toFixed(2)}</span>
                              </span>
                              <span>
                                <span className="text-muted-foreground">Mensual:</span>{" "}
                                <span className="font-medium">${envelopeInfo.mensual.toFixed(2)}</span>
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="text-right">
                          <p
                            className={`text-lg font-bold ${
                              transaction.type === "income"
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {transaction.type === "income" ? "+" : "-"}$
                            {transaction.amount.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>
            Confirmar y Guardar ({localTransactions.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

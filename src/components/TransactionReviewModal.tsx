import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, Calendar, CreditCard, Tag, Edit2, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ParsedTransaction {
  date: string; description: string; amount: number;
  type: "income" | "expense"; paymentMethod: "card" | "cash" | "other"; categoria?: string;
}

interface EnvelopeInfo {
  nombre: string; gastado_semana: number; semanal_calculado: number; mensual: number; tipo: string;
}

interface TransactionReviewModalProps {
  open: boolean; transactions: ParsedTransaction[];
  saldoInicial: number | null; cerramosCon: number | null;
  onConfirm: () => void; onCancel: () => void;
  onTransactionsChange?: (transactions: ParsedTransaction[]) => void;
}

const INCOME_CATEGORIES = ["SUELDO", "BONOS", "VENTAS", "REEMBOLSOS", "INTERESES", "REGALOS", "OTROS INGRESOS"];

export const TransactionReviewModal = ({
  open, transactions, saldoInicial, cerramosCon, onConfirm, onCancel, onTransactionsChange,
}: TransactionReviewModalProps) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [envelopes, setEnvelopes] = useState<EnvelopeInfo[]>([]);
  const [localTransactions, setLocalTransactions] = useState<ParsedTransaction[]>(transactions);

  useEffect(() => { setLocalTransactions(transactions); loadEnvelopes(); }, [transactions]);

  const loadEnvelopes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: sobres } = await supabase.from('sobres')
      .select('nombre, gastado_semana, semanal_calculado, mensual, tipo')
      .eq('user_id', user.id).order('nombre');
    if (sobres) setEnvelopes(sobres as EnvelopeInfo[]);
  };

  const getEnvelopeInfo = (cat: string | undefined): EnvelopeInfo | null => {
    if (!cat) return null;
    return envelopes.find(e => e.nombre === cat) || null;
  };

  const updateTransaction = (index: number, updates: Partial<ParsedTransaction>) => {
    const newTransactions = [...localTransactions];
    newTransactions[index] = { ...newTransactions[index], ...updates };
    setLocalTransactions(newTransactions);
    onTransactionsChange?.(newTransactions);
  };

  const handleConfirm = () => { onTransactionsChange?.(localTransactions); onConfirm(); };

  const totalIngresos = localTransactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalGastos = localTransactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  const paymentMethodLabels: Record<string, string> = {
    card: "Tarjeta", cash: "Efectivo", other: "Otro",
    tarjeta: "Tarjeta", efectivo: "Efectivo", otro: "Otro",
  };

  const formatDate = (dateStr: string) => {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      if (year && month && day) return new Date(year, month - 1, day).toLocaleDateString("es-MX");
      return dateStr;
    } catch { return dateStr; }
  };

  const getCategoriesForType = (type: "income" | "expense") => {
    if (type === "income") {
      return [...INCOME_CATEGORIES, ...envelopes.filter(e => e.tipo === 'ahorro').map(e => e.nombre)];
    }
    return envelopes.filter(e => e.tipo === 'gasto').map(e => e.nombre);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-2xl max-h-[85vh] rounded-2xl p-0 overflow-hidden">
        {/* iOS-style handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-muted-foreground/20 rounded-full" />
        </div>

        <DialogHeader className="px-6 pb-3">
          <DialogTitle className="text-lg font-semibold">Revisar movimientos</DialogTitle>
          <DialogDescription className="font-light text-sm">
            {localTransactions.length} movimiento(s) detectados. Revisa antes de guardar.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh] px-6">
          <div className="space-y-4 pb-4">
            {saldoInicial != null && (
              <div className="bg-primary/5 p-3 rounded-xl">
                <p className="text-sm font-medium">
                  💰 Saldo inicial: <span className="text-primary font-semibold">${saldoInicial.toFixed(2)}</span>
                </p>
              </div>
            )}

            {cerramosCon != null && (
              <div className="bg-primary/5 p-3 rounded-xl">
                <p className="text-sm font-medium">
                  🔒 Saldo final: <span className="text-primary font-semibold">${cerramosCon.toFixed(2)}</span>
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-success/5 p-3 rounded-xl">
                <p className="text-xs text-muted-foreground mb-1 font-light">Total Ingresos</p>
                <p className="text-lg font-semibold text-success">${totalIngresos.toFixed(2)}</p>
              </div>
              <div className="bg-destructive/5 p-3 rounded-xl">
                <p className="text-xs text-muted-foreground mb-1 font-light">Total Gastos</p>
                <p className="text-lg font-semibold text-destructive">${totalGastos.toFixed(2)}</p>
              </div>
            </div>

            {/* Transactions with thin separators */}
            <div className="divide-y divide-border">
              {localTransactions.map((transaction, idx) => {
                const envelopeInfo = getEnvelopeInfo(transaction.categoria);
                const isEditing = editingIndex === idx;

                return (
                  <div key={idx} className="py-3">
                    {isEditing ? (
                      <div className="space-y-3 bg-secondary/30 rounded-xl p-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs font-medium">Fecha</Label>
                            <Input type="date" value={transaction.date} onChange={(e) => updateTransaction(idx, { date: e.target.value })} className="h-9 text-sm rounded-lg" />
                          </div>
                          <div>
                            <Label className="text-xs font-medium">Monto</Label>
                            <Input type="number" step="0.01" value={transaction.amount} onChange={(e) => updateTransaction(idx, { amount: parseFloat(e.target.value) || 0 })} className="h-9 text-sm rounded-lg" />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs font-medium">Descripción</Label>
                          <Input value={transaction.description} onChange={(e) => updateTransaction(idx, { description: e.target.value })} className="h-9 text-sm rounded-lg" />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs font-medium">Tipo</Label>
                            <Select value={transaction.type} onValueChange={(v) => updateTransaction(idx, { type: v as "income" | "expense", categoria: v === "income" ? "OTROS INGRESOS" : "OTRAS" })}>
                              <SelectTrigger className="h-9 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="expense">Gasto</SelectItem>
                                <SelectItem value="income">Ingreso</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs font-medium">Método</Label>
                            <Select value={transaction.paymentMethod} onValueChange={(v) => updateTransaction(idx, { paymentMethod: v as "card" | "cash" | "other" })}>
                              <SelectTrigger className="h-9 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="card">Tarjeta</SelectItem>
                                <SelectItem value="cash">Efectivo</SelectItem>
                                <SelectItem value="other">Otro</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs font-medium">Categoría</Label>
                            <Select value={transaction.categoria || ""} onValueChange={(v) => updateTransaction(idx, { categoria: v })}>
                              <SelectTrigger className="h-9 text-xs rounded-lg"><SelectValue placeholder="..." /></SelectTrigger>
                              <SelectContent>
                                {getCategoriesForType(transaction.type).map((cat) => (
                                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button size="sm" onClick={() => setEditingIndex(null)} className="w-full rounded-lg">Listo</Button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            {transaction.type === "income"
                              ? <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                              : <XCircle className="h-4 w-4 text-destructive shrink-0" />
                            }
                            <span className="font-medium text-sm">{transaction.description}</span>
                            <Button size="sm" variant="ghost" onClick={() => setEditingIndex(idx)} className="h-6 w-6 p-0 rounded-md">
                              <Edit2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="flex items-center gap-1 text-muted-foreground font-light">
                              <Calendar className="h-3 w-3" />{formatDate(transaction.date)}
                            </span>
                            <span className="flex items-center gap-1 text-muted-foreground font-light">
                              <CreditCard className="h-3 w-3" />{paymentMethodLabels[transaction.paymentMethod]}
                            </span>
                            {transaction.categoria && (
                              <span className="flex items-center gap-1">
                                <Tag className="h-3 w-3 text-primary" />
                                <Badge variant="secondary" className="text-[10px] rounded-md px-1.5 py-0 h-4">{transaction.categoria}</Badge>
                              </span>
                            )}
                          </div>
                          {envelopeInfo && (
                            <div className={`flex items-center gap-3 text-xs p-2 rounded-lg ${envelopeInfo.tipo === 'ahorro' ? 'bg-success/5' : 'bg-secondary/50'}`}>
                              <Wallet className={`h-3 w-3 ${envelopeInfo.tipo === 'ahorro' ? 'text-success' : 'text-primary'}`} />
                              <span><span className="text-muted-foreground font-light">{envelopeInfo.tipo === 'ahorro' ? 'Ahorrado:' : 'Gastado:'}</span> <span className="font-medium">${envelopeInfo.gastado_semana.toFixed(2)}</span></span>
                              <span><span className="text-muted-foreground font-light">Semanal:</span> <span className="font-medium">${envelopeInfo.semanal_calculado.toFixed(2)}</span></span>
                              <span><span className="text-muted-foreground font-light">Mensual:</span> <span className="font-medium">${envelopeInfo.mensual.toFixed(2)}</span></span>
                            </div>
                          )}
                        </div>
                        <p className={`text-base font-semibold tabular-nums ${transaction.type === "income" ? "text-success" : "text-destructive"}`}>
                          {transaction.type === "income" ? "+" : "-"}${transaction.amount.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button variant="ghost" onClick={onCancel} className="rounded-xl">Cancelar</Button>
          <Button onClick={handleConfirm} className="rounded-xl">
            Confirmar ({localTransactions.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

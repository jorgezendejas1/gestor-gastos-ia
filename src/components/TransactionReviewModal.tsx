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
import { CheckCircle2, XCircle, Calendar, CreditCard, Tag } from "lucide-react";

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  paymentMethod: "card" | "cash" | "other";
  categoria?: string;
}

interface TransactionReviewModalProps {
  open: boolean;
  transactions: ParsedTransaction[];
  saldoInicial: number | null;
  cerramosCon: number | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const TransactionReviewModal = ({
  open,
  transactions,
  saldoInicial,
  cerramosCon,
  onConfirm,
  onCancel,
}: TransactionReviewModalProps) => {
  const totalIngresos = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalGastos = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const paymentMethodLabels = {
    card: "Tarjeta",
    cash: "Efectivo",
    other: "Otro",
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Revisar movimientos detectados</DialogTitle>
          <DialogDescription>
            Se encontraron {transactions.length} movimiento(s). Revisa los
            detalles antes de guardar.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-4">
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
              {transactions.map((transaction, idx) => (
                <div
                  key={idx}
                  className="border border-border rounded-lg p-3 hover:bg-muted/30 transition-colors"
                >
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
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(transaction.date).toLocaleDateString(
                            "es-MX"
                          )}
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
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={onConfirm}>
            Confirmar y Guardar ({transactions.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Wallet, TrendingUp, TrendingDown, Calendar } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: "income" | "expense";
  description: string;
  paymentMethod: "card" | "cash" | "other";
}

interface TransactionListProps {
  transactions: Transaction[];
}

export const TransactionList = ({ transactions }: TransactionListProps) => {
  const getPaymentIcon = (method: string) => {
    switch (method) {
      case "card":
        return <CreditCard className="h-4 w-4" />;
      case "cash":
        return <Wallet className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  const getPaymentLabel = (method: string) => {
    switch (method) {
      case "card":
        return "Tarjeta";
      case "cash":
        return "Efectivo";
      default:
        return "Otro";
    }
  };

  if (transactions.length === 0) {
    return (
      <Card className="p-8 shadow-md">
        <div className="text-center text-muted-foreground">
          <p className="text-lg">No hay transacciones registradas</p>
          <p className="text-sm mt-2">Comienza agregando tus primeros movimientos arriba</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 shadow-md">
      <h2 className="text-xl font-semibold text-foreground mb-4">
        Movimientos recientes
      </h2>
      
      <div className="space-y-3">
        {transactions.map((transaction) => (
          <div
            key={transaction.id}
            className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
          >
            <div className="flex items-center gap-4 flex-1">
              <div className={`p-2 rounded-full ${
                transaction.type === "income" 
                  ? "bg-income-light text-income" 
                  : "bg-expense-light text-expense"
              }`}>
                {transaction.type === "income" ? (
                  <TrendingUp className="h-5 w-5" />
                ) : (
                  <TrendingDown className="h-5 w-5" />
                )}
              </div>
              
              <div className="flex-1">
                <p className="font-medium text-foreground">
                  {transaction.description}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(transaction.date), "d MMM", { locale: es })}
                  </p>
                  <Badge variant="outline" className="text-xs">
                    {getPaymentIcon(transaction.paymentMethod)}
                    <span className="ml-1">{getPaymentLabel(transaction.paymentMethod)}</span>
                  </Badge>
                </div>
              </div>
            </div>
            
            <div className={`text-lg font-semibold tabular-nums ${
              transaction.type === "income" ? "text-income" : "text-expense"
            }`}>
              {transaction.type === "income" ? "+" : "-"}
              ${Math.abs(transaction.amount).toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

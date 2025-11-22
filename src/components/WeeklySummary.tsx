import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";

interface WeeklySummaryProps {
  totalIncome: number;
  totalExpense: number;
}

export const WeeklySummary = ({ totalIncome, totalExpense }: WeeklySummaryProps) => {
  const balance = totalIncome - totalExpense;
  const isPositive = balance >= 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="p-6 shadow-md bg-gradient-to-br from-income-light to-income-light/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Ingresos</p>
            <p className="text-2xl font-bold text-income tabular-nums">
              ${totalIncome.toFixed(2)}
            </p>
          </div>
          <div className="p-3 bg-income/10 rounded-full">
            <TrendingUp className="h-6 w-6 text-income" />
          </div>
        </div>
      </Card>

      <Card className="p-6 shadow-md bg-gradient-to-br from-expense-light to-expense-light/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Gastos</p>
            <p className="text-2xl font-bold text-expense tabular-nums">
              ${totalExpense.toFixed(2)}
            </p>
          </div>
          <div className="p-3 bg-expense/10 rounded-full">
            <TrendingDown className="h-6 w-6 text-expense" />
          </div>
        </div>
      </Card>

      <Card className={`p-6 shadow-md bg-gradient-to-br ${
        isPositive 
          ? "from-income-light to-income-light/50" 
          : "from-expense-light to-expense-light/50"
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Balance</p>
            <p className={`text-2xl font-bold tabular-nums ${
              isPositive ? "text-income" : "text-expense"
            }`}>
              {isPositive ? "+" : ""}${balance.toFixed(2)}
            </p>
          </div>
          <div className={`p-3 rounded-full ${
            isPositive ? "bg-income/10" : "bg-expense/10"
          }`}>
            <Wallet className={`h-6 w-6 ${
              isPositive ? "text-income" : "text-expense"
            }`} />
          </div>
        </div>
      </Card>
    </div>
  );
};

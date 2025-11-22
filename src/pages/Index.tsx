import { useState } from "react";
import { TransactionInput } from "@/components/TransactionInput";
import { TransactionList } from "@/components/TransactionList";
import { WeeklySummary } from "@/components/WeeklySummary";
import { Wallet } from "lucide-react";

interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: "income" | "expense";
  description: string;
  paymentMethod: "card" | "cash" | "other";
}

const Index = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const handleTransactionsParsed = (parsedTransactions: any[]) => {
    const newTransactions = parsedTransactions.map((t, index) => ({
      id: `${Date.now()}-${index}`,
      ...t,
    }));
    setTransactions((prev) => [...newTransactions, ...prev]);
  };

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4">
            <Wallet className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Gestor de Gastos
          </h1>
          <p className="text-muted-foreground">
            Registra tus ingresos y gastos con inteligencia artificial
          </p>
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
        <TransactionList transactions={transactions} />
      </div>
    </div>
  );
};

export default Index;

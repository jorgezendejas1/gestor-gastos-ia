import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface TransactionInputProps {
  onTransactionsParsed: (transactions: any[]) => void;
}

export const TransactionInput = ({ onTransactionsParsed }: TransactionInputProps) => {
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<any[]>([]);

  const handleProcess = async () => {
    if (!input.trim()) {
      toast.error("Por favor, ingresa al menos una transacción");
      return;
    }

    setIsProcessing(true);
    setErrors([]);
    
    try {
      const { data, error } = await supabase.functions.invoke('parse-transactions', {
        body: { text: input }
      });

      if (error) {
        toast.error(error.message || "Error al procesar las transacciones");
        return;
      }

      if (!data || !data.transactions) {
        toast.error("No se pudieron parsear las transacciones");
        return;
      }

      // Separar transacciones válidas de errores
      const validTransactions = data.transactions.filter((t: any) => !t.error);
      const errorTransactions = data.transactions.filter((t: any) => t.error);

      if (errorTransactions.length > 0) {
        setErrors(errorTransactions);
        toast.warning(`${errorTransactions.length} entrada(s) ambigua(s) detectada(s)`);
      }

      if (validTransactions.length > 0) {
        onTransactionsParsed(validTransactions);
        toast.success(`${validTransactions.length} transacción(es) procesada(s)`);
        setInput("");
      }
      
    } catch (error) {
      toast.error("Error al procesar las transacciones");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="p-6 shadow-md">
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Registra tus movimientos
          </h2>
          <p className="text-sm text-muted-foreground">
            Escribe tus gastos e ingresos en texto libre. Por ejemplo: "50 supermercado tarjeta" o "2000 sueldo efectivo 15/11"
          </p>
        </div>

        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-semibold mb-2">Entradas ambiguas detectadas:</p>
              <ul className="space-y-1 text-sm">
                {errors.map((err, idx) => (
                  <li key={idx}>• {err.suggestion}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tus movimientos aquí...&#10;Ejemplos:&#10;- 45.50 café tarjeta&#10;- +2000 sueldo efectivo 01/11&#10;- -120 gasolina tarjeta 10/11"
          className="min-h-[150px] resize-none font-mono text-sm"
          disabled={isProcessing}
        />
        
        <Button
          onClick={handleProcess}
          disabled={isProcessing || !input.trim()}
          className="w-full"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Procesar con IA
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};

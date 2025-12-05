import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Sparkles, AlertCircle, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TransactionReviewModal } from "./TransactionReviewModal";

interface TransactionInputProps {
  onTransactionsParsed: (data: any) => void;
}

export const TransactionInput = ({ onTransactionsParsed }: TransactionInputProps) => {
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [errors, setErrors] = useState<any[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [pendingData, setPendingData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      const { transactions, saldoInicial, cerramosCon } = data;

      // Separar transacciones válidas de errores
      const validTransactions = transactions.filter((t: any) => !t.error);
      const errorTransactions = transactions.filter((t: any) => t.error);

      if (errorTransactions.length > 0) {
        setErrors(errorTransactions);
        toast.warning(`${errorTransactions.length} entrada(s) ambigua(s) detectada(s)`);
      }

      if (validTransactions.length > 0) {
        setPendingData({ transactions: validTransactions, saldoInicial, cerramosCon });
        setShowReviewModal(true);
      }
      
    } catch (error) {
      toast.error("Error al procesar las transacciones");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      toast.error("Por favor, selecciona una imagen válida");
      return;
    }

    // Validar tamaño (máx 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("La imagen es muy grande. Máximo 10MB");
      return;
    }

    setIsProcessingImage(true);
    setErrors([]);

    try {
      // Convertir imagen a base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remover el prefijo data:image/...;base64,
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke('parse-image-transactions', {
        body: { image: base64 }
      });

      if (error) {
        toast.error(error.message || "Error al procesar la imagen");
        return;
      }

      if (!data || !data.transactions) {
        toast.error("No se pudieron detectar transacciones en la imagen");
        return;
      }

      const { transactions, saldoInicial, cerramosCon } = data;

      // Separar transacciones válidas de errores
      const validTransactions = transactions.filter((t: any) => !t.error);
      const errorTransactions = transactions.filter((t: any) => t.error);

      if (errorTransactions.length > 0) {
        setErrors(errorTransactions);
        toast.warning(`${errorTransactions.length} entrada(s) ambigua(s) detectada(s)`);
      }

      if (validTransactions.length > 0) {
        setPendingData({ transactions: validTransactions, saldoInicial, cerramosCon });
        setShowReviewModal(true);
        toast.success(`${validTransactions.length} transacción(es) detectada(s) en la imagen`);
      } else {
        toast.warning("No se encontraron transacciones válidas en la imagen");
      }

    } catch (error) {
      toast.error("Error al procesar la imagen");
      console.error(error);
    } finally {
      setIsProcessingImage(false);
      // Limpiar el input para permitir subir la misma imagen de nuevo
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmTransactions = () => {
    if (pendingData) {
      onTransactionsParsed(pendingData);
      toast.success(`${pendingData.transactions.length} transacción(es) guardada(s)`);
      setInput("");
      setShowReviewModal(false);
      setPendingData(null);
    }
  };

  const handleCancelReview = () => {
    setShowReviewModal(false);
    setPendingData(null);
  };

  const handleUpdateTransactions = (updatedTransactions: any[]) => {
    if (pendingData) {
      setPendingData({ ...pendingData, transactions: updatedTransactions });
    }
  };

  return (
    <>
      <Card className="p-6 shadow-md">
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Registra tus movimientos
            </h2>
            <p className="text-sm text-muted-foreground">
              Escribe tus gastos e ingresos en texto libre, o sube una imagen de tu ticket/recibo.
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
          disabled={isProcessing || isProcessingImage}
        />

        <div className="flex gap-2">
          <Button
            onClick={handleProcess}
            disabled={isProcessing || isProcessingImage || !input.trim()}
            className="flex-1"
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
                Procesar Texto
              </>
            )}
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing || isProcessingImage}
            variant="outline"
            size="lg"
            className="min-w-[140px]"
          >
            {isProcessingImage ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analizando...
              </>
            ) : (
              <>
                <ImagePlus className="mr-2 h-4 w-4" />
                Subir Imagen
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>

    {pendingData && (
      <TransactionReviewModal
        open={showReviewModal}
        transactions={pendingData.transactions}
        saldoInicial={pendingData.saldoInicial}
        cerramosCon={pendingData.cerramosCon}
        onConfirm={handleConfirmTransactions}
        onCancel={handleCancelReview}
        onTransactionsChange={handleUpdateTransactions}
      />
    )}
    </>
  );
};

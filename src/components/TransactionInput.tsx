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
    if (!input.trim()) { toast.error("Ingresa al menos una transacción"); return; }
    setIsProcessing(true); setErrors([]);
    try {
      const { data, error } = await supabase.functions.invoke('parse-transactions', { body: { text: input } });
      if (error) { toast.error(error.message || "Error al procesar"); return; }
      if (!data?.transactions) { toast.error("No se pudieron parsear las transacciones"); return; }
      const { transactions, saldoInicial, cerramosCon } = data;
      const validTransactions = transactions.filter((t: any) => !t.error);
      const errorTransactions = transactions.filter((t: any) => t.error);
      if (errorTransactions.length > 0) { setErrors(errorTransactions); toast.warning(`${errorTransactions.length} entrada(s) ambigua(s)`); }
      if (validTransactions.length > 0) { setPendingData({ transactions: validTransactions, saldoInicial, cerramosCon }); setShowReviewModal(true); }
    } catch (error) { toast.error("Error al procesar"); console.error(error); } finally { setIsProcessing(false); }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error("Selecciona una imagen válida"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Imagen muy grande. Máximo 10MB"); return; }
    setIsProcessingImage(true); setErrors([]);
    try {
      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke('parse-image-transactions', { body: { image: imageDataUrl } });
      if (error) { toast.error(error.message || "Error al procesar la imagen"); return; }
      if (!data?.transactions) { toast.error("No se detectaron transacciones"); return; }
      const { transactions, saldoInicial, cerramosCon } = data;
      const validTransactions = transactions.filter((t: any) => !t.error);
      const errorTransactions = transactions.filter((t: any) => t.error);
      if (errorTransactions.length > 0) { setErrors(errorTransactions); }
      if (validTransactions.length > 0) {
        setPendingData({ transactions: validTransactions, saldoInicial, cerramosCon });
        setShowReviewModal(true);
        toast.success(`${validTransactions.length} transacción(es) detectada(s)`);
      } else { toast.warning("No se encontraron transacciones válidas"); }
    } catch (error) { toast.error("Error al procesar la imagen"); console.error(error); } finally {
      setIsProcessingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmTransactions = () => {
    if (pendingData) {
      onTransactionsParsed(pendingData);
      toast.success(`${pendingData.transactions.length} transacción(es) guardada(s)`);
      setInput(""); setShowReviewModal(false); setPendingData(null);
    }
  };

  const handleCancelReview = () => { setShowReviewModal(false); setPendingData(null); };

  const handleUpdateTransactions = (updatedTransactions: any[]) => {
    if (pendingData) setPendingData({ ...pendingData, transactions: updatedTransactions });
  };

  return (
    <>
      <Card className="p-5 rounded-2xl border-0 shadow-sm">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">
              Registra tus movimientos
            </h2>
            <p className="text-sm text-muted-foreground font-light">
              Escribe en texto libre o sube una imagen de tu ticket.
            </p>
          </div>

          {errors.length > 0 && (
            <Alert variant="destructive" className="rounded-xl border-0 bg-destructive/10">
              <AlertCircle className="h-5 w-5" />
              <AlertDescription>
                <p className="font-medium mb-1 text-sm">Entradas ambiguas:</p>
                <ul className="space-y-0.5 text-sm font-light">
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
            className="min-h-[120px] resize-none text-sm rounded-xl bg-secondary/50 border-0 focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
            disabled={isProcessing || isProcessingImage}
          />

          <div className="flex gap-3">
            <Button
              onClick={handleProcess}
              disabled={isProcessing || isProcessingImage || !input.trim()}
              className="flex-1 rounded-xl h-11"
              size="lg"
            >
              {isProcessing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Procesando...</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" />Procesar Texto</>
              )}
            </Button>

            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />

            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing || isProcessingImage}
              variant="secondary"
              size="lg"
              className="min-w-[140px] rounded-xl h-11"
            >
              {isProcessingImage ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analizando...</>
              ) : (
                <><ImagePlus className="mr-2 h-4 w-4" />Subir Imagen</>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {pendingData && (
        <TransactionReviewModal
          open={showReviewModal} transactions={pendingData.transactions}
          saldoInicial={pendingData.saldoInicial} cerramosCon={pendingData.cerramosCon}
          onConfirm={handleConfirmTransactions} onCancel={handleCancelReview}
          onTransactionsChange={handleUpdateTransactions}
        />
      )}
    </>
  );
};

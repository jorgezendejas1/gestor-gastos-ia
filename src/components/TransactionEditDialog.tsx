import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Wallet } from "lucide-react";
import { z } from "zod";

const transactionSchema = z.object({
  fecha: z.string().min(1, "La fecha es requerida"),
  descripcion: z.string().min(1, "La descripción es requerida").max(500, "Máximo 500 caracteres"),
  monto: z.number().positive("El monto debe ser positivo").max(100000000, "Monto máximo excedido"),
  tipo: z.enum(["income", "expense"]),
  metodoPago: z.enum(["card", "cash", "other"]),
  categoria: z.string().min(1, "La categoría es requerida").max(100, "Máximo 100 caracteres"),
});

interface Transaction {
  id: string;
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
}

interface TransactionEditDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  envelopes: string[];
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

export const TransactionEditDialog = ({ 
  transaction, 
  open, 
  onClose, 
  onSave,
  envelopes 
}: TransactionEditDialogProps) => {
  const [fecha, setFecha] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [tipo, setTipo] = useState<"income" | "expense">("expense");
  const [metodoPago, setMetodoPago] = useState<"card" | "cash" | "other">("other");
  const [categoria, setCategoria] = useState("");
  const [saving, setSaving] = useState(false);
  const [envelopeInfo, setEnvelopeInfo] = useState<EnvelopeInfo | null>(null);

  useEffect(() => {
    if (transaction) {
      setFecha(format(new Date(transaction.date + 'T12:00:00'), "yyyy-MM-dd"));
      setDescripcion(transaction.description);
      setMonto(transaction.amount.toString());
      setTipo(transaction.type);
      setMetodoPago(transaction.paymentMethod);
      setCategoria(transaction.categoria || "");
    }
  }, [transaction]);

  useEffect(() => {
    if (categoria && tipo === "expense") {
      loadEnvelopeInfo(categoria);
    } else {
      setEnvelopeInfo(null);
    }
  }, [categoria, tipo]);

  const loadEnvelopeInfo = async (nombre: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: sobre } = await supabase
      .from('sobres')
      .select('nombre, gastado_semana, semanal_calculado, mensual')
      .eq('user_id', user.id)
      .eq('nombre', nombre)
      .maybeSingle();

    if (sobre) {
      setEnvelopeInfo(sobre as EnvelopeInfo);
    } else {
      setEnvelopeInfo(null);
    }
  };

  const getCategoriesForType = () => {
    if (tipo === "income") {
      return INCOME_CATEGORIES;
    }
    return envelopes;
  };

  const handleSave = async () => {
    if (!transaction) return;
    
    // Validate with zod
    const validation = transactionSchema.safeParse({
      fecha,
      descripcion,
      monto: parseFloat(monto) || 0,
      tipo,
      metodoPago,
      categoria,
    });

    if (!validation.success) {
      const errors = validation.error.errors.map(e => e.message).join(", ");
      toast.error(errors);
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuario no autenticado");
        return;
      }

      const oldCategoria = transaction.categoria;
      const oldMonto = transaction.amount;
      const oldTipo = transaction.type;
      const newMonto = validation.data.monto;

      // Update the transaction
      const methodMap: Record<string, string> = { card: 'tarjeta', cash: 'efectivo', other: 'otro' };

      const { error: updateError } = await supabase
        .from('movimientos')
        .update({
          fecha,
          descripcion,
          monto: newMonto,
          tipo: tipo === "income" ? "ingreso" : "gasto",
          metodo_pago: methodMap[metodoPago] || metodoPago,
          categoria,
        })
        .eq('id', transaction.id);

      if (updateError) {
        toast.error("Error al actualizar el movimiento");
        console.error(updateError);
        return;
      }

      // If category or amount changed, update envelope spending
      if (oldCategoria !== categoria || oldMonto !== newMonto || oldTipo !== tipo) {
        // Revert old envelope spending if it was an expense
        if (oldCategoria && oldTipo === "expense") {
          const { data: oldSobre } = await supabase
            .from('sobres')
            .select('*')
            .eq('user_id', user.id)
            .eq('nombre', oldCategoria)
            .maybeSingle();

          if (oldSobre) {
            const newGastado = Math.max(0, Number(oldSobre.gastado_semana) - oldMonto);
            await supabase
              .from('sobres')
              .update({ 
                gastado_semana: newGastado,
                restante_semana: Number(oldSobre.semanal_calculado) - newGastado
              })
              .eq('id', oldSobre.id);
          }
        }

        // Add to new envelope spending if expense
        if (categoria && tipo === "expense") {
          const { data: newSobre } = await supabase
            .from('sobres')
            .select('*')
            .eq('user_id', user.id)
            .eq('nombre', categoria)
            .maybeSingle();

          if (newSobre) {
            const newGastado = Number(newSobre.gastado_semana) + newMonto;
            await supabase
              .from('sobres')
              .update({ 
                gastado_semana: newGastado,
                restante_semana: Number(newSobre.semanal_calculado) - newGastado
              })
              .eq('id', newSobre.id);
          } else {
            // Create new envelope if it doesn't exist
            const semanal = 100; // Default weekly budget for new envelope
            await supabase
              .from('sobres')
              .insert({
                user_id: user.id,
                nombre: categoria,
                mensual: semanal * 4.345,
                semanal_calculado: semanal,
                gastado_semana: newMonto,
                restante_semana: semanal - newMonto
              });
          }
        }

        // Recalculate week totals
        const { data: movimientos } = await supabase
          .from('movimientos')
          .select('*')
          .eq('user_id', user.id)
          .gte('fecha', format(new Date(fecha), 'yyyy-MM-dd'));

        if (movimientos) {
          // Find the week for this transaction
          const { data: semana } = await supabase
            .from('semanas')
            .select('*')
            .eq('user_id', user.id)
            .lte('fecha_inicio', fecha)
            .gte('fecha_fin', fecha)
            .maybeSingle();

          if (semana) {
            // Get all transactions for this week
            const { data: weekMovimientos } = await supabase
              .from('movimientos')
              .select('*')
              .eq('semana_id', semana.id);

            if (weekMovimientos) {
              let ingresos = 0;
              let gastos = 0;
              weekMovimientos.forEach(mov => {
                if (mov.tipo === 'ingreso') {
                  ingresos += Number(mov.monto);
                } else {
                  gastos += Number(mov.monto);
                }
              });

              await supabase
                .from('semanas')
                .update({
                  ingresos_totales: ingresos,
                  gastos_totales: gastos,
                  saldo_final: Number(semana.saldo_inicial) + ingresos - gastos
                })
                .eq('id', semana.id);
            }
          }
        }
      }

      // Learn from category correction if changed
      if (categoria !== oldCategoria && categoria) {
        await supabase
          .from('categoria_mappings')
          .upsert({
            user_id: user.id,
            descripcion_pattern: descripcion.toLowerCase(),
            categoria: categoria
          }, {
            onConflict: 'user_id,descripcion_pattern'
          });
      }

      toast.success("Movimiento actualizado correctamente");
      onSave();
      onClose();
    } catch (error) {
      console.error('Error updating transaction:', error);
      toast.error("Error al actualizar el movimiento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Movimiento</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="fecha">Fecha</Label>
            <Input
              id="fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Input
              id="descripcion"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="monto">Monto</Label>
            <Input
              id="monto"
              type="number"
              step="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Tipo</Label>
            <Select 
              value={tipo} 
              onValueChange={(v) => {
                setTipo(v as "income" | "expense");
                // Reset category when type changes
                setCategoria(v === "income" ? "OTROS INGRESOS" : "OTRAS");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Gasto</SelectItem>
                <SelectItem value="income">Ingreso</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Método de Pago</Label>
            <Select value={metodoPago} onValueChange={(v) => setMetodoPago(v as "card" | "cash" | "other")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="card">Tarjeta</SelectItem>
                <SelectItem value="cash">Efectivo</SelectItem>
                <SelectItem value="other">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Categoría {tipo === "expense" ? "(Sobre)" : "(Ingreso)"}</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar categoría" />
              </SelectTrigger>
              <SelectContent>
                {getCategoriesForType().map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Información del sobre para gastos */}
          {tipo === "expense" && envelopeInfo && (
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Información del sobre</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Gastado:</span>
                  <p className="font-medium">${envelopeInfo.gastado_semana.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Semanal:</span>
                  <p className="font-medium">${envelopeInfo.semanal_calculado.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Mensual:</span>
                  <p className="font-medium">${envelopeInfo.mensual.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

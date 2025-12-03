import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  paymentMethod: "card" | "cash" | "other";
  categoria?: string;
}

interface TransactionEditDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  envelopes: string[];
}

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

  useEffect(() => {
    if (transaction) {
      setFecha(format(new Date(transaction.date), "yyyy-MM-dd"));
      setDescripcion(transaction.description);
      setMonto(transaction.amount.toString());
      setTipo(transaction.type);
      setMetodoPago(transaction.paymentMethod);
      setCategoria(transaction.categoria || "");
    }
  }, [transaction]);

  const handleSave = async () => {
    if (!transaction) return;
    
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
      const newMonto = parseFloat(monto);

      // Update the transaction
      const { error: updateError } = await supabase
        .from('movimientos')
        .update({
          fecha,
          descripcion,
          monto: newMonto,
          tipo: tipo === "income" ? "ingreso" : "gasto",
          metodo_pago: metodoPago,
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
            <Select value={tipo} onValueChange={(v) => setTipo(v as "income" | "expense")}>
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
            <Label>Categoría (Sobre)</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar sobre" />
              </SelectTrigger>
              <SelectContent>
                {envelopes.map((env) => (
                  <SelectItem key={env} value={env}>
                    {env}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Envelope {
  id: string;
  nombre: string;
  mensual: number;
  semanal_calculado: number;
  gastado_semana: number;
  restante_semana: number;
}

interface EnvelopeEditorProps {
  envelope: Envelope | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  userId: string;
  mode: "edit" | "create";
}

export const EnvelopeEditor = ({
  envelope,
  isOpen,
  onClose,
  onSave,
  userId,
  mode,
}: EnvelopeEditorProps) => {
  const [nombre, setNombre] = useState("");
  const [mensual, setMensual] = useState("");
  const [saving, setSaving] = useState(false);

  // Actualizar estado cuando cambia el envelope o el modo
  useEffect(() => {
    if (mode === "edit" && envelope) {
      setNombre(envelope.nombre);
      setMensual(envelope.mensual.toString());
    } else if (mode === "create") {
      setNombre("");
      setMensual("");
    }
  }, [envelope, mode, isOpen]);

  const handleSave = async () => {
    if (!nombre.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    const mensualNum = parseFloat(mensual);
    if (isNaN(mensualNum) || mensualNum <= 0) {
      toast.error("El monto mensual debe ser mayor a 0");
      return;
    }

    setSaving(true);
    const semanalCalculado = Math.round((mensualNum / 4.345) * 100) / 100;

    if (mode === "edit" && envelope) {
      const { error } = await supabase
        .from("sobres")
        .update({
          nombre: nombre.trim().toUpperCase(),
          mensual: mensualNum,
          semanal_calculado: semanalCalculado,
          restante_semana: semanalCalculado - (envelope.gastado_semana || 0),
        })
        .eq("id", envelope.id);

      if (error) {
        console.error("Error updating envelope:", error);
        toast.error("Error al actualizar sobre");
        setSaving(false);
        return;
      }
      toast.success("Sobre actualizado");
    } else {
      const { error } = await supabase.from("sobres").insert({
        user_id: userId,
        nombre: nombre.trim().toUpperCase(),
        mensual: mensualNum,
        semanal_calculado: semanalCalculado,
        gastado_semana: 0,
        restante_semana: semanalCalculado,
      });

      if (error) {
        console.error("Error creating envelope:", error);
        toast.error("Error al crear sobre");
        setSaving(false);
        return;
      }
      toast.success("Sobre creado");
    }

    setSaving(false);
    onSave();
    onClose();
  };

  const handleClose = () => {
    // Limpiar estado al cerrar
    if (mode === "create") {
      setNombre("");
      setMensual("");
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Editar Sobre" : "Nuevo Sobre"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre del sobre</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value.toUpperCase())}
              placeholder="Ej: GASOLINA"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mensual">Presupuesto mensual ($)</Label>
            <Input
              id="mensual"
              type="number"
              value={mensual}
              onChange={(e) => setMensual(e.target.value)}
              placeholder="Ej: 5000"
              min="0"
              step="0.01"
            />
            {mensual && !isNaN(parseFloat(mensual)) && (
              <p className="text-xs text-muted-foreground">
                Semanal: ${(parseFloat(mensual) / 4.345).toFixed(2)}
              </p>
            )}
          </div>

          {mode === "edit" && envelope && (
            <div className="bg-muted/50 p-3 rounded-lg text-sm">
              <p className="text-muted-foreground mb-1">Estado actual:</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">Gastado:</span>{" "}
                  <span className="font-medium">${envelope.gastado_semana?.toFixed(2) || "0.00"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Restante:</span>{" "}
                  <span className="font-medium">${envelope.restante_semana?.toFixed(2) || "0.00"}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

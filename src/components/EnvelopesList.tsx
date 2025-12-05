import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Package, Plus, Pencil, Trash2, PiggyBank, Wallet } from "lucide-react";
import { toast } from "sonner";
import { EnvelopeEditor } from "./EnvelopeEditor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Envelope {
  id: string;
  nombre: string;
  mensual: number;
  semanal_calculado: number;
  gastado_semana: number;
  restante_semana: number;
  tipo?: "gasto" | "ahorro";
}

interface EnvelopesListProps {
  userId: string;
  canEdit?: boolean;
}

export const EnvelopesList = ({ userId, canEdit = true }: EnvelopesListProps) => {
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"edit" | "create">("create");
  const [selectedEnvelope, setSelectedEnvelope] = useState<Envelope | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [envelopeToDelete, setEnvelopeToDelete] = useState<Envelope | null>(null);

  useEffect(() => {
    loadEnvelopes();
  }, [userId]);

  const loadEnvelopes = async () => {
    const { data, error } = await supabase
      .from('sobres')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) {
      console.error('Error loading envelopes:', error);
      toast.error('Error al cargar sobres');
      return;
    }

    setEnvelopes((data || []) as Envelope[]);
    setLoading(false);
  };

  const initializeDefaultEnvelopes = async () => {
    const defaultEnvelopes = [
      { nombre: 'ABIX', mensual: 652 },
      { nombre: 'ABOGADO', mensual: 3000 },
      { nombre: 'AGUA', mensual: 500 },
      { nombre: 'AMAZON', mensual: 100 },
      { nombre: 'APPLE', mensual: 700 },
      { nombre: 'BANORTE', mensual: 600 },
      { nombre: 'BEBBIA', mensual: 380 },
      { nombre: 'CFE', mensual: 3000 },
      { nombre: 'COLEGIATURA MAU', mensual: 1840 },
      { nombre: 'DISNEY', mensual: 160 },
      { nombre: 'GASOLINA', mensual: 7400 },
      { nombre: 'MTO ANGIE', mensual: 600 },
      { nombre: 'MTO CARIOTA', mensual: 900 },
      { nombre: 'MTO JARDINES', mensual: 1200 },
      { nombre: 'NETFLIX', mensual: 500 },
      { nombre: 'PASAJES VIC', mensual: 800 },
      { nombre: 'RECARGAS CEL', mensual: 400 },
      { nombre: 'SEGURO AUDI', mensual: 900 },
      { nombre: 'SUPER', mensual: 20000 },
      { nombre: 'TRANSPORTE LEO', mensual: 3200 },
      { nombre: 'XBOX', mensual: 300 },
      { nombre: 'YOUTUBE', mensual: 320 },
      { nombre: 'ACEITE', mensual: 300 },
      { nombre: 'ANTICONGELANTE', mensual: 200 },
      { nombre: 'FARMACIA', mensual: 600 },
      { nombre: 'PROPINAS', mensual: 400 },
      { nombre: 'OTRAS', mensual: 400 },
    ];

    const sobresData = defaultEnvelopes.map(env => ({
      user_id: userId,
      nombre: env.nombre,
      mensual: env.mensual,
      semanal_calculado: Math.round((env.mensual / 4.345) * 100) / 100,
      gastado_semana: 0,
      restante_semana: Math.round((env.mensual / 4.345) * 100) / 100,
      tipo: 'gasto' as const,
    }));

    const { error } = await supabase
      .from('sobres')
      .insert(sobresData);

    if (error) {
      console.error('Error initializing envelopes:', error);
      toast.error('Error al inicializar sobres');
      return;
    }

    toast.success('Sobres inicializados correctamente');
    loadEnvelopes();
  };

  const handleEdit = (envelope: Envelope) => {
    setSelectedEnvelope(envelope);
    setEditorMode("edit");
    setEditorOpen(true);
  };

  const handleCreate = () => {
    setSelectedEnvelope(null);
    setEditorMode("create");
    setEditorOpen(true);
  };

  const handleDeleteClick = (envelope: Envelope) => {
    setEnvelopeToDelete(envelope);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!envelopeToDelete) return;

    const { error } = await supabase
      .from("sobres")
      .delete()
      .eq("id", envelopeToDelete.id);

    if (error) {
      console.error("Error deleting envelope:", error);
      toast.error("Error al eliminar sobre");
      return;
    }

    toast.success("Sobre eliminado");
    setDeleteDialogOpen(false);
    setEnvelopeToDelete(null);
    loadEnvelopes();
  };

  const gastoEnvelopes = envelopes.filter(e => e.tipo !== "ahorro");
  const ahorroEnvelopes = envelopes.filter(e => e.tipo === "ahorro");

  const renderEnvelopeCard = (envelope: Envelope) => {
    const isAhorro = envelope.tipo === "ahorro";
    const percentage = envelope.semanal_calculado > 0
      ? (envelope.gastado_semana / envelope.semanal_calculado) * 100
      : 0;
    const isOverBudget = !isAhorro && percentage > 100;
    const metaCumplida = isAhorro && percentage >= 100;

    return (
      <Card key={envelope.id} className="p-4 space-y-3 group relative">
        {canEdit && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => handleEdit(envelope)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => handleDeleteClick(envelope)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <div className="flex justify-between items-start pr-16">
          <div className="flex items-center gap-2">
            {isAhorro ? (
              <PiggyBank className="h-4 w-4 text-green-600" />
            ) : (
              <Wallet className="h-4 w-4 text-primary" />
            )}
            <h3 className="font-semibold text-sm">{envelope.nombre}</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            ${envelope.mensual}/mes
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Semanal</span>
            <span className="font-medium">
              ${envelope.semanal_calculado.toFixed(2)}
            </span>
          </div>

          <Progress 
            value={Math.min(percentage, 100)} 
            className={
              isAhorro 
                ? metaCumplida ? "bg-green-500/20" : ""
                : isOverBudget ? "bg-destructive/20" : ""
            }
          />

          <div className="flex justify-between text-xs">
            <span className={
              isAhorro 
                ? metaCumplida ? "text-green-600" : "text-muted-foreground"
                : isOverBudget ? "text-destructive" : "text-muted-foreground"
            }>
              {isAhorro ? "Ahorrado:" : "Gastado:"} ${envelope.gastado_semana.toFixed(2)}
            </span>
            <span className={
              isAhorro
                ? metaCumplida ? "text-green-600 font-medium" : "text-primary font-medium"
                : isOverBudget ? "text-destructive font-medium" : "text-primary font-medium"
            }>
              {isAhorro 
                ? metaCumplida ? "¡Meta cumplida!" : `Falta: $${envelope.restante_semana.toFixed(2)}`
                : isOverBudget ? "Excedido" : `Restante: $${envelope.restante_semana.toFixed(2)}`
              }
            </span>
          </div>
        </div>
      </Card>
    );
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <p className="text-muted-foreground">Cargando sobres...</p>
        </div>
      </Card>
    );
  }

  if (envelopes.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center space-y-4">
          <Package className="h-12 w-12 text-muted-foreground mx-auto" />
          <div>
            <h3 className="text-lg font-semibold mb-2">No hay sobres configurados</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Inicializa tus sobres de presupuesto para comenzar a monitorear tus gastos semanales
            </p>
            {canEdit && (
              <div className="flex gap-2 justify-center">
                <Button onClick={initializeDefaultEnvelopes}>
                  <Plus className="h-4 w-4 mr-2" />
                  Inicializar Sobres
                </Button>
                <Button variant="outline" onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Sobre
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Package className="h-6 w-6" />
          Sobres
        </h2>
        {canEdit && (
          <Button onClick={handleCreate} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Sobre
          </Button>
        )}
      </div>

      <Tabs defaultValue="gastos" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="gastos" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Gastos ({gastoEnvelopes.length})
          </TabsTrigger>
          <TabsTrigger value="ahorros" className="flex items-center gap-2">
            <PiggyBank className="h-4 w-4" />
            Ahorros ({ahorroEnvelopes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gastos">
          {gastoEnvelopes.length === 0 ? (
            <Card className="p-6 text-center">
              <Wallet className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No hay sobres de gastos</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {gastoEnvelopes.map(renderEnvelopeCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ahorros">
          {ahorroEnvelopes.length === 0 ? (
            <Card className="p-6 text-center">
              <PiggyBank className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm mb-2">No hay sobres de ahorro</p>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear sobre de ahorro
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ahorroEnvelopes.map(renderEnvelopeCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <EnvelopeEditor
        envelope={selectedEnvelope}
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={loadEnvelopes}
        userId={userId}
        mode={editorMode}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar sobre?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar el sobre "{envelopeToDelete?.nombre}"? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
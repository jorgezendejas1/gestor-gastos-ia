import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Plus, Pencil, Trash2, PiggyBank, Wallet, CreditCard, Banknote, Receipt } from "lucide-react";
import { toast } from "sonner";
import { EnvelopeEditor } from "./EnvelopeEditor";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Envelope {
  id: string;
  nombre: string;
  mensual: number;
  semanal_calculado: number;
  gastado_semana: number;
  restante_semana: number;
  tipo?: "gasto" | "ahorro";
}

interface Movement {
  id: string;
  fecha: string;
  descripcion: string;
  monto: number;
  metodo_pago: string;
  tipo: string;
}

interface EnvelopesListProps {
  userId: string;
  canEdit?: boolean;
}

const paymentMethodIcon = (method: string) => {
  switch (method?.toLowerCase()) {
    case "tarjeta": case "tarjeta de débito": case "tarjeta de crédito":
      return <CreditCard className="h-4 w-4 text-muted-foreground" />;
    case "efectivo":
      return <Banknote className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Receipt className="h-4 w-4 text-muted-foreground" />;
  }
};

export const EnvelopesList = ({ userId, canEdit = true }: EnvelopesListProps) => {
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"edit" | "create">("create");
  const [editingEnvelope, setEditingEnvelope] = useState<Envelope | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [envelopeToDelete, setEnvelopeToDelete] = useState<Envelope | null>(null);
  const [selectedEnvelope, setSelectedEnvelope] = useState<Envelope | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [envelopeMovements, setEnvelopeMovements] = useState<Movement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  useEffect(() => { loadEnvelopes(); }, [userId]);

  const loadEnvelopes = async () => {
    const { data, error } = await supabase.from('sobres').select('*').eq('user_id', userId).order('nombre', { ascending: true });
    if (error) { console.error('Error loading envelopes:', error); toast.error('Error al cargar sobres'); return; }
    setEnvelopes((data || []) as Envelope[]);
    setLoading(false);
  };

  const loadEnvelopeMovements = async (nombre: string) => {
    setLoadingMovements(true);
    try {
      const now = new Date();
      const localDate = now.toISOString().split('T')[0];
      const { data: semana } = await supabase.from('semanas').select('id').eq('user_id', userId)
        .lte('fecha_inicio', localDate).gte('fecha_fin', localDate).maybeSingle();
      if (!semana) { setEnvelopeMovements([]); setLoadingMovements(false); return; }
      const { data: movimientos, error } = await supabase.from('movimientos')
        .select('id, fecha, descripcion, monto, metodo_pago, tipo')
        .eq('user_id', userId).eq('semana_id', semana.id).eq('categoria', nombre)
        .order('fecha', { ascending: false });
      if (error) { setEnvelopeMovements([]); } else { setEnvelopeMovements((movimientos || []) as Movement[]); }
    } catch { setEnvelopeMovements([]); }
    setLoadingMovements(false);
  };

  const handleCardClick = (envelope: Envelope) => {
    setSelectedEnvelope(envelope);
    setSheetOpen(true);
    loadEnvelopeMovements(envelope.nombre);
  };

  const initializeDefaultEnvelopes = async () => {
    const defaultEnvelopes = [
      { nombre: 'ABIX', mensual: 652 }, { nombre: 'ABOGADO', mensual: 3000 },
      { nombre: 'AGUA', mensual: 500 }, { nombre: 'AMAZON', mensual: 100 },
      { nombre: 'APPLE', mensual: 700 }, { nombre: 'BANORTE', mensual: 600 },
      { nombre: 'BEBBIA', mensual: 380 }, { nombre: 'CFE', mensual: 3000 },
      { nombre: 'COLEGIATURA MAU', mensual: 1840 }, { nombre: 'DISNEY', mensual: 160 },
      { nombre: 'GASOLINA', mensual: 7400 }, { nombre: 'MTO ANGIE', mensual: 600 },
      { nombre: 'MTO CARIOTA', mensual: 900 }, { nombre: 'MTO JARDINES', mensual: 1200 },
      { nombre: 'NETFLIX', mensual: 500 }, { nombre: 'PASAJES VIC', mensual: 800 },
      { nombre: 'RECARGAS CEL', mensual: 400 }, { nombre: 'SEGURO AUDI', mensual: 900 },
      { nombre: 'SUPER', mensual: 20000 }, { nombre: 'TRANSPORTE LEO', mensual: 3200 },
      { nombre: 'XBOX', mensual: 300 }, { nombre: 'YOUTUBE', mensual: 320 },
      { nombre: 'ACEITE', mensual: 300 }, { nombre: 'ANTICONGELANTE', mensual: 200 },
      { nombre: 'FARMACIA', mensual: 600 }, { nombre: 'PROPINAS', mensual: 400 },
      { nombre: 'OTRAS', mensual: 400 },
    ];
    const sobresData = defaultEnvelopes.map(env => ({
      user_id: userId, nombre: env.nombre, mensual: env.mensual,
      semanal_calculado: Math.round((env.mensual / 4.345) * 100) / 100,
      gastado_semana: 0, restante_semana: Math.round((env.mensual / 4.345) * 100) / 100,
      tipo: 'gasto' as const,
    }));
    const { error } = await supabase.from('sobres').insert(sobresData);
    if (error) { toast.error('Error al inicializar sobres'); return; }
    toast.success('Sobres inicializados correctamente');
    loadEnvelopes();
  };

  const handleEdit = (envelope: Envelope, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEnvelope(envelope); setEditorMode("edit"); setEditorOpen(true);
  };

  const handleCreate = () => {
    setEditingEnvelope(null); setEditorMode("create"); setEditorOpen(true);
  };

  const handleDeleteClick = (envelope: Envelope, e: React.MouseEvent) => {
    e.stopPropagation();
    setEnvelopeToDelete(envelope); setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!envelopeToDelete) return;
    const { error } = await supabase.from("sobres").delete().eq("id", envelopeToDelete.id);
    if (error) { toast.error("Error al eliminar sobre"); return; }
    toast.success("Sobre eliminado");
    setDeleteDialogOpen(false); setEnvelopeToDelete(null); loadEnvelopes();
  };

  const gastoEnvelopes = envelopes.filter(e => e.tipo !== "ahorro");
  const ahorroEnvelopes = envelopes.filter(e => e.tipo === "ahorro");

  const totalPresupuestoGasto = gastoEnvelopes.reduce((sum, e) => sum + e.semanal_calculado, 0);
  const totalGastadoGasto = gastoEnvelopes.reduce((sum, e) => sum + e.gastado_semana, 0);
  const totalPresupuestoAhorro = ahorroEnvelopes.reduce((sum, e) => sum + e.semanal_calculado, 0);
  const totalGastadoAhorro = ahorroEnvelopes.reduce((sum, e) => sum + e.gastado_semana, 0);

  const renderEnvelopeRow = (envelope: Envelope) => {
    const isAhorro = envelope.tipo === "ahorro";
    const percentage = envelope.semanal_calculado > 0 ? (envelope.gastado_semana / envelope.semanal_calculado) * 100 : 0;
    const isOverBudget = !isAhorro && percentage > 100;

    return (
      <div
        key={envelope.id}
        className="flex items-center gap-4 py-3.5 px-1 cursor-pointer hover:bg-secondary/40 rounded-xl transition-colors group"
        onClick={() => handleCardClick(envelope)}
      >
        {/* Icon */}
        <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${isAhorro ? 'bg-success/15' : 'bg-primary/10'}`}>
          {isAhorro ? <PiggyBank className="h-5 w-5 text-success" /> : <Wallet className="h-5 w-5 text-primary" />}
        </div>

        {/* Name + progress bar */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium truncate">{envelope.nombre}</span>
            <span className={`text-xs font-semibold tabular-nums ml-2 shrink-0 ${isOverBudget ? 'text-destructive' : 'text-muted-foreground'}`}>
              ${envelope.gastado_semana.toFixed(0)} / ${envelope.semanal_calculado.toFixed(0)}
            </span>
          </div>
          <div className="relative h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className={`absolute left-0 top-0 h-full rounded-full transition-all ${isOverBudget ? 'bg-destructive' : isAhorro ? 'bg-success' : 'bg-primary'}`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Remaining */}
        <span className={`text-sm font-semibold tabular-nums shrink-0 w-20 text-right ${isOverBudget ? 'text-destructive' : 'text-success'}`}>
          {isOverBudget ? `+$${Math.abs(envelope.restante_semana).toFixed(0)}` : `$${envelope.restante_semana.toFixed(0)}`}
        </span>

        {/* Edit/delete on hover */}
        {canEdit && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={(e) => handleEdit(envelope, e)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive" onClick={(e) => handleDeleteClick(envelope, e)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderBudgetHeader = (label: string, total: number, spent: number, isAhorro: boolean) => (
    <div className={`rounded-2xl p-5 mb-4 text-primary-foreground ${isAhorro ? 'bg-gradient-to-br from-success to-success/80' : 'bg-gradient-to-br from-primary to-primary/80'}`}>
      <p className="text-xs font-medium opacity-70 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-4xl font-light tabular-nums">${total.toFixed(2)}</p>
      <div className="flex items-center gap-4 mt-3">
        <div>
          <p className="text-xs opacity-70">{isAhorro ? 'Ahorrado' : 'Gastado'}</p>
          <p className="text-lg font-semibold tabular-nums">${spent.toFixed(2)}</p>
        </div>
        <div className="h-8 w-px bg-white/20" />
        <div>
          <p className="text-xs opacity-70">Disponible</p>
          <p className="text-lg font-semibold tabular-nums">${(total - spent).toFixed(2)}</p>
        </div>
      </div>
    </div>
  );

  const renderSheetContent = () => {
    if (!selectedEnvelope) return null;
    const env = selectedEnvelope;
    const isAhorro = env.tipo === "ahorro";
    const percentage = env.semanal_calculado > 0 ? (env.gastado_semana / env.semanal_calculado) * 100 : 0;
    const diferencia = env.semanal_calculado - env.gastado_semana;

    return (
      <div className="space-y-6 mt-6">
        <div className="space-y-3">
          <div className="flex justify-between items-baseline">
            <span className="text-sm text-muted-foreground font-light">{isAhorro ? "Ahorrado" : "Gastado"}</span>
            <span className="text-2xl font-light tabular-nums">${env.gastado_semana.toFixed(2)}</span>
          </div>
          <Progress value={Math.min(percentage, 100)} className="h-2 rounded-full" />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground font-light">Presupuesto semanal</span>
            <span className="font-medium">${env.semanal_calculado.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground font-light">Restante</span>
            <span className={`font-semibold ${diferencia >= 0 ? "text-success" : "text-destructive"}`}>
              {diferencia >= 0 ? "+" : ""}${diferencia.toFixed(2)}
            </span>
          </div>
        </div>

        <div>
          <h4 className="text-xs text-muted-foreground font-medium tracking-wide uppercase mb-3">
            Movimientos esta semana
          </h4>
          {loadingMovements ? (
            <p className="text-sm text-muted-foreground text-center py-6 font-light">Cargando...</p>
          ) : envelopeMovements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6 font-light">Sin movimientos esta semana</p>
          ) : (
            <div className="divide-y divide-border">
              {envelopeMovements.map((mov) => (
                <div key={mov.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {paymentMethodIcon(mov.metodo_pago)}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{mov.descripcion}</p>
                      <p className="text-xs text-muted-foreground font-light">
                        {format(new Date(mov.fecha + 'T12:00:00'), 'dd MMM', { locale: es })} · {mov.metodo_pago}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ml-3 ${
                    mov.tipo === 'ingreso' ? 'text-success' : 'text-foreground'
                  }`}>
                    {mov.tipo === 'ingreso' ? '+' : '-'}${mov.monto.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {envelopeMovements.length > 0 && (
          <div className="bg-secondary/50 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground font-light">Total</span>
              <span className="font-semibold">${env.gastado_semana.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground font-light">Presupuesto</span>
              <span className="font-semibold">${env.semanal_calculado.toFixed(2)}</span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between text-sm font-semibold">
              <span>Diferencia</span>
              <span className={diferencia >= 0 ? "text-success" : "text-destructive"}>
                {diferencia >= 0 ? "+" : ""}${diferencia.toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="rounded-2xl bg-card border-0 shadow-sm p-6">
        <p className="text-muted-foreground text-center font-light">Cargando sobres...</p>
      </div>
    );
  }

  if (envelopes.length === 0) {
    return (
      <Card className="p-8 rounded-2xl border-0 shadow-sm">
        <div className="text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Package className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-1">No hay sobres configurados</h3>
            <p className="text-sm text-muted-foreground font-light mb-4">
              Inicializa tus sobres para monitorear tus gastos semanales
            </p>
            {canEdit && (
              <div className="flex gap-3 justify-center">
                <Button onClick={initializeDefaultEnvelopes} className="rounded-xl">
                  <Plus className="h-4 w-4 mr-2" />
                  Inicializar Sobres
                </Button>
                <Button variant="outline" onClick={handleCreate} className="rounded-xl">
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
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Package className="h-5 w-5" />
          Sobres
        </h2>
        {canEdit && (
          <Button onClick={handleCreate} size="sm" className="rounded-xl">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo
          </Button>
        )}
      </div>

      <Tabs defaultValue="gastos" className="w-full">
        <TabsList className="ios-segmented-control grid w-full grid-cols-2 mb-4 h-auto p-1">
          <TabsTrigger value="gastos" className="flex items-center gap-2 py-2">
            <Wallet className="h-4 w-4" />
            Gastos ({gastoEnvelopes.length})
          </TabsTrigger>
          <TabsTrigger value="ahorros" className="flex items-center gap-2 py-2">
            <PiggyBank className="h-4 w-4" />
            Ahorros ({ahorroEnvelopes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gastos">
          {gastoEnvelopes.length === 0 ? (
            <div className="rounded-2xl bg-card border-0 shadow-sm p-6 text-center">
              <Wallet className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground font-light">No hay sobres de gastos</p>
            </div>
          ) : (
            <>
              {renderBudgetHeader("Presupuesto Semanal", totalPresupuestoGasto, totalGastadoGasto, false)}
              <div className="rounded-2xl bg-card border-0 shadow-sm divide-y divide-border/50 px-4">
                {gastoEnvelopes.map(renderEnvelopeRow)}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="ahorros">
          {ahorroEnvelopes.length === 0 ? (
            <div className="rounded-2xl bg-card border-0 shadow-sm p-6 text-center">
              <PiggyBank className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm font-light mb-2">No hay sobres de ahorro</p>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={handleCreate} className="rounded-xl">
                  <Plus className="h-4 w-4 mr-2" />
                  Crear sobre de ahorro
                </Button>
              )}
            </div>
          ) : (
            <>
              {renderBudgetHeader("Meta de Ahorro Semanal", totalPresupuestoAhorro, totalGastadoAhorro, true)}
              <div className="rounded-2xl bg-card border-0 shadow-sm divide-y divide-border/50 px-4">
                {ahorroEnvelopes.map(renderEnvelopeRow)}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto rounded-l-2xl border-0">
          <SheetHeader className={`-mx-6 -mt-6 px-6 pt-6 pb-4 rounded-tl-2xl ${
            selectedEnvelope?.tipo === "ahorro"
              ? "bg-gradient-to-br from-success/10 to-success/5"
              : "bg-gradient-to-br from-primary/10 to-primary/5"
          }`}>
            <SheetTitle className="flex items-center gap-3 text-lg">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                selectedEnvelope?.tipo === "ahorro" ? "bg-success/15" : "bg-primary/15"
              }`}>
                {selectedEnvelope?.tipo === "ahorro"
                  ? <PiggyBank className="h-5 w-5 text-success" />
                  : <Wallet className="h-5 w-5 text-primary" />
                }
              </div>
              {selectedEnvelope?.nombre}
            </SheetTitle>
            <SheetDescription className="font-light">
              {selectedEnvelope?.tipo === "ahorro" ? "Sobre de ahorro" : "Sobre de gasto"} · ${selectedEnvelope?.mensual}/mes
            </SheetDescription>
          </SheetHeader>
          {renderSheetContent()}
        </SheetContent>
      </Sheet>

      <EnvelopeEditor
        envelope={editingEnvelope} isOpen={editorOpen}
        onClose={() => setEditorOpen(false)} onSave={loadEnvelopes}
        userId={userId} mode={editorMode}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar sobre?</AlertDialogTitle>
            <AlertDialogDescription className="font-light">
              ¿Estás seguro de eliminar el sobre "{envelopeToDelete?.nombre}"? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

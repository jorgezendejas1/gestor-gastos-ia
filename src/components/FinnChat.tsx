import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  userId: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

const WELCOME = "Hola, soy Finn 👋 Tu asesor financiero personal. Tengo acceso a todos tus movimientos y presupuestos. ¿En qué te puedo ayudar hoy?";

const SUGGESTIONS = [
  "¿Cómo voy este mes?",
  "¿En qué gasto más?",
  "¿Cuánto me queda de presupuesto?",
  "Dame un consejo de ahorro",
];

const getCancunDate = (): Date => {
  const now = new Date();
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Cancun", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
};

const FinnChat = ({ userId }: Props) => {
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: WELCOME }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const buildContext = async (): Promise<string> => {
    const now = getCancunDate();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const mesActual = now.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    const diasEnMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const diaActual = now.getDate();
    const diasRestantes = diasEnMes - diaActual;

    const monthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd');
    const monthEnd = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd');

    const [weekRes, sobresRes, txRes, monthTxRes] = await Promise.all([
      supabase.from("semanas").select("*").eq("user_id", userId).eq("fecha_inicio", format(weekStart, "yyyy-MM-dd")).single(),
      supabase.from("sobres").select("*").eq("user_id", userId),
      supabase.from("movimientos").select("*").eq("user_id", userId).order("fecha", { ascending: false }).limit(10),
      supabase.from("movimientos").select("monto, tipo, categoria").eq("user_id", userId).gte("fecha", monthStart).lte("fecha", monthEnd),
    ]);

    const week = weekRes.data;
    const sobres = sobresRes.data || [];
    const txs = txRes.data || [];
    const monthTxs = monthTxRes.data || [];

    const gastoMensual = monthTxs.filter(t => t.tipo === 'gasto').reduce((s, t) => s + Number(t.monto), 0);
    const ingresoMensual = monthTxs.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + Number(t.monto), 0);
    const gastoDiarioPromedio = diaActual > 0 ? gastoMensual / diaActual : 0;
    const proyeccionMes = gastoMensual + (gastoDiarioPromedio * diasRestantes);
    const proyeccionSuperavit = ingresoMensual - proyeccionMes;

    const catTotals: Record<string, number> = {};
    monthTxs.filter(t => t.tipo === 'gasto').forEach(t => {
      const cat = t.categoria || 'Sin categoría';
      catTotals[cat] = (catTotals[cat] || 0) + Number(t.monto);
    });
    const topCats = Object.entries(catTotals)
      .sort(([,a],[,b]) => b - a)
      .slice(0, 5)
      .map(([cat, monto]) => `- ${cat}: $${monto.toFixed(0)}`);

    const topEnvelopes = [...sobres]
      .map(s => ({ ...s, percentage: s.semanal_calculado > 0 ? (Number(s.gastado_semana || 0) / s.semanal_calculado) * 100 : 0 }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 5);

    const overBudget = sobres.filter(s => Number(s.gastado_semana || 0) > s.semanal_calculado);

    return `Eres Finn, el asesor financiero personal e inteligente del usuario. Tu personalidad es:
- Amigable, directo y empático — como un amigo que sabe mucho de finanzas
- Usas español mexicano natural, ocasionalmente emojis (no en exceso)
- Eres proactivo: si ves algo preocupante en los datos, lo mencionas aunque no te pregunten
- Tus respuestas son concisas (máximo 4 párrafos) pero completas
- Cuando el usuario pregunta "¿cómo voy?", das un diagnóstico real con los números
- Siempre tienes presente el historial de la conversación para dar continuidad

FECHA ACTUAL: ${format(now, "EEEE d 'de' MMMM yyyy", { locale: es })}
MES EN CURSO: ${mesActual} (día ${diaActual} de ${diasEnMes}, faltan ${diasRestantes} días)

═══════════════════════════════════
SEMANA ACTUAL
═══════════════════════════════════
- Saldo inicial de semana: $${week?.saldo_inicial?.toFixed(2) ?? '0.00'}
- Ingresos esta semana: $${week?.ingresos_totales?.toFixed(2) ?? '0.00'}
- Gastos esta semana: $${week?.gastos_totales?.toFixed(2) ?? '0.00'}
- Saldo actual: $${week?.saldo_final?.toFixed(2) ?? '0.00'}

═══════════════════════════════════
MES ACTUAL (${mesActual})
═══════════════════════════════════
- Ingresos del mes: $${ingresoMensual.toFixed(2)}
- Gastos del mes: $${gastoMensual.toFixed(2)}
- Gasto diario promedio: $${gastoDiarioPromedio.toFixed(2)}
- Proyección de gasto al cierre del mes: $${proyeccionMes.toFixed(2)}
- Proyección de ${proyeccionSuperavit >= 0 ? 'SUPERÁVIT' : 'DÉFICIT'} al cierre: $${Math.abs(proyeccionSuperavit).toFixed(2)}

TOP 5 CATEGORÍAS DEL MES:
${topCats.join('\n') || '- Sin datos aún'}

═══════════════════════════════════
SOBRES DE PRESUPUESTO (semana actual)
═══════════════════════════════════
${topEnvelopes.map(e => 
  `- ${e.nombre}: $${Number(e.gastado_semana||0).toFixed(0)} / $${e.semanal_calculado.toFixed(0)} (${e.percentage.toFixed(0)}%)${e.percentage > 100 ? ' ⚠️ EXCEDIDO' : e.percentage > 80 ? ' ⚡ casi agotado' : ''}`
).join('\n')}

SOBRES EXCEDIDOS ESTA SEMANA: ${overBudget.map(e => e.nombre).join(', ') || 'Ninguno ✅'}

═══════════════════════════════════
ÚLTIMAS 10 TRANSACCIONES
═══════════════════════════════════
${txs.map(t => `- ${t.fecha}: ${t.descripcion} | $${Number(t.monto).toFixed(2)} | ${t.tipo} | ${t.categoria || 'sin categoría'}`).join('\n')}`;
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { role: "user", content: text.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      const context = await buildContext();

      // Send full history EXCEPT the welcome message (index 0)
      const historyToSend = updatedMessages
        .filter((_, i) => i > 0) // remove welcome message
        .map(m => ({ role: m.role, content: m.content }));

      const { data, error } = await supabase.functions.invoke("finn-chat", {
        body: { 
          message: text.trim(), 
          context,
          history: historyToSend.slice(0, -1) // previous history without current message
        },
      });

      if (error) throw error;

      const reply = data?.reply || "Lo siento, no pude procesar tu solicitud.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (e: any) {
      console.error("Finn error:", e);
      setMessages(prev => [...prev, { role: "assistant", content: "Ocurrió un error. Intenta de nuevo." }]);
    }
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-[500px]">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border/50">
        <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-lg">
          F
        </div>
        <div>
          <p className="font-semibold text-sm">Finn</p>
          <p className="text-xs text-muted-foreground">Tu asesor financiero IA</p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        <div className="space-y-3 py-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-secondary text-secondary-foreground rounded-bl-md"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-secondary rounded-2xl rounded-bl-md px-4 py-2.5 text-sm flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Finn está escribiendo...
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Quick suggestions */}
      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => sendMessage(s)}
              className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 p-4 border-t border-border/50">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
          placeholder="Pregúntale a Finn..."
          className="rounded-full bg-secondary/50 border-0 focus-visible:ring-1"
          disabled={isLoading}
        />
        <Button
          size="icon"
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isLoading}
          className="rounded-full h-10 w-10 shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export { FinnChat };

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization header exists
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { image } = await req.json();
    
    if (!image || typeof image !== 'string') {
      return new Response(
        JSON.stringify({ error: "Se requiere una imagen para procesar" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader ?? '' } } }
    );

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY no configurada");
    }

    // Fetch user's envelopes (sobres) to use as categories - separate by type
    const { data: sobres } = await supabaseClient
      .from('sobres')
      .select('nombre, tipo');
    
    const gastoEnvelopes = sobres?.filter(s => s.tipo === 'gasto').map(s => s.nombre) || [];
    const ahorroEnvelopes = sobres?.filter(s => s.tipo === 'ahorro').map(s => s.nombre) || [];

    // Fetch user's learned category mappings
    const { data: mappings } = await supabaseClient
      .from('categoria_mappings')
      .select('descripcion_pattern, categoria');

    // Build learned mappings context
    let mappingsContext = '';
    if (mappings && mappings.length > 0) {
      mappingsContext = '\n\nMAPEOS APRENDIDOS (usar estos primero):\n' + 
        mappings.map(m => `- "${m.descripcion_pattern}" → ${m.categoria}`).join('\n');
    }

    // Build envelopes context
    let envelopesContext = '\n\nSOBRES DE GASTO (usar estos como categorías para GASTOS):\n';
    if (gastoEnvelopes.length > 0) {
      envelopesContext += gastoEnvelopes.join(', ');
    } else {
      envelopesContext += 'SUPER, GASOLINA, UBER, TRANSPORTE LEO, PASAJES VIC, NETFLIX, DISNEY, YOUTUBE, AMAZON, APPLE, XBOX, CFE, AGUA, BANORTE, ABOGADO, COLEGIATURA MAU, MTO ANGIE, MTO CARIOTA, MTO JARDINES, FARMACIA, RECARGAS CEL, SEGURO AUDI, ACEITE, ANTICONGELANTE, BEBBIA, ABIX, PROPINAS, OTRAS';
    }
    
    // Add savings envelopes context
    if (ahorroEnvelopes.length > 0) {
      envelopesContext += '\n\nSOBRES DE AHORRO (usar estos como categorías adicionales para INGRESOS destinados a ahorro):\n';
      envelopesContext += ahorroEnvelopes.join(', ');
    }

    // Get current date in Cancun timezone (CRITICAL: use Cancun time UTC-5, not UTC)
    const now = new Date();
    const cancunFormatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'America/Cancun',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    // This gives YYYY-MM-DD format in Cancun timezone
    const todayISO = cancunFormatter.format(now);
    const [currentYear] = todayISO.split('-');
    const cancunDate = new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Cancun',
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit'
    }).format(now);
    
    console.log("Fecha actual Cancún:", todayISO, "Hora UTC:", now.toISOString());

    const systemPrompt = `Eres un experto en analizar imágenes de tickets, recibos, estados de cuenta y notas de gastos en español.
Tu tarea es extraer TODAS las transacciones que puedas identificar en la imagen.

FECHA ACTUAL: ${todayISO} (Hoy es ${cancunDate}, año ${currentYear})

TIPOS DE IMÁGENES QUE PUEDES ANALIZAR:
- Tickets de compra (supermercado, tiendas, restaurantes)
- Estados de cuenta bancarios
- Recibos de servicios (luz, agua, gas, teléfono)
- Notas escritas a mano con gastos
- Capturas de pantalla de apps bancarias
- Facturas y comprobantes

Reglas de extracción:
1. FECHA: 
   - Busca la fecha en el ticket/recibo
   - Si no hay fecha visible, usa "${todayISO}"
   - Formato de salida: YYYY-MM-DD

2. MONTO: 
   - Extrae el monto total de cada transacción
   - Si hay múltiples productos, extrae el TOTAL
   - Ignora subtotales, impuestos separados si ya están en el total

3. TIPO:
   - La mayoría de tickets son GASTOS (type: "expense")
   - Solo marca como ingreso si es un depósito o reembolso

4. DESCRIPCIÓN: 
   - Nombre del comercio o concepto principal
   - Si es un ticket de supermercado, usa "Supermercado [nombre]"

5. MÉTODO DE PAGO:
   - Busca indicaciones: "TARJETA", "EFECTIVO", "DÉBITO", "CRÉDITO"
   - Si no se ve, usa "otro"

6. CATEGORÍA:
${envelopesContext}
${mappingsContext}

CATEGORÍAS DE INGRESOS (para depósitos/reembolsos):
- SUELDO, BONOS, VENTAS, REEMBOLSOS, INTERESES, REGALOS, OTROS INGRESOS
- Si el ingreso menciona "ahorro", "para ahorrar", o nombres de sobres de ahorro → usar el sobre de ahorro correspondiente

Si la imagen no contiene transacciones claras, devuelve un array vacío.
Extrae TODAS las transacciones que puedas identificar.`;

    console.log("Procesando imagen con Gemini 2.5 Pro (visión)");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: [
              {
                type: "text",
                text: "Analiza esta imagen y extrae todas las transacciones que puedas identificar. Devuelve un array JSON con: date (ISO 8601), amount (number), type ('income' o 'expense'), description (string), paymentMethod ('card', 'cash', o 'other'), categoria (string)."
              },
              {
                type: "image_url",
                image_url: {
                  url: image
                }
              }
            ]
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_transactions",
            description: "Extrae transacciones de la imagen",
            parameters: {
              type: "object",
              properties: {
                transactions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      date: { type: "string", description: "Fecha en formato ISO 8601" },
                      amount: { type: "number", description: "Monto como número decimal" },
                      type: { type: "string", enum: ["income", "expense"] },
                      description: { type: "string", description: "Descripción de la transacción" },
                      paymentMethod: { type: "string", enum: ["card", "cash", "other"] },
                      categoria: { type: "string", description: "Categoría de la transacción" }
                    },
                    required: ["date", "amount", "type", "description", "paymentMethod", "categoria"]
                  }
                }
              },
              required: ["transactions"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "extract_transactions" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de solicitudes excedido. Intenta más tarde." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Fondos insuficientes. Agrega créditos en Settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("Error de AI Gateway:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Error al procesar con IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      // Try to parse from content if no tool call
      console.log("No tool call found, checking content");
      return new Response(
        JSON.stringify({ transactions: [], error: "No se pudieron extraer transacciones de la imagen" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsedData = JSON.parse(toolCall.function.arguments);
    console.log("Transacciones extraídas de imagen:", parsedData.transactions?.length || 0);
    
    return new Response(
      JSON.stringify(parsedData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error en parse-image-transactions:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Error desconocido" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

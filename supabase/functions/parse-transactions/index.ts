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
    const { text } = await req.json();
    
    // Get authorization header for user context
    const authHeader = req.headers.get('Authorization');
    
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader ?? '' } } }
    );
    
    // Fetch user's learned category mappings
    const { data: mappings } = await supabaseClient
      .from('categoria_mappings')
      .select('descripcion_pattern, categoria');
    
    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: "Se requiere texto para procesar" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract balance markers
    const amanecimosMatch = text.match(/Amanecimos con[:\s]+(\d+(?:[.,]\d+)?)/i);
    const cerramosMatch = text.match(/Cerramos con[:\s]+(\d+(?:[.,]\d+)?)/i);
    
    const saldoInicial = amanecimosMatch ? parseFloat(amanecimosMatch[1].replace(',', '.')) : null;
    const cerramosCon = cerramosMatch ? parseFloat(cerramosMatch[1].replace(',', '.')) : null;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY no configurada");
    }

    // Fetch user's envelopes (sobres) to use as categories
    const { data: sobres } = await supabaseClient
      .from('sobres')
      .select('nombre');
    
    const envelopeNames = sobres?.map(s => s.nombre) || [];

    // Build learned mappings context
    let mappingsContext = '';
    if (mappings && mappings.length > 0) {
      mappingsContext = '\n\nMAPEOS APRENDIDOS (usar estos primero):\n' + 
        mappings.map(m => `- "${m.descripcion_pattern}" → ${m.categoria}`).join('\n');
    }

    // Build envelopes context
    let envelopesContext = '\n\nSOBRES DISPONIBLES (usar estos como categorías):\n';
    if (envelopeNames.length > 0) {
      envelopesContext += envelopeNames.join(', ');
    } else {
      envelopesContext += 'SUPER, GASOLINA, UBER, TRANSPORTE LEO, PASAJES VIC, NETFLIX, DISNEY, YOUTUBE, AMAZON, APPLE, XBOX, CFE, AGUA, BANORTE, ABOGADO, COLEGIATURA MAU, MTO ANGIE, MTO CARIOTA, MTO JARDINES, FARMACIA, RECARGAS CEL, SEGURO AUDI, ACEITE, ANTICONGELANTE, BEBBIA, ABIX, PROPINAS, OTRAS';
    }

    const systemPrompt = `Eres un experto en analizar transacciones financieras en español. 
Tu tarea es extraer información estructurada de entradas de texto libre.

Reglas de parseo:
1. FECHA: Si no hay fecha explícita, usa la fecha de hoy. Formatos: "dd/mm", "dd/mm/yyyy", "hoy", "ayer"
2. MONTO: Extrae números con o sin decimales. Acepta "," o "." como separador decimal. Normaliza a decimal con punto.
3. TIPO: Si empieza con "+" es ingreso. Si empieza con "-" es gasto. Si no hay signo, determina por contexto (sueldo, pago, etc = ingreso; compra, gasto, etc = gasto)
4. DESCRIPCIÓN: El concepto principal (café, supermercado, sueldo, etc)
5. MÉTODO DE PAGO: "tarjeta", "efectivo", u "otro". Si no se menciona, usa "otro"
6. CATEGORÍA: IMPORTANTE - Usa SOLO los nombres de sobres como categorías. Si la transacción no coincide con ningún sobre existente, usa el nombre más apropiado que pueda convertirse en un nuevo sobre.
${envelopesContext}
${mappingsContext}

REGLAS DE CATEGORIZACIÓN (mapear a sobres):
- "super", "walmart", "oxxo", "soriana", "chedraui", "costco", "bodega aurrera", "comida", "restaurante" → SUPER
- "uber", "didi", "taxi" → UBER
- "micro", "camión", "bus", "pasaje" → PASAJES VIC (para Vic) o TRANSPORTE LEO (para Leo)
- "gasolina", "pemex", "shell", "bp" → GASOLINA
- "farmacia", "medicina", "doctor" → FARMACIA
- "netflix" → NETFLIX
- "disney" → DISNEY
- "youtube", "youtube premium" → YOUTUBE
- "amazon" → AMAZON
- "apple", "app store", "icloud" → APPLE
- "xbox", "microsoft" → XBOX
- "luz", "cfe", "comisión federal" → CFE
- "agua", "sistema de aguas" → AGUA
- "banorte" → BANORTE
- "recarga", "tiempo aire", "telcel", "at&t" → RECARGAS CEL
- "seguro" → SEGURO AUDI
- "colegiatura", "escuela" → COLEGIATURA MAU
- "propina" → PROPINAS
- Si no coincide con ninguno → OTRAS

IMPORTANTE: 
- Ignora líneas que contengan "Amanecimos con" o "Cerramos con" ya que son marcadores de saldo, NO transacciones.
- Si una línea es ambigua o no se puede parsear con confianza, devuelve un error con sugerencia.

Responde SOLO con JSON válido, sin markdown.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: `Parsea las siguientes transacciones (una por línea):\n\n${text}\n\nDevuelve un array JSON con objetos que tengan: date (ISO 8601), amount (number), type ("income" o "expense"), description (string), paymentMethod ("card", "cash", o "other"). Si alguna línea es ambigua, incluye un objeto con error: true y suggestion (string con la corrección sugerida).` 
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "parse_transactions",
            description: "Extrae transacciones estructuradas del texto",
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
                      categoria: { type: "string", description: "Categoría de la transacción" },
                      error: { type: "boolean", description: "True si la línea es ambigua" },
                      suggestion: { type: "string", description: "Sugerencia de corrección si hay error" }
                    },
                    required: ["date", "amount", "type", "description", "paymentMethod", "categoria"]
                  }
                }
              },
              required: ["transactions"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "parse_transactions" } }
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
      throw new Error("No se recibió respuesta estructurada de IA");
    }

    const parsedData = JSON.parse(toolCall.function.arguments);
    
    return new Response(
      JSON.stringify({
        ...parsedData,
        saldoInicial,
        cerramosCon
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error en parse-transactions:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Error desconocido" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

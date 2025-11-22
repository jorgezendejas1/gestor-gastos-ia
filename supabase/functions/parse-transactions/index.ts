import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    
    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: "Se requiere texto para procesar" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY no configurada");
    }

    const systemPrompt = `Eres un experto en analizar transacciones financieras en español. 
Tu tarea es extraer información estructurada de entradas de texto libre.

Reglas de parseo:
1. FECHA: Si no hay fecha explícita, usa la fecha de hoy. Formatos: "dd/mm", "dd/mm/yyyy", "hoy", "ayer"
2. MONTO: Extrae números con o sin decimales. Acepta "," o "." como separador decimal. Normaliza a decimal con punto.
3. TIPO: Si empieza con "+" es ingreso. Si empieza con "-" es gasto. Si no hay signo, determina por contexto (sueldo, pago, etc = ingreso; compra, gasto, etc = gasto)
4. DESCRIPCIÓN: El concepto principal (café, supermercado, sueldo, etc)
5. MÉTODO DE PAGO: "tarjeta", "efectivo", u "otro". Si no se menciona, usa "otro"

IMPORTANTE: Si una línea es ambigua o no se puede parsear con confianza, devuelve un error con sugerencia.

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
                      error: { type: "boolean", description: "True si la línea es ambigua" },
                      suggestion: { type: "string", description: "Sugerencia de corrección si hay error" }
                    },
                    required: ["date", "amount", "type", "description", "paymentMethod"]
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
      JSON.stringify(parsedData),
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

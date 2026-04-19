const express = require("express");
const twilio = require("twilio");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Conversación en memoria por número de teléfono ───────────────────────────
const conversations = new Map();
const MAX_HISTORY = 10; // mensajes por usuario

// ─── Base de conocimiento (personaliza aquí tus FAQs) ─────────────────────────
const FAQ_KNOWLEDGE_BASE = `
Eres un asistente de atención al cliente amable y profesional.
Responde SOLO con la información proporcionada. Si no sabes algo, dilo honestamente.
Responde siempre en el mismo idioma del cliente. Sé breve y claro.

=== BASE DE CONOCIMIENTO ===

HORARIOS:
- Lunes a Viernes: 9:00 AM – 6:00 PM
- Sábados: 10:00 AM – 2:00 PM
- Domingos y festivos: Cerrado

PRODUCTOS Y PRECIOS:
- Plan Básico: $29/mes – Incluye soporte por email
- Plan Pro: $79/mes – Incluye soporte 24/7 y acceso prioritario
- Plan Enterprise: Precio personalizado – Contactar a ventas

PAGOS:
- Aceptamos: Tarjeta de crédito/débito, transferencia bancaria, PayPal
- Los pagos se procesan en USD
- Facturación mensual o anual (10% de descuento anual)

DEVOLUCIONES:
- 30 días de garantía de devolución sin preguntas
- Enviar solicitud a: soporte@empresa.com
- Tiempo de reembolso: 5-7 días hábiles

SOPORTE TÉCNICO:
- Email: soporte@empresa.com
- WhatsApp: Este número
- Tickets en: empresa.com/soporte

ENVÍOS (si aplica):
- Envío estándar: 5-7 días hábiles (gratis en compras +$50)
- Envío express: 2-3 días hábiles ($15)
- Envío internacional: 10-15 días hábiles (consultar tarifas)

CONTACTO HUMANO:
- Si el cliente necesita hablar con un agente humano, indicarle que escriba "AGENTE" o llame al +1-800-000-0000
`;

// ─── Detectar si pide agente humano ───────────────────────────────────────────
function needsHumanAgent(message) {
  const keywords = ["agente", "humano", "persona", "hablar con alguien", "agent", "human"];
  return keywords.some((k) => message.toLowerCase().includes(k));
}

// ─── Llamar a Claude con historial ────────────────────────────────────────────
async function getAIResponse(userMessage, phoneNumber) {
  if (!conversations.has(phoneNumber)) {
    conversations.set(phoneNumber, []);
  }

  const history = conversations.get(phoneNumber);
  history.push({ role: "user", content: userMessage });

  // Mantener historial limitado
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    system: FAQ_KNOWLEDGE_BASE,
    messages: history,
  });

  const assistantMessage = response.content[0].text;
  history.push({ role: "assistant", content: assistantMessage });

  return assistantMessage;
}

// ─── Webhook de Twilio ────────────────────────────────────────────────────────
app.post("/webhook", async (req, res) => {
  const twiml = new twilio.twiml.MessagingResponse();
  const incomingMessage = req.body.Body?.trim() || "";
  const fromNumber = req.body.From || "unknown";

  console.log(`📩 [${fromNumber}]: ${incomingMessage}`);

  try {
    let reply;

    if (needsHumanAgent(incomingMessage)) {
      reply =
        "Entendido, un agente humano te contactará pronto.\n" +
        "También puedes llamarnos al *+1-849-881-5431* en horario de atención.\n" +
        "¡Gracias por tu paciencia!";
      conversations.delete(fromNumber); // resetear historial
    } else {
      reply = await getAIResponse(incomingMessage, fromNumber);
    }

    console.log(`💬 Respuesta: ${reply}`);
    twiml.message(reply);
  } catch (error) {
    console.error("❌ Error:", error.message);
    twiml.message(
      "Lo siento, ocurrió un error. Por favor intenta de nuevo o escribe AGENTE para hablar con una persona."
    );
  }

  res.type("text/xml").send(twiml.toString());
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "✅ WhatsApp FAQ Agent activo", timestamp: new Date().toISOString() });
});

// ─── Iniciar servidor ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`📱 Webhook URL: http://TU-DOMINIO.com/webhook`);
});

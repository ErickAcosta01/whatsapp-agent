{
  "name": "whatsapp-faq-agent",
  "version": "1.0.0",
  "description": "Agente de IA para responder FAQs en WhatsApp via Twilio + Claude",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "express": "^4.18.2",
    "twilio": "^5.3.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}

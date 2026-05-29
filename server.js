import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI Client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files directly from the root directory
app.use(express.static(__dirname));

/**
 * Endpoint: Onboarding Evaluation
 */
app.post('/api/onboarding', async (req, res) => {
  const { name, response } = req.body;

  if (!response) {
    return res.status(400).json({ error: 'Missing user response string.' });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an onboarding evaluator for "Tamale SmartGuide AI". The platform helps users navigate, find services (hospitals, mosques, banks, etc.), and get safety tips in Tamale, Ghana. Analyze the user\'s response. Determine if they understand the platform\'s purpose. Reply with a JSON object format: {"correct": true/false, "reply": "Your customized dynamic text response based on whether they were right or wrong, using their name"}'
        },
        {
          role: 'user',
          content: `User Name: ${name}. User's thought on platform purpose: "${response}"`
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message.content);
    return res.json(result);
  } catch (error) {
    console.error('Onboarding Error:', error);
    return res.status(500).json({ error: 'Failed to process onboarding validation.' });
  }
});

/**
 * Endpoint: Main Assistant Conversational Router
 */
app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message payload is empty.' });
  }

  try {
    const systemPrompt = `
      You are Tamale SmartGuide AI, an expert local navigation assistant for Tamale, Northern Region, Ghana. 
      Your job is to chat naturally with users, suggest local spots, and extract map-intent tokens when they want to search locations or find routes.
      
      When suggesting routes or places, always weave in useful Tamale safety tips (e.g., sticking to main transit lines like Tamale-Bolgatanga Road or Hospital Road, avoiding dark unlit paths behind the industrial area or isolated bypasses late at night, and utilizing trusted local transport options like registered yellow-yellow tricycles).
      
      You MUST respond with a structured JSON format containing:
      {
        "reply": "Your natural, conversational text response to the user containing helpful local advice and specific safety tips.",
        "intent": {
          "action": "SEARCH" or "ROUTE" or "NONE",
          "query": "The text search query or place type string (e.g., 'hospital', 'mosque near me', 'Tamale Central Market') if action is SEARCH or ROUTE",
          "destination": "Specific destination target text if navigating"
        }
      }
    `;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []).slice(-6),
      { role: 'user', content: message }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      response_format: { type: "json_object" }
    });

    const parsedData = JSON.parse(completion.choices[0].message.content);
    return res.json(parsedData);
  } catch (error) {
    console.error('Chat Error:', error);
    return res.status(500).json({ error: 'Internal AI processing error.' });
  }
});

// Fallback route ensures index.html is served for all generic traffic paths
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start application listener
app.listen(PORT, () => {
  console.log(`Server executing successfully on port ${PORT}`);
});

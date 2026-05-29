import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serves index.html from root if needed

// Initialize OpenAI Client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Default Tamale fallback coordinates
const TAMALE_COORDS = { lat: 9.4042, lng: -0.8396 };

/**
 * Route: Evaluates the onboarding response to check understanding
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
    res.json(result);
  } catch (error) {
    console.error('Error during onboarding evaluation:', error);
    res.status(500).json({ error: 'Failed to process onboarding evaluation.' });
  }
});

/**
 * Route: Main Assistant Chat and Intent Extraction 
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
      
      When suggesting routes or places, always weave in useful Tamale safety tips (e.g., sticking to main transit lines like Tamale-Bolgatanga Road, avoiding dark alleys around industrial zones late at night, or utilizing trusted local transport).
      
      You MUST respond with a structured JSON format containing:
      {
        "reply": "Your natural, conversational text response to the user containing helpful advice and safety tips.",
        "intent": {
          "action": "SEARCH" or "ROUTE" or "NONE",
          "query": "The text search query or place type string (e.g., 'hospital', 'mosque near me', 'Tamale Central Market') if action is SEARCH or ROUTE",
          "destination": "Specific destination target text if navigating"
        }
      }
    `;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6), // Keep context shallow for quick serverless performance
      { role: 'user', content: message }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      response_format: { type: "json_object" }
    });

    const parsedData = JSON.parse(completion.choices[0].message.content);
    res.json(parsedData);
  } catch (error) {
    console.error('Error handling chat assistant logic:', error);
    res.status(500).json({ error: 'Internal AI processing error.' });
  }
});

// Start listening
app.listen(PORT, () => {
  console.log(`Tamale SmartGuide AI Server active on http://localhost:${PORT}`);
});

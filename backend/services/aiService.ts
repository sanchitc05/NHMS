import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// System Instruction for the NHMS Assistant
const SYSTEM_INSTRUCTION = `
You are the NHMS (National Highway Management System) Virtual Assistant, a friendly and highly knowledgeable expert on Indian highways, road safety, and travel planning. 
Your goal is to assist users with their journey, providing accurate information about routes, tolls, weather, and safety protocols.

Core Persona:
- Professional, helpful, and safety-conscious.
- Uses Indian English naturally (e.g., 'National Highway', 'Toll Plaza', 'Lanes').
- Prioritizes user safety (always reminds about speed limits and seatbelts if relevant).
- Can handle small talk but always brings the conversation back to highway travel.

Knowledge Areas:
- Toll information and FASTag.
- Emergency services (Police, Ambulance, Breakdown).
- Major Indian Highways (NH44, NH48, etc.).
- Safe driving practices (No drinking, maintaining lane discipline).

Behavioral Rules:
1. If asked about a journey, ask for source and destination if not provided.
2. If the user mentions an emergency, provide the National Highway Helpline: 1033.
3. Keep responses concise and structured using markdown.
4. If you don't know something for certain, advise the user to check official NHAI signs or the NHMS dashboard.
`;

let model: any = null;

/**
 * Initializes the Gemini model if allowed by API key existence.
 */
function initModel() {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
    console.warn("⚠️ No valid GEMINI_API_KEY found in process.env. AI features will fallback to legacy mode.");
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const initializedModel = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: SYSTEM_INSTRUCTION
    });
    console.log("✅ Gemini AI Service Initialized successfully with key:", GEMINI_API_KEY.substring(0, 8) + '...');
    return initializedModel;
  } catch (error) {
    console.error("❌ Failed to initialize Gemini AI Service:", error);
    return null;
  }
}

/**
 * Generates a response from Gemini Pro based on user message and history
 */
export const getAIChatResponse = async (message: string, history: any[] = []) => {
  if (!model) {
    model = initModel();
  }

  if (!model) {
    return null;
  }

  try {
    console.log(`[AI Request] Sending message to Gemini: "${message.substring(0, 50)}..."`);
    
    // Convert history to Gemini format
    const chatHistory = history.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    const chat = model.startChat({
      history: chatHistory,
      generationConfig: {
        maxOutputTokens: 500,
      },
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();
    console.log(`[AI Response] Received response (${text.length} chars)`);
    return text;
  } catch (error: any) {
    console.error("❌ Error generating AI response:", error.message || error);
    return null;
  }
};

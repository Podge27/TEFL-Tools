const { GoogleGenerativeAI } = require('@google/generative-ai');

exports.handler = async function(event, context) {
    // 1. The Polite Doorway (CORS)
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };

    // 2. The Empty Envelope Safety Net
    let inputData;
    try {
        inputData = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON body or empty request." }) };
    }

    const { topic = "General English", level = "B2", type = "Grammar" } = inputData;
    const API_KEY = process.env.GEMINI_API_KEY;

    if (!API_KEY) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: "API Key is missing." }) };
    }

    // --- CEFR NUANCE (Unchanged) ---
    let toneInstruction = "";
    switch (level) {
        case 'kids':
            toneInstruction = "TARGET: Young ESL Learners (A1 Level). Use extremely basic vocabulary (animals, colors, numbers). Use short, simple sentences. Use emojis (🐶) to make it fun but only at the end of sentences. AVOID complex grammar.";
            break;
        case 'A1':
            toneInstruction = "TARGET: Adult/Teen Beginners (CEFR A1). Use basic phrases, high-frequency vocabulary, and simple sentence structures. No idioms.";
            break;
        case 'A2':
            toneInstruction = "TARGET: Elementary Learners (CEFR A2). Use simple everyday language. Sentences should be direct.";
            break;
        case 'B1':
            toneInstruction = "TARGET: Intermediate Learners (CEFR B1). Use standard English with some variation in sentence structure. Topics can be descriptive.";
            break;
        case 'B2':
            toneInstruction = "TARGET: Upper Intermediate (CEFR B2). Use a wider range of vocabulary and some abstract ideas.";
            break;
        case 'C1':
        case 'C2':
            toneInstruction = "TARGET: Advanced/Proficiency (CEFR C1/C2). Use sophisticated vocabulary, idioms, nuances, and complex grammatical structures.";
            break;
        default:
            toneInstruction = "TARGET: Intermediate English Learners.";
    }

    // --- SYSTEM PROMPT (Unchanged) ---
    const systemPrompt = `
    You are an expert ESL/EFL Teacher creating a quiz for Spanish students.
    Create a ${type} quiz for level ${level} about: "${topic}".
    Write in British English.
    
    INSTRUCTIONS: ${toneInstruction}
    
    JSON RULES:
    1. Output ONLY valid JSON.
    2. "answer" must be the NUMBER index of the correct option (0, 1, 2, or 3).
    3. "questions" must have exactly 6 items.
    4. "title" must be DESCRIPTIVE and ACADEMIC (e.g. "Present Perfect vs Past Simple"). Do NOT use puns or "fun" titles.
    
    OUTPUT STRUCTURE:
    {
      "title": "Descriptive Academic Title",
      "category": "${type}",
      "level": "${level}",
      "topic": "${topic}",
      "questions": [
        {
          "text": "Question text?",
          "options": ["A", "B", "C", "D"],
          "answer": 0,
          "explanation": "Simple explanation of why."
        }
      ]
    }
    `;

    // 3. THE UPGRADED CONNECTION ENGINE
    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash", 
            generationConfig: { 
                responseMimeType: "application/json" // The strict JSON lock
            } 
        });

        const result = await model.generateContent(systemPrompt);
        
        // Final cleanup just in case
        const cleanText = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        
        return { statusCode: 200, headers, body: cleanText };

    } catch (error) {
        console.error("Quiz Generator Error:", error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: "Failed to generate the quiz. Please try again." }) };
    }
};
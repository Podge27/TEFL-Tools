const https = require('https');

exports.handler = async function(event, context) {
    // 1. Basic Validation
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    let data;
    try {
        data = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
    }

    const { topic, level, type } = data;
    const API_KEY = process.env.GEMINI_API_KEY;

    // --- 2. YOUR CEFR NUANCE LOGIC (Preserved) ---
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

    // --- 3. SYSTEM PROMPT (Hybrid: Nuance + Strict Rules) ---
    const systemPrompt = `
    You are an expert ESL/EFL Teacher creating a quiz for Spanish students.
    Create a ${type} quiz for level ${level} about: "${topic}".
    
    TONE INSTRUCTIONS: ${toneInstruction}
    
    CRITICAL RULES:
    1. Output ONLY valid JSON. No Markdown, no backticks.
    2. "answer" must be the NUMBER index (0-3).
    3. "questions" must have exactly 6 items.
    4. **TITLE RULE:** The "title" must be DESCRIPTIVE and ACADEMIC (e.g., "Present Perfect Usage", "Space Vocabulary"). Do NOT use puns, jokes, or "fun" titles like "Space Odyssey Fun".
    
    OUTPUT STRUCTURE:
    {
      "title": "Descriptive Title Here",
      "category": "${type}",
      "level": "${level}",
      "topic": "${topic}",
      "questions": [
        {
          "text": "Question text?",
          "options": ["A", "B", "C", "D"],
          "answer": 0,
          "explanation": "Simple explanation."
        }
      ]
    }
    `;

    // --- 4. CALL GEMINI (Using Native HTTPS - Crash Proof) ---
    const requestBody = JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }]
    });

    const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`, // Using Flash for speed
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestBody)
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => responseBody += chunk);
            
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(responseBody);
                        
                        // Gemini Response Parsing
                        if (!parsed.candidates || parsed.candidates.length === 0) {
                            throw new Error("Gemini returned no candidates.");
                        }

                        let rawText = parsed.candidates[0].content.parts[0].text;
                        // Clean Markdown
                        rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
                        
                        resolve({
                            statusCode: 200,
                            body: rawText
                        });

                    } catch (error) {
                        resolve({
                            statusCode: 500,
                            body: JSON.stringify({ error: "Failed to parse Gemini response", details: error.message })
                        });
                    }
                } else {
                    resolve({
                        statusCode: res.statusCode,
                        body: JSON.stringify({ error: "Gemini API Error", details: responseBody })
                    });
                }
            });
        });

        req.on('error', (e) => {
            resolve({ statusCode: 500, body: JSON.stringify({ error: "Network Error", details: e.message }) });
        });

        req.write(requestBody);
        req.end();
    });
};
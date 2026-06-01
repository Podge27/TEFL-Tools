const https = require('https');

exports.handler = async function(event, context) {
    // 1. The Polite Doorway (CORS)
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

    let inputData;
    try {
        inputData = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON input" }) };
    }
    
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: "API Key missing." }) };

    // 2. Catching the data from your new frontend
    const LEVEL = inputData.level || "B2";
    const AGE_GROUP = inputData.ageGroup || "Adults";
    const TOPIC = inputData.topic || "General Conversation";
    const GRAMMAR_VOCAB = inputData.grammarVocab || "None specified";
    const QUANTITY = inputData.quantity || 5;

    // 3. Building the Prompt for Conversation Questions
    let fullPrompt = `You are an expert ESOL materials creator designing conversation questions for Spanish students learning English. Write in British English.
    
    PARAMETERS:
    - Level: ${LEVEL}
    - Age Group: ${AGE_GROUP}
    - Topic: "${TOPIC}"
    - Target Grammar/Vocabulary: "${GRAMMAR_VOCAB}"
    - Number of questions: ${QUANTITY}
    
    INSTRUCTIONS:
    1. Create exactly ${QUANTITY} engaging, age-appropriate conversation questions.
    2. The language and complexity must strictly match the ${LEVEL} level.
    3. Ensure the questions feel natural, but avoid phrasing that translates too perfectly from Spanish. Force the students to use distinctly English structures to answer.
    4. Incorporate the requested grammar/vocabulary naturally into the questions if provided.
    
    JSON OUTPUT RULES:
    Output ONLY a valid JSON object with a single key "questions" containing an array of strings. Do not include markdown formatting.
    Format:
    {
      "questions": [
        "First question here?",
        "Second question here?"
      ]
    }`;

    // 4. The Unbreakable HTTPS Connection
    const requestBody = JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: {
            maxOutputTokens: 1500,
            temperature: 0.7,
            responseMimeType: "application/json" 
        }
    });

    const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestBody)
        }
    };

    return new Promise((resolve) => {
        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => responseBody += chunk);
            
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const apiResponse = JSON.parse(responseBody);
                        if (!apiResponse.candidates || apiResponse.candidates.length === 0) {
                            return resolve({ statusCode: 500, headers, body: JSON.stringify({ error: "Gemini replied but gave no text." }) });
                        }
                        
                        let rawText = apiResponse.candidates[0].content.parts[0].text;
                        resolve({ statusCode: 200, headers, body: rawText });

                    } catch (error) {
                        resolve({ statusCode: 500, headers, body: JSON.stringify({ error: "Failed to parse Gemini response" }) });
                    }
                } else {
                    resolve({ statusCode: res.statusCode, headers, body: JSON.stringify({ error: "API Error" }) });
                }
            });
        });

        req.on('error', (e) => {
            resolve({ statusCode: 500, headers, body: JSON.stringify({ error: "Network Error" }) });
        });

        req.write(requestBody);
        req.end();
    });
};
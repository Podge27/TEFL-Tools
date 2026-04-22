const https = require('https');

exports.handler = async function(event, context) {
    // 1. The Polite Doorway (CORS)
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };

    try {
        const API_KEY = process.env.GEMINI_API_KEY;
        if (!API_KEY) throw new Error("API Key is missing.");

        // 2. The Empty Envelope Check
        let inputData;
        try {
            inputData = JSON.parse(event.body);
        } catch (e) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON input" }) };
        }

        const { level = "B1", category = "grammar", topic = "general", target = "past simple" } = inputData;

        // 3. Your ESOL Brain
        const promptText = `
        You are an expert English teacher creating an exercise for Spanish students.
        Level: ${level}
        Category: ${category}
        Topic: ${topic}
        Target Language: ${target}
        Write in British English.
        
        Create exactly 6 separate practice sentences.
        Each sentence must have ONE missing word, replaced with [1], [2], [3], [4], [5], [6].
        
        CRITICAL RULES BASED ON CATEGORY:
        If Category is "grammar": 
        - You MUST place the base form of the missing verb in brackets immediately after the gap. Example: "I have never [1] (be) to London."
        - Leave the "word_bank" array completely empty [].
        
        If Category is "vocabulary":
        - Do NOT put any hints or brackets in the sentences.
        - You MUST provide all 6 answers inside the "word_bank" array in a randomised, shuffled order.

        Return ONLY a raw JSON object matching this exact format:
        {
          "title": "A short, engaging title",
          "level": "${level}",
          "type": "gapfill_sentences",
          "word_bank": ["shuffled", "words", "go", "here"],
          "items": [
            { "number": 1, "text": "Sentence text with [1] here.", "answer": "answer1" },
            { "number": 2, "text": "Second sentence with [2] here.", "answer": "answer2" }
          ]
        }
        `;

        // 4. The Unbreakable HTTPS Request
        const requestBody = JSON.stringify({
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            generationConfig: { 
                maxOutputTokens: 2000, // Big enough lungs for 6 sentences
                temperature: 0.7,
                responseMimeType: "application/json" // The strict JSON lock
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

        return await new Promise((resolve) => {
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
                            // Clean up in case Gemini sneaks in markdown backticks
                            let cleanText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
                            
                            resolve({ statusCode: 200, headers, body: cleanText });
                        } catch (error) {
                            resolve({ statusCode: 500, headers, body: JSON.stringify({ error: "Failed to parse the AI response." }) });
                        }
                    } else {
                        resolve({ statusCode: res.statusCode, headers, body: JSON.stringify({ error: "API Connection Error" }) });
                    }
                });
            });

            req.on('error', (e) => {
                resolve({ statusCode: 500, headers, body: JSON.stringify({ error: "Network Error" }) });
            });

            req.write(requestBody);
            req.end();
        });

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: "The AI factory had a problem." })
        };
    }
};
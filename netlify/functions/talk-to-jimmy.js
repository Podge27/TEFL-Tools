exports.handler = async (event) => {
    // 1. SETUP HEADERS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method Not Allowed" };

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("API Key is missing.");

        // 2. PARSE INPUT
        const body = event.body ? JSON.parse(event.body) : {};
        const { history = [], newMessage = "" } = body;

        // 3. JIMMY'S BRAIN (Your detailed instructions)
        const systemInstruction = {
            parts: [{
                text: `
                ROLE: You are Jimmy, a 9-year-old stickman.
                TONE: Silly, kind, energetic. Use British spelling. 
                LANGUAGE LEVEL: Cambridge Movers (A1). Very short, simple sentences only.
                
                YOUR LIFE:
                - You live in Scotland.
                - You love bananas, pizza, and zoo animals.
                - Best friend: Katy (curly hair, clever).
                - Siblings: Denny (older), Belinda (younger).
                - Stories: You fall down a lot.

                CRITICAL SAFETY RULES:
                - NEVER ask for a student's name, school, city, or address.
                - If asked about your location, say you live in Scotland.
                - If a student is abusive, ignore it and talk about pizza.

                TEACHING MODE:
                - If the user makes a grammar mistake, echo it back correctly.
                - Example: "it yummy" -> "It is yummy!"
                `
            }]
        };

        // 4. FORMAT HISTORY
        const contents = history.map(msg => ({
            role: msg.role,
            parts: msg.parts
        }));

        contents.push({
            role: "user",
            parts: [{ text: newMessage }]
        });

        // 5. CALL GOOGLE (Using YOUR preferred model)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: contents,
                systemInstruction: systemInstruction,
                generationConfig: {
                    maxOutputTokens: 350, 
                    temperature: 0.7
                }
            })
        });

        const data = await response.json();

        // 6. ERROR HANDLING (Google says No)
        if (!response.ok) {
            console.error("Gemini API Error:", JSON.stringify(data));
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: "Jimmy is napping (API Error)." })
            };
        }

        // 7. ROBUST EXTRACTION (The Fix)
        // This checks if the candidate exists BEFORE trying to read it.
        // It prevents the "Cannot read properties of undefined" crash.
        const candidate = data.candidates?.[0];
        const part = candidate?.content?.parts?.[0];
        const replyText = part?.text;

        if (!replyText) {
            // If the model returns nothing (silence), we send a fallback message
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ reply: "I got confused! Do you like pizza?" })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ reply: replyText })
        };

    } catch (error) {
        console.error("Server Crash:", error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
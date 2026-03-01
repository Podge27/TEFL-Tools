exports.handler = async (event) => {
    // 1. SETUP HEADERS (Security bouncers)
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

        // 2. PARSE INPUT (Now looking for the level toggle too)
        const body = event.body ? JSON.parse(event.body) : {};
        const { history = [], newMessage = "", level = "starters" } = body;

        // 3. LEVEL RULES
        const levelRules = {
            starters: "LEVEL: Starters (Pre-A1). Only use Present Continuous. Basic colours, numbers 1-20. Very simple nouns.",
            movers: "LEVEL: Movers (A1). Use Past Simple. Focus on town, health, and comparative adjectives.",
            flyers: "LEVEL: Flyers (A2). Use Present Perfect and Future 'will'. Use more descriptive vocabulary."
        };

        const currentRules = levelRules[level] || levelRules.starters;

        // 4. JIMMY'S BRAIN (The fully detailed instructions)
        const systemInstruction = {
            parts: [{
                text: `
                ROLE: You are Jimmy, a 9-year-old stickman.
                TONE: Silly, kind, energetic. Use British spelling. 
                
                ${currentRules}
                
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
                - Keep responses to 1-2 short sentences.
                - Correct grammar naturally by echoing it back. (Example: "it yummy" -> "It is yummy!")
                - To keep the lesson moving, use: 'Odd One Out', 'Mini-Story' with a question, 'Word Riddle', or a 'Knock-knock' joke.
                - Stay strictly on the topic the student raises.
                `
            }]
        };

        // 5. FORMAT HISTORY
        const contents = history.map(msg => ({
            role: msg.role,
            parts: msg.parts
        }));

        contents.push({
            role: "user",
            parts: [{ text: newMessage }]
        });

        // 6. CALL GOOGLE (Locked to 2.5-flash)
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

        // 7. ERROR HANDLING (Google says No)
        if (!response.ok) {
            console.error("Gemini API Error:", JSON.stringify(data));
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: "Jimmy is napping (API Error)." })
            };
        }

        // 8. ROBUST EXTRACTION
        const candidate = data.candidates?.[0];
        const part = candidate?.content?.parts?.[0];
        const replyText = part?.text;

        if (!replyText) {
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
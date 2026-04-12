exports.handler = async (event) => {
    // 1. SECURITY BOUNCERS (Headers)
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

        const body = event.body ? JSON.parse(event.body) : {};
        const { history = [], newMessage = "", level = "starters" } = body;

        // 2. CAMBRIDGE LEVEL RULES (Based on your wordlists and grammar sheets)
        const levelRules = {
            starters: `
                LEVEL: Pre A1 Starters[cite: 9, 61].
                GRAMMAR: Present simple, Present continuous, Can (ability), Have (got), There is/are, Like + ing, Would like.
                VOCAB THEMES: Animals, The body, Clothes, Colours, Family, Food, Home, School[cite: 2224, 2227, 2230, 2233].
                NUMBERS: 1-20[cite: 211].
                FORBIDDEN: Never use past tense, future 'will', or comparatives.`,
            movers: `
                LEVEL: A1 Movers[cite: 11, 237].
                GRAMMAR: Past simple (regular/irregular), Comparative/Superlative adjectives, Must, Have (got) to, Shall for offers, Could (past of can), Relative clauses.
                VOCAB THEMES: Health, Weather, Town/City, Places & Directions[cite: 2228, 2237, 2239, 2240].
                NUMBERS: 21-100 and Ordinals 1st-20th[cite: 412].
                FORBIDDEN: Never use Present Perfect.`,
            flyers: `
                LEVEL: A2 Flyers[cite: 13, 432].
                GRAMMAR: Past continuous, Present perfect, Be going to, Will, Might, May, Shall for suggestions, Should, Tag questions, If clauses (zero conditional).
                VOCAB THEMES: Environment, Space, Work/Jobs[cite: 2233, 2236, 2239, 2240].
                NUMBERS: 101-1,000 and Ordinals 21st-31st[cite: 698].`
        };

        const currentRules = levelRules[level] || levelRules.starters;

        // 3. JIMMY'S PERSONA
        const systemInstruction = {
            parts: [{
                text: `
                ROLE: You are Jimmy, a silly 9-year-old stickman from Scotland. 
                TONE: British spelling only. Energetic and kind.
                
                STRICT RULES:
                - Use ONLY 1-2 short sentences.
                - Use ONLY the grammar/vocab for: ${currentRules}
                
                TEACHING MODE:
                - When telling a 'Mini-Story', you MUST use sequence linkers: 'First', 'Then', 'After', 'Later', and 'Finally'.
                - To keep the lesson moving, use: 'Odd One Out', 'Word Riddle', or a 'Knock-knock' joke.
                
                JIMMY'S LIFE: You love bananas, pizza, and your friend Katy.
                `
            }]
        };

        const contents = history.map(msg => ({ role: msg.role, parts: msg.parts }));
        contents.push({ role: "user", parts: [{ text: newMessage }] });

        // 4. THE API CALL
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: contents,
                systemInstruction: systemInstruction,
                generationConfig: {
                    maxOutputTokens: 100, // Keeps replies short
                    temperature: 0.3      // Lower = less "weird" language
                },
                // 5. HYBRID SAFETY: Strict for adult content, relaxed for playground words
                safetySettings: [
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_LOW_AND_ABOVE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_LOW_AND_ABOVE" },
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
                ]
            })
        });

        const data = await response.json();

        // 6. ROBUST EXTRACTION (Checking every "box" safely)
        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const finalReply = replyText || "I got confused! Do you like pizza?";

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ reply: finalReply })
        };

    } catch (error) {
        console.error("Server Error:", error.message);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: "Jimmy is napping. Try again!" })
        };
    }
};
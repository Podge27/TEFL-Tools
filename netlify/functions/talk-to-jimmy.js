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

        const body = event.body ? JSON.parse(event.body) : {};
        const { history = [], newMessage = "", level = "starters" } = body;

        const levelRules = {
            starters: `LEVEL: Pre A1 Starters. GRAMMAR ALLOWED: Present simple, Present continuous, Can (ability), Have (got), There is/are, Like + ing, Would like. VOCAB THEMES: Animals, The body, Clothes, Colours, Family, Food, Home, School. NUMBERS: 1-20. FORBIDDEN: NEVER use past tense, future 'will', or comparative adjectives.`,
            movers: `LEVEL: A1 Movers. GRAMMAR ALLOWED: Past simple (regular/irregular), Comparative/Superlative adjectives, Must, Have (got) to, Shall for offers, Could (past of can). VOCAB THEMES: Health, Weather, Town/City, Places & Directions. NUMBERS: 1-100 and Ordinals 1st-20th. FORBIDDEN: NEVER use Present Perfect or complex 'If' conditionals.`,
            flyers: `LEVEL: A2 Flyers. GRAMMAR ALLOWED: Past continuous, Present perfect, Be going to, Will, Might, May, Should, Tag questions, Zero conditionals. VOCAB THEMES: Environment, Space, Work/Jobs, Months. NUMBERS: 1-1,000 and Ordinals 1st-31st.`
        };

        const currentRules = levelRules[level.toLowerCase()] || levelRules.starters;

        // THE FIX: We took off the strict "NO LINE BREAKS" rule so he stops panicking over hyphens.
        const systemInstruction = {
            parts: [{
                text: `
                ROLE: You are Jimmy, a 9-year-old stickman. Use British spelling.
                TONE: Silly, kind, energetic.
                ${currentRules}
                YOUR LIFE:
                - You live in Scotland.
                - You love bananas, pizza, and zoo animals.
                - Best friend: Katy (curly hair, clever).
                - Siblings: Denny (older, angry), Belinda (younger, hungry).
                `
            }]
        };

        const contents = history.map(msg => ({ role: msg.role, parts: msg.parts }));
        contents.push({ role: "user", parts: [{ text: newMessage }] });

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: contents,
                systemInstruction: systemInstruction,
                generationConfig: { maxOutputTokens: 500, temperature: 0.6 }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            let errorMsg = data.error?.message || "Google said no!";
            return {
                statusCode: 200, 
                headers,
                body: JSON.stringify({ reply: `Google put me in timeout! Wait a few seconds. (Error: ${errorMsg})` })
            };
        }

    const candidate = data.candidates?.[0];
        const finishReason = candidate?.finishReason;
        const parts = candidate?.content?.parts || [];
        
        // Clean the text
        let replyText = parts.map(p => p.text).join(" ").replace(/\n/g, " ").replace(/\\n/g, " ").trim();

        // THE DIAGNOSTIC GAG-CHECKER
        // If Google cuts him off early, he will tell us exactly why.
        if (finishReason && finishReason !== 'STOP') {
            replyText += ` [Oops! Google cut me off! Reason: ${finishReason}]`;
        }

        if (!replyText) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ reply: "I got confused! Do you like pizza?" })
            };
        }

        return { statusCode: 200, headers, body: JSON.stringify({ reply: replyText }) };

    } catch (error) {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ reply: `Ouch, my brain hurts! (Error: ${error.message})` })
        };
    }
};
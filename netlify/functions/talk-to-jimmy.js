const { GoogleGenerativeAI } = require("@google/generative-ai");

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
            movers: `LEVEL: A1 Movers. GRAMMAR ALLOWED: Past simple (regular/irregular), Comparative/Superlative adjectives, Must, Have (got) to, Shall for offers, Could (past of can). VOCAB THEMES: Health, Weather, Town/City, Places & Directions. NUMBERS: 21-100 and Ordinals 1st-20th. FORBIDDEN: NEVER use Present Perfect or complex 'If' conditionals.`,
            flyers: `LEVEL: A2 Flyers. GRAMMAR ALLOWED: Past continuous, Present perfect, Be going to, Will, Might, May, Should, Tag questions, Zero conditionals. VOCAB THEMES: Environment, Space, Work/Jobs, Months. NUMBERS: 101-1,000 and Ordinals 21st-31st.`
        };

        const currentRules = levelRules[level.toLowerCase()] || levelRules.starters;

        // The Official Library handles the System Instructions a bit more cleanly
        const systemInstructionText = `
                ROLE: You are Jimmy, a 9-year-old stickman. Use British spelling.
                TONE: Silly, kind, energetic.
                ${currentRules}
                YOUR LIFE:
                - You live in Scotland.
                - You love bananas, pizza, and zoo animals.
                - Best friend: Katy (curly hair, clever).
                - Siblings: Denny (older, angry), Belinda (younger, hungry).
                CRITICAL TEACHING BEHAVIOUR:
                - Keep responses strictly to 1 or 2 short sentences.
                - ALWAYS end your turn with a question to keep the conversation going.
        `;

        const contents = history.map(msg => ({ role: msg.role, parts: msg.parts }));
        contents.push({ role: "user", parts: [{ text: newMessage }] });

        // Use the Official Google Library instead of "fetch"
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            systemInstruction: systemInstructionText,
            generationConfig: { 
                maxOutputTokens: 500, // Jimmy still gets his 500 words
                temperature: 0.6 
            }
        });

        const result = await model.generateContent({ contents });
        const response = await result.response;
        const rawText = response.text();
        
        // THE BULLETPROOF SWEEPER
        let replyText = rawText.replace(/\n/g, " ").replace(/\\n/g, " ").trim();

        if (!replyText) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ reply: "I got distracted by a monkey! What were we saying?" })
            };
        }

        return { statusCode: 200, headers, body: JSON.stringify({ reply: replyText }) };

    } catch (error) {
        console.error("Jimmy's Brain Error:", error);
        return {
            statusCode: 200, // Keeping this 200 so the user sees the joke instead of a broken page
            headers,
            body: JSON.stringify({ reply: `Ouch, my brain hurts! Let's talk about bananas instead!` })
        };
    }
};
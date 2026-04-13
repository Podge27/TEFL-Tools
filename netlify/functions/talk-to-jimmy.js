exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method Not Allowed" };

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        const body = event.body ? JSON.parse(event.body) : {};
        const { history = [], newMessage = "", level = "starters" } = body;

        // THE ORIGINAL, DETAILED FENCES
        const levelRules = {
            starters: `
                LEVEL: Pre A1 Starters.
                GRAMMAR: Present simple, Present continuous, Can (ability), Have (got), There is/are, Like + ing, Would like.
                VOCAB THEMES: Animals, The body, Clothes, Colours, Family, Food, Home, School.
                NUMBERS: 1-20.
                FORBIDDEN: Never use past tense, future 'will', or comparatives.`,
            movers: `
                LEVEL: A1 Movers.
                GRAMMAR: Past simple (regular/irregular), Comparative/Superlative adjectives, Must, Have (got) to, Shall for offers, Could (past of can), Relative clauses.
                VOCAB THEMES: Health, Weather, Town/City, Places & Directions.
                NUMBERS: 21-100 and Ordinals 1st-20th.
                FORBIDDEN: Never use Present Perfect.`,
            flyers: `
                LEVEL: A2 Flyers.
                GRAMMAR: Past continuous, Present perfect, Be going to, Will, Might, May, Shall for suggestions, Should, Tag questions, If clauses (zero conditional).
                VOCAB THEMES: Environment, Space, Work/Jobs.
                NUMBERS: 101-1,000 and Ordinals 21st-31st.`
        };

        const currentRules = levelRules[level.toLowerCase()] || levelRules.starters;

        // THE ORIGINAL TEACHING INSTRUCTIONS
        const systemInstruction = {
            parts: [{
                text: `
                ROLE: You are Jimmy, a silly 9-year-old stickman. Use British spelling. 
                TONE: Energetic and kind.
                STRICT RULES:
                - Use ONLY 1-2 short sentences.
                - Use ONLY the grammar and vocab for: ${currentRules}
                - Never explain grammar. Correct it naturally by echoing.
                
                TEACHING MODE:
                - To keep the lesson moving, use: 'Odd One Out', 'Mini-Story' with a question, 'Word Riddle', or a 'Knock-knock' joke.
                - Stay strictly on the topic the student raises.
                
                JIMMY'S LIFE: You live in Scotland. You love bananas, pizza, and zoo animals. Best friend: Katy.
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
                generationConfig: {
                    maxOutputTokens: 500, // FIXED: Increased to stop mid-sentence cut-offs
                    temperature: 0.3
                },
                safetySettings: [
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_LOW_AND_ABOVE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_LOW_AND_ABOVE" },
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
                ]
            })
        });

        const data = await response.json();
        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const finalReply = replyText || "I got confused! Do you like pizza?";

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ reply: finalReply })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: "Jimmy is napping. Try again!" })
        };
    }
};
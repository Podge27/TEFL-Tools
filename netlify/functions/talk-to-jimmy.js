const https = require('https');

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

        // Safe JSON parsing
        let bodyData = {};
        try {
            bodyData = event.body ? JSON.parse(event.body) : {};
        } catch (e) {
            console.error("Invalid JSON body");
        }

        const { history = [], newMessage = "", level = "starters" } = bodyData;

        const levelRules = {
            starters: `LEVEL: Pre A1 Starters. GRAMMAR ALLOWED: Present simple, Present continuous, Can (ability), Have (got), There is/are, Like + ing, Would like. VOCAB THEMES: Animals, The body, Clothes, Colours, Family, Food, Home, School. NUMBERS: 1-20. FORBIDDEN: NEVER use past tense, future 'will', or comparative adjectives.`,
            movers: `LEVEL: A1 Movers. GRAMMAR ALLOWED: Past simple (regular/irregular), Comparative/Superlative adjectives, Must, Have (got) to, Shall for offers, Could (past of can). VOCAB THEMES: Health, Weather, Town/City, Places & Directions. NUMBERS: 21-100 and Ordinals 1st-20th. FORBIDDEN: NEVER use Present Perfect or complex 'If' conditionals.`,
            flyers: `LEVEL: A2 Flyers. GRAMMAR ALLOWED: Past continuous, Present perfect, Be going to, Will, Might, May, Should, Tag questions, Zero conditionals. VOCAB THEMES: Environment, Space, Work/Jobs, Months. NUMBERS: 101-1,000 and Ordinals 21st-31st.`
        };

        const currentRules = levelRules[level.toLowerCase()] || levelRules.starters;

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
        if (newMessage) {
            contents.push({ role: "user", parts: [{ text: newMessage }] });
        }

        // --- THE UNBREAKABLE HTTPS CONNECTION ---
        const requestBody = JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstructionText }] },
            contents: contents,
            generationConfig: { 
                maxOutputTokens: 500, // Giving Jimmy his 500 words
                temperature: 0.6 
            }
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
                                return resolve({ statusCode: 200, headers, body: JSON.stringify({ reply: "I got distracted by a monkey! What were we saying?" }) });
                            }
                            
                            let rawText = apiResponse.candidates[0].content.parts[0].text;
                            
                            // THE BULLETPROOF SWEEPER
                            let replyText = rawText.replace(/\n/g, " ").replace(/\\n/g, " ").trim();

                            if (!replyText) {
                                return resolve({ statusCode: 200, headers, body: JSON.stringify({ reply: "I got distracted by a monkey! What were we saying?" }) });
                            }

                            resolve({ statusCode: 200, headers, body: JSON.stringify({ reply: replyText }) });
                        } catch (error) {
                            resolve({ statusCode: 200, headers, body: JSON.stringify({ reply: "My brain is quite scrambled today! Let's talk about bananas instead." }) });
                        }
                    } else {
                        // Keeps a 200 status so the website doesn't crash, but shows a fun error
                        resolve({ statusCode: 200, headers, body: JSON.stringify({ reply: "The internet monkey stole my banana! Can you say that again?" }) });
                    }
                });
            });

            req.on('error', (e) => {
                resolve({ statusCode: 200, headers, body: JSON.stringify({ reply: "Uh oh, the phone line broke! Let's try again." }) });
            });

            req.write(requestBody);
            req.end();
        });

    } catch (error) {
        console.error("Jimmy's Brain Error:", error);
        return {
            statusCode: 200, 
            headers,
            body: JSON.stringify({ reply: `Ouch, my brain hurts! Let's talk about bananas instead!` })
        };
    }
};
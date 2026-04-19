const characterTraits = {
    'Jimmy': 'brave but silly and a little bit clumsy',
    'Katy': 'very smart and loves animals, Jimmys best friend',
    'Belinda': 'always hungry and tells funny jokes, is the younger sister of Jimmy and Denny',
    'Denny': 'always angry, is the older brother of Jimmy and Belinda',
    'Bob': 'loud and loves building things, is a baby',
    'Susan': 'always carries a map and a magnifying glass, wants to be a pirate',
    'Julia': 'loves solving mysteries and reading books, is kind and polite'
};

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        const data = JSON.parse(event.body);
        const { level, characters, setting, problem, teacherNotes, history, currentTurn } = data;

        const levelRules = {
            starters: `LEVEL: Pre A1 Starters. GRAMMAR ALLOWED: Present simple, Present continuous, Can (ability), Have (got), There is/are. VOCAB THEMES TO USE: Animals, The body, Clothes, Colours, Family, Food, Home, School. NUMBERS: 1-20. FORBIDDEN: NEVER use past tense, future 'will', or comparative adjectives.`,
            movers: `LEVEL: A1 Movers. GRAMMAR ALLOWED: Past simple (regular/irregular), Comparative/Superlative adjectives, Must, Have (got) to, Could. VOCAB THEMES TO USE: Health, Weather, Town/City, Places & Directions, Transport, Sports. NUMBERS: 21-100 and Ordinals 1st-20th. FORBIDDEN: NEVER use Present Perfect or complex 'If' conditionals.`,
            flyers: `LEVEL: A2 Flyers. GRAMMAR ALLOWED: Past continuous, Present perfect, Be going to, Will, Might, May, Should, Tag questions. VOCAB THEMES TO USE: Environment, Space, Work/Jobs, Months, Materials. NUMBERS: 101-1,000 and Ordinals 21st-31st.`
        };

        const currentRules = levelRules[level?.toLowerCase()] || levelRules.starters;

        const charactersWithTraits = characters.map(name => 
            `${name} (who is ${characterTraits[name] || 'a helpful friend'})`
        ).join(' and ');

        let arcInstruction = "";
        let isFinalTurn = false;

        switch (currentTurn) {
            case 1: arcInstruction = `Act 1: Introduction. Introduce characters and ${setting}. Problem ('${problem}') MUST happen. Choices: How they react.`; break;
            case 2: arcInstruction = `Act 2: Exploration. They try to fix it, but discover a new complication. Choices: How they handle this new obstacle.`; break;
            case 3: arcInstruction = `Act 3: Rising Action. Things get more difficult or silly. Choices: Their next big idea.`; break;
            case 4: arcInstruction = `Act 4: Climax. The final hurdle to fixing ('${problem}'). Choices: The final action they take.`; break;
            default: isFinalTurn = true; arcInstruction = `Act 5: Resolution. They successfully solve ('${problem}'). Everyone is happy.`; break;
        }

        let taskInstruction = `
        Task: Write the next short paragraph (max 3 simple sentences). 
        Narrative Stage: ${arcInstruction}
        CRITICAL RULES FOR OPTIONS: Provide exactly 3 options (Immediate physical actions).
        Leave the "vocabulary" array empty [].`;

        if (isFinalTurn) {
            taskInstruction = `
            Task: Write the final concluding paragraph (max 4 simple sentences).
            Narrative Stage: ${arcInstruction}
            CRITICAL RULES FOR ENDING: Set the "options" array to be completely empty []. 
            Review the story and extract 8 to 10 key English vocabulary words used. Put them in the "vocabulary" array.`;
        }

        const promptText = `
        You are an expert ESOL teacher writing a choose-your-own-adventure story.
        Target Audience: Spanish students learning English (children).
        ${currentRules}
        Language: British English spelling and phrasing only.
        
        Story Elements:
        - Characters: ${charactersWithTraits}
        - Setting: A ${setting}. 
        - Core Problem: ${problem}.
        - Teacher Instructions: ${teacherNotes || 'None'}
        
        Previous History: ${history || 'Start of the story.'}
        
        ${taskInstruction}`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: promptText }] }],
                generationConfig: {
                    maxOutputTokens: 500, 
                    temperature: 0.4,
                    // THE ULTIMATE LOCK: The exact blueprint
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            story: { type: "STRING" },
                            options: { type: "ARRAY", items: { type: "STRING" } },
                            vocabulary: { type: "ARRAY", items: { type: "STRING" } }
                        },
                        required: ["story", "options", "vocabulary"]
                    }
                }
            })
        });

        const apiData = await response.json();

        if (!response.ok) {
            throw new Error(apiData.error?.message || "Google API rejected the request.");
        }

        let responseText = apiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        
        if (!responseText) {
            throw new Error("Google sent back a blank page.");
        }

        // Just in case there are invisible rogue line breaks hiding in the text
        responseText = responseText.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

        const parsedData = JSON.parse(responseText);

        return { statusCode: 200, headers, body: JSON.stringify(parsedData) };

    } catch (error) {
        console.error("Story Error:", error.message);
        const fallback = {
            story: `Oh no! The story book closed. (Error: ${error.message})`,
            options: [],
            vocabulary: []
        };
        return { statusCode: 200, headers, body: JSON.stringify(fallback) };
    }
};